-- ============================================================
-- ERPVIET - Standardized Schema (schema_standard.sql)
-- Purpose: canonical, idempotent, production-ready schema derived from
-- the existing schema.sql and "schema - fix.sql" in the repo.
-- This file aims to be safe to run repeatedly (uses IF NOT EXISTS / CREATE OR REPLACE)
-- and documents choices where the original files differed (foreign keys vs performance).
-- NOTE: Review partitions and archived blocks before running on production.
-- ============================================================

-- === Basics & extensions ===
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

SET client_min_messages = WARNING;

-- Optional: comment out foreign key creation lines below to prefer higher insert throughput
-- when bulk-loading. Keep FKs enabled for strong referential integrity.

-- Helper: automatic updated_at
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CORE TABLES (idempotent)
-- ============================================================

CREATE TABLE IF NOT EXISTS companies (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    tax_code VARCHAR(50),
    address VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(100),
    logo_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL,
    code VARCHAR(30) NOT NULL,
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    address VARCHAR(255),
    phone VARCHAR(50),
    is_headquarter BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_branch_company_code UNIQUE(company_id, code)
    -- To enable FK: uncomment following and ensure companies exists
    -- , FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT,
    code VARCHAR(30) NOT NULL,
    name_vi VARCHAR(150) NOT NULL,
    name_en VARCHAR(150),
    manager_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- , FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE
);

-- Users / roles
CREATE TABLE IF NOT EXISTS sys_roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    module_code VARCHAR(50) NOT NULL,
    action_code VARCHAR(50) NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS sys_role_permissions (
    role_id BIGINT NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_code)
    -- , FOREIGN KEY (role_id) REFERENCES sys_roles(id)
    -- , FOREIGN KEY (permission_code) REFERENCES sys_permissions(code)
);

CREATE TABLE IF NOT EXISTS sys_users (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT DEFAULT 1,
    branch_id BIGINT DEFAULT 1,
    department_id BIGINT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role_id BIGINT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'disabled')),
    preferred_lang VARCHAR(10) DEFAULT 'vi',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- , FOREIGN KEY (role_id) REFERENCES sys_roles(id)
    -- , FOREIGN KEY (company_id) REFERENCES companies(id)
    -- , FOREIGN KEY (branch_id) REFERENCES branches(id)
);

