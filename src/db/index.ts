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

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: useSsl ? { rejectUnauthorized: false } : false,
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
    console.warn(`[Database Warning] Could not connect to PostgreSQL DB (${err.message}). Using fallback in-memory handler.`);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected;
}

// Supports the Base64 WebP data URLs produced by the SaaS image editor.
// ALTER TYPE TEXT is idempotent when the column is already TEXT.
export async function ensureProductImageSchema(): Promise<void> {
  await pool.query('ALTER TABLE product_images ALTER COLUMN image_url TYPE TEXT');
  await pool.query('ALTER TABLE stock_balances DROP CONSTRAINT IF EXISTS stock_balances_quantity_check');
  // These are idempotent and make the two most frequent list queries use
  // indexed lookups on databases created before the performance migration.
  await pool.query('CREATE INDEX IF NOT EXISTS idx_product_images_product_display ON product_images(product_id, is_primary DESC, sort_order ASC, id ASC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_movements_date_id ON stock_movements(movement_date DESC, id DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement ON stock_movement_items(movement_id, product_id)');
}

// Execute query helper with parameters
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[DB Query] executed in ${duration}ms, rows: ${res.rowCount}`);
    return res;
  } catch (error) {
    console.error(`[DB Error] Query failed: ${text}`, error);
    throw error;
  }
}

// Auto-run schema.sql and insertdata.sql if DATABASE_URL is active and requested
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

    const insertDataPath = path.join(process.cwd(), 'insertdata.sql');
    if (fs.existsSync(insertDataPath)) {
      console.log('[Database] Applying insertdata.sql test dataset...');
      const insertSql = fs.readFileSync(insertDataPath, 'utf8');
      await pool.query(insertSql);
      console.log('[Database] insertdata.sql dataset executed successfully!');
    }
  } catch (err) {
    console.error('[Database Migration Error]', err);
  }
}
