import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// The API runs from the repository root, while its environment file lives in
// .env. Load it before constructing the PostgreSQL pool.
dotenv.config({ path: path.join(process.cwd(), '.env') });

// PostgreSQL Connection Pool configuration
const connectionString =
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

const isSupabase = connectionString ? (connectionString.includes('supabase.co') || connectionString.includes('supabase.com')) : false;
const useSsl = isSupabase || process.env.NODE_ENV === 'production' || (connectionString ? connectionString.includes('sslmode=require') : false);

// SSL: Supabase pooler dùng SNI nên không verify được CN → tắt verify cho đúng host đó.
// Các DB khác (self-host) bắt buộc verify chứng chỉ để tránh MITM.
const sslConfig = isSupabase
  ? { rejectUnauthorized: false }
  : useSsl
    ? { rejectUnauthorized: true }
    : false;

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: sslConfig,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'erpacc_db',
      }
);

let isConnected = false;

// Test DB Connection
export async function testDbConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    client.release();
    isConnected = true;
    console.log(`[Database] Successfully connected to PostgreSQL at ${res.rows[0].now}`);
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn(`[Database Warning] Could not connect to PostgreSQL DB (${err.message}). Database-backed requests will report the connection error.`);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

// Execute query helper with parameters.
// Logging theo cấp độ: chỉ in SQL khi DEBUG_QUERY=true, hoặc cảnh báo query chậm.
const DEBUG_QUERY = process.env.DEBUG_QUERY === 'true';
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 1000);

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (DEBUG_QUERY) {
      console.log(`[DB Query] ${duration}ms, rows: ${res.rowCount} — ${text}`);
    } else if (duration > SLOW_QUERY_MS) {
      console.warn(`[DB Slow] ${duration}ms — ${text}`);
    }
    return res;
  } catch (error) {
    console.error(`[DB Error] Query failed: ${text}`, error);
    throw error;
  }
}

// Apply schema.sql only when explicitly enabled. The bulk insertdata.sql load-test
// dataset is opt-in through LOAD_SEED_DATA and is never a production default.
export async function autoMigrateDatabase() {
  const connected = await testDbConnection();
  if (!connected) return;

  try {
    // Check if database already has data to avoid overwriting existing tables
    const checkResult = await pool.query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('sys_users', 'companies', 'web_customers')");
    const existingTables = checkResult.rows[0]?.count || 0;
    
    if (existingTables > 0) {
      // Check if sys_users has data
      const userCount = await pool.query('SELECT COUNT(*) as count FROM sys_users');
      const hasUsers = userCount.rows[0]?.count > 0;
      
      if (hasUsers) {
        console.log('[Database] Existing user data detected. Skipping schema.sql and insertdata.sql to preserve existing data.');
        return;
      }
    }

    const schemaPath = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('[Database] Applying schema.sql migrations...');
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
      console.log('[Database] Migrations applied successfully!');
    }

    // The bulk dataset is for load testing only. It must never be loaded as a
    // side effect of a production deployment: application pages read the
    // tenant's real rows and an empty tenant must remain empty.
    if (process.env.LOAD_SEED_DATA === 'true') {
      const insertDataPath = path.join(process.cwd(), 'insertdata.sql');
      if (fs.existsSync(insertDataPath)) {
        console.log('[Database] Applying explicitly requested insertdata.sql test dataset...');
        const insertSql = fs.readFileSync(insertDataPath, 'utf8');
        await pool.query(insertSql);
        console.log('[Database] insertdata.sql test dataset executed successfully!');
      }
    } else {
      console.log('[Database] Skipping insertdata.sql. Set LOAD_SEED_DATA=true only for a non-production load-test database.');
    }
  } catch (err) {
    console.error('[Database Migration Error]', err);
  }
}

// ============================================================
// MIGRATION CÓ PHIÊN BẢN
// ============================================================
// schema.sql chỉ được áp dụng cho DB MỚI (qua autoMigrateDatabase).
// Các thay đổi dần dần (delta) từ nay được quản lý bằng bảng schema_migrations,
// áp dụng đúng 1 lần, theo thứ tự version, an toàn khi deploy lên DB đã có data.

