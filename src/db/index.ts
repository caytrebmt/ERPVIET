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
      // CHỈ admin của công ty nền tảng (id = 1 — ERPACC) mới là super admin.
      // Admin của tenant khác (kể cả nếu trùng tên 'admin') chỉ quản lý
      // tenant của mình — KHÔNG bao giờ tự động nâng quyền toàn hệ thống.
      await pool.query("UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin' AND company_id = 1");
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
    version: 8,
    name: 'create_missing_business_tables',
    up: async () => {
      // Các database tạo TRƯỚC KHI schema.sql có các bảng chứng từ nghiệp vụ
      // (báo giá, đơn bán, đơn mua, phiếu thu/chi, tồn kho theo kho...) KHÔNG
      // có các bảng này. autoMigrateDatabase không bao giờ áp lại schema.sql
      // lên DB đã có data (tránh DROP), và migration trước đây cũng chưa tạo
      // chúng → /api/saas/dashboard/summary và các trang công nợ/báo cáo lỗi
      // "relation does not exist" → 4 thẻ KPI Dashboard hiện "Không tải được
      // dữ liệu".Migration này tạo các bảng THIẾU một cách idempotent (KHÔNG
      // chèn dữ liệu mẫu — tenant trống phải giữ nguyên trống) và backfill cột
      // company_id để tách dữ liệu theo tenant, khớp chính xác định nghĩa trong
      // schema.sql. Với DB mới (đã có đủ bảng) toàn bộ lệnh là no-op.
      await pool.query(`CREATE TABLE IF NOT EXISTS customer_groups (
        id SERIAL PRIMARY KEY,
        code VARCHAR(30) UNIQUE NOT NULL,
        name_vi VARCHAR(100) NOT NULL,
        name_en VARCHAR(100) NOT NULL,
        discount_percent NUMERIC(5,2) DEFAULT 0.00
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        group_id INT REFERENCES customer_groups(id),
        code VARCHAR(30) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        tax_code VARCHAR(50),
        phone VARCHAR(20),
        email VARCHAR(100),
        address VARCHAR(255),
        credit_limit NUMERIC(15, 2) DEFAULT 100000000.00,
        payment_terms_days INT DEFAULT 30,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS suppliers (
        id SERIAL PRIMARY KEY,
        code VARCHAR(30) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        tax_code VARCHAR(50),
        phone VARCHAR(20),
        email VARCHAR(100),
        address VARCHAR(255),
        bank_account VARCHAR(50),
        bank_name VARCHAR(100),
        payment_terms VARCHAR(50) DEFAULT '30 ngày kể từ ngày nhận hàng',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS batches (
        id SERIAL PRIMARY KEY,
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        batch_number VARCHAR(50) NOT NULL,
        mfg_date DATE,
        exp_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_product_batch UNIQUE(product_id, batch_number)
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS warehouses (
        id SERIAL PRIMARY KEY,
        branch_id INT REFERENCES branches(id) DEFAULT 1,
        code VARCHAR(30) UNIQUE NOT NULL,
        name_vi VARCHAR(100) NOT NULL,
        name_en VARCHAR(100) NOT NULL,
        address VARCHAR(255),
        manager_name VARCHAR(100),
        phone VARCHAR(20),
        capacity VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS quotations (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        customer_id INT REFERENCES customers(id),
        quote_date DATE DEFAULT CURRENT_DATE,
        expiry_date DATE DEFAULT (CURRENT_DATE + INTERVAL '15 days'),
        subtotal NUMERIC(15, 2) DEFAULT 0,
        tax_amount NUMERIC(15, 2) DEFAULT 0,
        total_amount NUMERIC(15, 2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'DA_GUI' CHECK (status IN ('NHAP', 'DA_GUI', 'DONG_Y', 'TU_CHOI')),
        created_by INT REFERENCES sys_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS quotation_items (
        id SERIAL PRIMARY KEY,
        quotation_id INT REFERENCES quotations(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(15, 2) NOT NULL,
        vat_rate NUMERIC(5, 2) DEFAULT 10.00,
        subtotal NUMERIC(15, 2) NOT NULL
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS sales_orders (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        quotation_id INT REFERENCES quotations(id),
        customer_id INT REFERENCES customers(id),
        sales_rep_id INT REFERENCES sys_users(id),
        order_date DATE DEFAULT CURRENT_DATE,
        subtotal NUMERIC(15, 2) DEFAULT 0,
        discount_amount NUMERIC(15, 2) DEFAULT 0,
        tax_amount NUMERIC(15, 2) DEFAULT 0,
        total_amount NUMERIC(15, 2) DEFAULT 0,
        payment_status VARCHAR(30) DEFAULT 'CHUA_THANH_TOAN' CHECK (payment_status IN ('CHUA_THANH_TOAN', 'COC_MOT_PHAN', 'DA_THANH_TOAN')),
        status VARCHAR(30) DEFAULT 'DANG_XU_LY' CHECK (status IN ('MOI', 'DANG_XU_LY', 'HOAN_THANH', 'HUY')),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS sales_order_items (
        id SERIAL PRIMARY KEY,
        sales_order_id INT REFERENCES sales_orders(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(15, 2) NOT NULL,
        subtotal NUMERIC(15, 2) NOT NULL
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        supplier_id INT REFERENCES suppliers(id),
        order_date DATE DEFAULT CURRENT_DATE,
        expected_delivery_date DATE,
        subtotal NUMERIC(15, 2) DEFAULT 0,
        tax_amount NUMERIC(15, 2) DEFAULT 0,
        total_amount NUMERIC(15, 2) DEFAULT 0,
        status VARCHAR(30) DEFAULT 'HOAN_THANH' CHECK (status IN ('MOI', 'DANG_XU_LY', 'HOAN_THANH', 'HUY')),
        created_by INT REFERENCES sys_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(15, 2) NOT NULL,
        subtotal NUMERIC(15, 2) NOT NULL
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS receipts_payments (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        voucher_type VARCHAR(10) NOT NULL CHECK (voucher_type IN ('THU', 'CHI')),
        partner_type VARCHAR(20) NOT NULL CHECK (partner_type IN ('KHACH_HANG', 'NHA_CUNG_CAP', 'KHAC')),
        partner_id INT,
        amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
        payment_method VARCHAR(30) DEFAULT 'CHUYEN_KHOAN' CHECK (payment_method IN ('TIEN_MAT', 'CHUYEN_KHOAN')),
        payment_date DATE DEFAULT CURRENT_DATE,
        reason VARCHAR(255),
        created_by INT REFERENCES sys_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS stock_movements (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('NHAP_KHO', 'XUAT_KHO', 'DIEU_CHUYEN', 'KIEM_KE_DIEU_CHINH')),
        warehouse_id INT REFERENCES warehouses(id),
        target_warehouse_id INT REFERENCES warehouses(id),
        reference_doc VARCHAR(100),
        movement_date DATE DEFAULT CURRENT_DATE,
        created_by INT REFERENCES sys_users(id),
        notes TEXT,
        status VARCHAR(30) DEFAULT 'HOAN_THANH' CHECK (status IN ('NHAP_NHAP', 'DANG_XULY', 'HOAN_THANH', 'HUY')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS stock_movement_items (
        id SERIAL PRIMARY KEY,
        movement_id INT REFERENCES stock_movements(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id),
        batch_id INT REFERENCES batches(id),
        uom_id INT REFERENCES uom(id),
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_cost NUMERIC(15, 2) DEFAULT 0,
        subtotal_cost NUMERIC(15, 2) DEFAULT 0
      )`);
      // Lưu ý: KHÔNG kèm CHECK (quantity >= 0) — migration 3 đã drop constraint
      // này trên schema hiện hành vì nghiệp vụ xuất kho cho phép tồn âm tạm thời.
      // Tạo bảng khớp đúng trạng thái CUỐI của schema.sql + migration 3.
      await pool.query(`CREATE TABLE IF NOT EXISTS stock_balances (
        id SERIAL PRIMARY KEY,
        warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
        product_id INT REFERENCES products(id) ON DELETE CASCADE,
        batch_id INT REFERENCES batches(id) ON DELETE SET NULL,
        quantity INT DEFAULT 0,
        reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_wh_prod_batch UNIQUE(warehouse_id, product_id, batch_id)
      )`);

      // Backfill cột tách tenant cho các bảng vừa tạo (chỉ hiệu lực khi cột
      // chưa tồn tại — bảng có sẵn từ schema.sql giữ nguyên).
      const tenantTables = [
        'customer_groups', 'customers', 'suppliers', 'batches', 'warehouses',
        'quotations', 'quotation_items', 'sales_orders', 'sales_order_items',
        'purchase_orders', 'purchase_order_items', 'receipts_payments',
        'stock_movements', 'stock_movement_items', 'stock_balances',
      ];
      for (const table of tenantTables) {
        await pool.query(
          `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1`
        );
      }

      // Index tách tenant cho các truy vấn KPI công nợ/doanh thu.
      await pool.query('CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_quotations_company ON quotations(company_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON sales_orders(company_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders(company_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_receipts_payments_company ON receipts_payments(company_id)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_balances_company ON stock_balances(company_id)');
    },
  },

  {
    version: 3,
    name: 'product_images_text_and_indexes',
    up: async () => {
      // Các bảng có thể CHƯA TỒN TẠI trên database rất cũ (migration 8 tạo
      // chúng nhưng chạy SAU migration này). Nếu không kiểm tra, ALTER/CREATE
      // INDEX sẽ ném lỗi "relation does not exist" làm DỪNG cả chuỗi
      // migration → migration 8 không bao giờ chạy được và dashboard vẫn
      // hiển thị "Không tải được dữ liệu".
      const tableExists = async (table: string): Promise<boolean> => {
        const r = await pool.query('SELECT to_regclass($1) AS t', ['public.' + table]);
        return r.rows[0]?.t != null;
      };
      if (await tableExists('product_images')) {
        await pool.query('ALTER TABLE product_images ALTER COLUMN image_url TYPE TEXT');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_product_images_product_display ON product_images(product_id, is_primary DESC, sort_order ASC, id ASC)');
      }
      if (await tableExists('stock_balances')) {
        await pool.query('ALTER TABLE stock_balances DROP CONSTRAINT IF EXISTS stock_balances_quantity_check');
      }
      if (await tableExists('stock_movements')) {
        await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_movements_date_id ON stock_movements(movement_date DESC, id DESC)');
      }
      if (await tableExists('stock_movement_items')) {
        await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id, product_id)');
      }
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
  {
    version: 6,
    name: 'demote_tenant_admins_misflagged_super_admin',
    up: async () => {
      // Migration v1 (bản gốc) đã chạy:
      //   UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin'
      // mà KHÔNG lọc theo tenant → admin của MỌI doanh nghiệp có tên 'admin'
      // (vd: khách hàng doanh nghiệp đăng ký tài khoản 'admin') bị nâng nhầm
      // thành super admin nền tảng → nhìn thấy Quản lý Doanh nghiệp, Nhật ký
      // an ninh, Dịch thuật dùng chung, Cấu hình menu, Kết nối API backend.
      //
      // Đây là phép đảo ngược đúng: chỉ hạ quyền những user 'admin' KHÔNG
      // thuộc công ty nền tảng (id = 1 — ERPACC). Admin nền tảng thật (company
      // 1) không bị ảnh hưởng. Nếu nền tảng có user vận hành khác cần quyền
      // super admin → DBA set is_super_admin = TRUE thủ công cho đúng người.
      await pool.query(
        `UPDATE sys_users SET is_super_admin = FALSE
          WHERE is_super_admin = TRUE
            AND LOWER(username) = 'admin'
            AND (company_id IS NULL OR company_id <> 1)`,
      );
    },
  },
  {
    version: 7,
    name: 'web_customers_tenant_scoped_uniqueness',
    up: async () => {
      // Tài khoản khách WebShop phải tách theo tenant: cùng một email được
      // phép tồn tại ở WebShop của các doanh nghiệp khác nhau (khách của shop
      // A không liên quan shop B). Các UNIQUE toàn cục trên username/email
      // từ schema ban đầu ngăn điều này và khiến đăng ký ở tenant thứ 2 lỗi.
      // Tính duy nhất được áp theo tenant bằng index composite.
      await pool.query('ALTER TABLE web_customers DROP CONSTRAINT IF EXISTS web_customers_username_key');
      await pool.query('ALTER TABLE web_customers DROP CONSTRAINT IF EXISTS web_customers_email_key');
      await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_web_customers_company_username_normalized
        ON web_customers (company_id, LOWER(BTRIM(username)))`);
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