CREATE INDEX IF NOT EXISTS idx_users_active ON sys_users(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_users_login_cover ON sys_users(username, password_hash) INCLUDE (id, full_name, status, role_id);

-- ============================================================
-- MASTER DATA
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_groups (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT,
    code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    tax_code VARCHAR(50),
    phone VARCHAR(20),
    email VARCHAR(100),
    address VARCHAR(255),
    credit_limit NUMERIC(15,2) DEFAULT 100000000.00 CHECK (credit_limit >= 0),
    payment_terms_days INT DEFAULT 30 CHECK (payment_terms_days BETWEEN 0 AND 365),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- , FOREIGN KEY (group_id) REFERENCES customer_groups(id)
);

CREATE INDEX IF NOT EXISTS idx_customers_search_cover ON customers(name, code) INCLUDE (id, phone, email, credit_limit, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_customers_fts ON customers USING gin(to_tsvector('vietnamese', coalesce(name,'') || ' ' || coalesce(code,'') || ' ' || coalesce(tax_code,'')));

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGSERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_suppliers_search_cover ON suppliers(name, code) INCLUDE (id, phone, email, is_active);

CREATE TABLE IF NOT EXISTS uom (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_vi VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    image_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
    -- , FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS brands (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    website VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    category_id BIGINT,
    brand_id BIGINT,
    uom_id BIGINT,
    cost_price NUMERIC(15,2) DEFAULT 0 CHECK (cost_price >= 0),
    selling_price NUMERIC(15,2) DEFAULT 0 CHECK (selling_price >= 0),
    web_price NUMERIC(15,2) DEFAULT 0 CHECK (web_price >= 0),
    vat_rate NUMERIC(5,2) DEFAULT 10.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),
    stock_quantity INT DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock INT DEFAULT 10 CHECK (min_stock >= 0),
    max_stock INT DEFAULT 1000 CHECK (max_stock >= 0),
    weight_kg NUMERIC(8,2) DEFAULT 0 CHECK (weight_kg >= 0),
    is_web_visible BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    description_vi TEXT,
    description_en TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    -- , FOREIGN KEY (category_id) REFERENCES categories(id)
    -- , FOREIGN KEY (brand_id) REFERENCES brands(id)
    -- , FOREIGN KEY (uom_id) REFERENCES uom(id)
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_web_visible ON products(is_web_visible) WHERE is_web_visible = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock_quantity, min_stock) WHERE stock_quantity <= min_stock;
CREATE INDEX IF NOT EXISTS idx_products_search_code_cover ON products(code, sku) INCLUDE (id, name_vi, name_en, selling_price, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_fts_vi ON products USING gin(to_tsvector('vietnamese', coalesce(name_vi,'') || ' ' || coalesce(code,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(description_vi,'')));
CREATE INDEX IF NOT EXISTS idx_products_fts_en ON products USING gin(to_tsvector('english', coalesce(name_en,'') || ' ' || coalesce(code,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(description_en,'')));

-- ============================================================
-- WAREHOUSE & STOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT DEFAULT 1,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    address VARCHAR(255),
    manager_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock_balances (
    id BIGSERIAL PRIMARY KEY,
    warehouse_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    batch_id BIGINT,
    quantity INT DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wh_prod_batch UNIQUE(warehouse_id, product_id, batch_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_balances_cover ON stock_balances(warehouse_id, product_id) INCLUDE (quantity, reserved_quantity);

-- ============================================================
-- PARTITIONED TRANSACTION TABLES (example: invoices, journal_entries, stock_movements)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('NHAP_KHO', 'XUAT_KHO', 'DIEU_CHUYEN', 'KIEM_KE_DIEU_CHINH')),
    warehouse_id BIGINT,
    target_warehouse_id BIGINT,
    reference_doc VARCHAR(100),
    movement_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_by BIGINT,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'HOAN_THANH',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, movement_date)
) PARTITION BY RANGE (movement_date);

CREATE TABLE IF NOT EXISTS journal_entries (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    posting_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, entry_date)
) PARTITION BY RANGE (entry_date);

CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    order_id BIGINT,
    customer_id BIGINT,
    invoice_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    subtotal NUMERIC(15,2) DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(15,2) DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(30) DEFAULT 'Đã phát hành',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, invoice_date)
) PARTITION BY RANGE (invoice_date);

-- Create monthly partitions for a range of years (2026-2028)
DO $$
DECLARE
    y int;
    m int;
    part text;
    from_date date;
    to_date date;
BEGIN
    FOR y IN 2026..2028 LOOP
        FOR m IN 1..12 LOOP
            from_date := make_date(y, m, 1);
            to_date := (from_date + INTERVAL '1 month')::date;
            part := format('invoices_y%s_m%02s', y, m);
            EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF invoices FOR VALUES FROM (%L) TO (%L)', part, from_date, to_date);
            part := format('journal_entries_y%s_m%02s', y, m);
            EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF journal_entries FOR VALUES FROM (%L) TO (%L)', part, from_date, to_date);
            part := format('stock_movements_y%s_m%02s', y, m);
            EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF stock_movements FOR VALUES FROM (%L) TO (%L)', part, from_date, to_date);
        END LOOP;
    END LOOP;
END$$;

-- ============================================================
-- SUPPORTING OBJECTS (materialized views, refresh functions)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_sales AS
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL '30 days' as start_date,
           CURRENT_DATE as end_date
),
daily_sales AS (
    SELECT DATE_TRUNC('day', i.invoice_date) as sale_date,
           COUNT(DISTINCT i.id) as order_count,
           COALESCE(SUM(i.total_amount),0) as revenue,
           COALESCE(SUM(i.tax_amount),0) as tax,
           COUNT(DISTINCT i.customer_id) as customer_count
    FROM invoices i
    WHERE i.invoice_date >= (SELECT start_date FROM date_range)
      AND i.invoice_date <= (SELECT end_date FROM date_range)
      AND i.status != 'Đã hủy'
    GROUP BY DATE_TRUNC('day', i.invoice_date)
)
SELECT sale_date, order_count, revenue, tax, customer_count
FROM daily_sales
ORDER BY sale_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_sales_date ON mv_dashboard_sales(sale_date);

CREATE OR REPLACE FUNCTION refresh_dashboard_mvs()
RETURNS VOID AS $$
BEGIN
    -- CONCURRENTLY requires indexes and special permissions; guard by checking view exists
    PERFORM 1 FROM pg_matviews WHERE matviewname = 'mv_dashboard_sales';
    IF FOUND THEN
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_sales;
        EXCEPTION WHEN others THEN
            -- fallback to non-concurrent refresh if concurrent not possible
            REFRESH MATERIALIZED VIEW mv_dashboard_sales;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGERS EXAMPLE: keep updated_at in sync
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_timestamp_generic') THEN
        CREATE TRIGGER trg_update_timestamp_generic
        BEFORE UPDATE ON companies
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_timestamp();
    END IF;
END$$;

-- ============================================================
-- FINAL: Notes & Next Steps
-- ============================================================
-- 1) This file intentionally uses IF NOT EXISTS and avoids destructive DROP statements.
-- 2) The repository currently contains multiple SQL files with different approaches:
--    - schema.sql includes many FK constraints and a full seed dataset.
--    - "schema - fix.sql" favors performance (fewer FKs, partitioning strategy).
-- 3) Recommendation: choose one approach (strict referential integrity OR high-ingest performance)
--    and keep a single canonical schema file. For migrations, use separate migration scripts.
-- 4) If you want, I can:
--    - Commit this file as 'schema_standard.sql' (done) and open a PR with explanations,
--    - Or instead generate two files: 'schema_with_fks.sql' and 'schema_without_fks.sql' and
--      a small migration plan to move from current state to the chosen one.

-- End of schema_standard.sql