interface Migration {
  version: number;
  name: string;
  up: () => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'add_is_super_admin',
    up: async () => {
      await pool.query('ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE');
      await pool.query("UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin'");
    },
  },
  {
    version: 2,
    name: 'fix_legacy_password_hashes',
    up: async () => {
      // Reset hash "ma thuật" (không khớp mật khẩu nào) về hash thật của 'admin123'.
      const LEGACY = '$2a$10$wT0C2c2E1v6cE8Xg8A3A8uQ4P0O6N9M8L7K6J5H4G3F2E1D0C';
      const REAL = '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.';
      await pool.query('UPDATE sys_users SET password_hash = $1 WHERE password_hash = $2', [REAL, LEGACY]);
      await pool.query('UPDATE web_customers SET password_hash = $1 WHERE password_hash = $2', [REAL, LEGACY]);
    },
  },
  {
    version: 3,
    name: 'product_images_text_and_indexes',
    up: async () => {
      await pool.query('ALTER TABLE product_images ALTER COLUMN image_url TYPE TEXT');
      await pool.query('ALTER TABLE stock_balances DROP CONSTRAINT IF EXISTS stock_balances_quantity_check');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_product_images_product_display ON product_images(product_id, is_primary DESC, sort_order ASC, id ASC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_movements_date_id ON stock_movements(movement_date DESC, id DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id, product_id)');
    },
  },
  {
    version: 4,
    name: 'procurement_lists',
    up: async () => {
      // Lưu danh sách PR/RFQ/PO theo tenant (thay thế localStorage). Dùng JSONB để
      // giữ nguyên cấu trúc dữ liệu phức tạp (items lồng nhau + supplier_quotes).
      await pool.query(`CREATE TABLE IF NOT EXISTS procurement_lists (
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        list_type VARCHAR(10) NOT NULL, -- 'prs' | 'rfqs' | 'pos'
        payload JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (company_id, list_type)
      )`);
    },
  },
  {
    version: 5,
    name: 'tenant_workspaces_and_normalized_uniqueness',
    up: async () => {
      // A tenant is provisioned with an explicit ERP workspace and WebShop.
      // The backfill is idempotent so it is safe for databases created before
      // this migration was introduced.
      await pool.query('ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_default_shop BOOLEAN NOT NULL DEFAULT FALSE');
      await pool.query(`WITH ranked_defaults AS (
                           SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS position
                             FROM companies WHERE is_default_shop = TRUE
                         )
                         UPDATE companies c
                            SET is_default_shop = (r.position = 1)
                           FROM ranked_defaults r
                          WHERE c.id = r.id`);
      await pool.query(`UPDATE companies
                           SET is_default_shop = TRUE
                         WHERE id = (SELECT id FROM companies WHERE is_active = TRUE ORDER BY id ASC LIMIT 1)
                           AND NOT EXISTS (SELECT 1 FROM companies WHERE is_default_shop = TRUE)`);
      await pool.query('ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS category_code VARCHAR(100)');
      await pool.query('ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS capacity VARCHAR(100)');
      await pool.query(`CREATE TABLE IF NOT EXISTS tenant_workspaces (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
        workspace_slug VARCHAR(80) NOT NULL UNIQUE,
        workspace_name_vi VARCHAR(255) NOT NULL,
        workspace_name_en VARCHAR(255),
        webshop_slug VARCHAR(80) NOT NULL UNIQUE,
        webshop_name_vi VARCHAR(255) NOT NULL,
        webshop_name_en VARCHAR(255),
        settings JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`
        INSERT INTO tenant_workspaces (
          company_id, workspace_slug, workspace_name_vi, workspace_name_en,
          webshop_slug, webshop_name_vi, webshop_name_en
        )
        SELECT
          c.id,
          COALESCE(NULLIF(c.slug, ''), 'workspace-' || c.id::text),
          'Không gian làm việc ' || c.name_vi,
          'Workspace ' || COALESCE(NULLIF(c.name_en, ''), c.name_vi),
          COALESCE(NULLIF(c.slug, ''), 'shop-' || c.id::text),
          'WebShop ' || c.name_vi,
          'WebShop ' || COALESCE(NULLIF(c.name_en, ''), c.name_vi)
        FROM companies c
        ON CONFLICT (company_id) DO NOTHING
      `);

      // Normalise values in the index expression instead of relying on the
      // client to format email/tax-code input consistently.
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_tax_code_normalized
        ON companies (UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')))
        WHERE tax_code IS NOT NULL AND BTRIM(tax_code) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_email_normalized
        ON companies (LOWER(BTRIM(email)))
        WHERE email IS NOT NULL AND BTRIM(email) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_users_email_normalized
        ON sys_users (LOWER(BTRIM(email)))
        WHERE email IS NOT NULL AND BTRIM(email) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_tax_code_normalized
        ON customers (company_id, UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')))
        WHERE tax_code IS NOT NULL AND BTRIM(tax_code) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_email_normalized
        ON customers (company_id, LOWER(BTRIM(email)))
        WHERE email IS NOT NULL AND BTRIM(email) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_tax_code_normalized
        ON suppliers (company_id, UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')))
        WHERE tax_code IS NOT NULL AND BTRIM(tax_code) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_email_normalized
        ON suppliers (company_id, LOWER(BTRIM(email)))
        WHERE email IS NOT NULL AND BTRIM(email) <> ''`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_web_customers_company_email_normalized
        ON web_customers (company_id, LOWER(BTRIM(email)))`);
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_default_shop
        ON companies (is_default_shop) WHERE is_default_shop = TRUE`);
    },
  },
];

export async function runMigrations(): Promise<void> {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const applied = new Set<number>(
      (await pool.query('SELECT version FROM schema_migrations')).rows.map((r) => Number(r.version))
    );

    for (const m of MIGRATIONS) {
      if (applied.has(m.version)) continue;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await m.up();
        await client.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
        await client.query('COMMIT');
        console.log(`[Migration] applied ${m.version}_${m.name}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[Migration] FAILED ${m.version}_${m.name}`, err);
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.error('[Migration] runMigrations error', err);
  }
}
