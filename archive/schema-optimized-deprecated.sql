-- ============================================================
-- ULTIMATE OPTIMIZED SCHEMA FOR ERPACC & WEBSHOP
-- Focus: Production-Grade Performance, Partitioning, Archiving
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS & CONFIGURATIONS
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- For faster JSONB queries

-- Enable partition pruning
SET enable_partition_pruning = on;

-- ============================================================
-- 1. CORE TABLES (Without FK for better performance)
-- ============================================================

-- Companies (Small table, no partition needed)
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    tax_code VARCHAR(50) NOT NULL,
    address VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(100),
    website VARCHAR(100),
    logo_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Branches (Small table)
CREATE TABLE IF NOT EXISTS branches (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL,
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
);

-- ============================================================
-- 2. USER & SECURITY (With specific indexes)
-- ============================================================

CREATE TABLE IF NOT EXISTS sys_users (
    id SERIAL PRIMARY KEY,
    company_id INT DEFAULT 1,
    branch_id INT DEFAULT 1,
    department_id INT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role_id INT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'disabled')),
    preferred_lang VARCHAR(10) DEFAULT 'vi',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial Index: Only active users
CREATE INDEX IF NOT EXISTS idx_users_active ON sys_users(status) WHERE status = 'active';

-- Covering Index: Fast login lookup
CREATE INDEX IF NOT EXISTS idx_users_login_cover ON sys_users(username, password_hash) INCLUDE (id, full_name, status, role_id);

-- Role & Permissions (Small tables, no partition)
CREATE TABLE IF NOT EXISTS sys_roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    module_code VARCHAR(50) NOT NULL,
    action_code VARCHAR(50) NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS sys_role_permissions (
    role_id INT NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_code)
);

-- ============================================================
-- 3. MASTER DATA (With proper indexes)
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    group_id INT,
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
);

-- Covering Index for customer search
CREATE INDEX IF NOT EXISTS idx_customers_search_cover ON customers(name, code) INCLUDE (id, phone, email, credit_limit, is_active);

-- Partial Index: Only active customers
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active) WHERE is_active = TRUE;

-- Gin Index for full-text search
CREATE INDEX IF NOT EXISTS idx_customers_fts ON customers USING gin(to_tsvector('vietnamese', name || ' ' || code || ' ' || tax_code));

CREATE TABLE IF NOT EXISTS suppliers (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Covering Index for supplier search
CREATE INDEX IF NOT EXISTS idx_suppliers_search_cover ON suppliers(name, code) INCLUDE (id, phone, email, is_active);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    category_id INT,
    brand_id INT,
    uom_id INT,
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
);

-- Partial Indexes
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_web_visible ON products(is_web_visible) WHERE is_web_visible = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock_quantity, min_stock) WHERE stock_quantity <= min_stock;

-- Covering Indexes
CREATE INDEX IF NOT EXISTS idx_products_search_code_cover ON products(code, sku) INCLUDE (id, name_vi, name_en, selling_price, stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_web_cover ON products(is_web_visible, web_price) INCLUDE (id, name_vi, sku, stock_quantity);

-- Gin Index for full-text search
CREATE INDEX IF NOT EXISTS idx_products_fts_vi ON products USING gin(to_tsvector('vietnamese', name_vi || ' ' || code || ' ' || sku || ' ' || description_vi));
CREATE INDEX IF NOT EXISTS idx_products_fts_en ON products USING gin(to_tsvector('english', name_en || ' ' || code || ' ' || sku || ' ' || description_en));

-- ============================================================
-- 4. INVENTORY MANAGEMENT (With Partitioning)
-- ============================================================

CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    branch_id INT DEFAULT 1,
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
    id SERIAL PRIMARY KEY,
    warehouse_id INT NOT NULL,
    product_id INT NOT NULL,
    batch_id INT,
    quantity INT DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wh_prod_batch UNIQUE(warehouse_id, product_id, batch_id)
);

-- Covering Index for stock lookup
CREATE INDEX IF NOT EXISTS idx_stock_balances_cover ON stock_balances(warehouse_id, product_id) INCLUDE (quantity, reserved_quantity);

-- ============================================================
-- 5. PARTITIONED TABLES FOR HIGH-VOLUME TRANSACTIONS
-- ============================================================

-- 5.1 Stock Movements Partitioned by Month
CREATE TABLE IF NOT EXISTS stock_movements (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('NHAP_KHO', 'XUAT_KHO', 'DIEU_CHUYEN', 'KIEM_KE_DIEU_CHINH')),
    warehouse_id INT,
    target_warehouse_id INT,
    reference_doc VARCHAR(100),
    movement_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_by INT,
    notes TEXT,
    status VARCHAR(30) DEFAULT 'HOAN_THANH' CHECK (status IN ('NHAP_NHAP', 'DANG_XULY', 'HOAN_THANH', 'HUY')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, movement_date)
) PARTITION BY RANGE (movement_date);

-- Covering Index for stock movement search
CREATE INDEX IF NOT EXISTS idx_stock_movements_cover ON stock_movements(warehouse_id, movement_type, movement_date) INCLUDE (code, status, created_by);

-- Partial Index: Only pending movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_pending ON stock_movements(status) WHERE status IN ('NHAP_NHAP', 'DANG_XULY');

-- 5.2 Journal Entries Partitioned by Month
CREATE TABLE IF NOT EXISTS journal_entries (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE NOT NULL,
    posting_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    reference_type VARCHAR(50),
    reference_id BIGINT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, entry_date)
) PARTITION BY RANGE (entry_date);

-- Covering Index for journal search
CREATE INDEX IF NOT EXISTS idx_journal_entries_cover ON journal_entries(entry_date, reference_type) INCLUDE (code, reference_id, created_by);

-- 5.3 Invoices Partitioned by Month
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    order_id BIGINT,
    customer_id INT,
    invoice_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    subtotal NUMERIC(15,2) DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(15,2) DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(30) DEFAULT 'Đã phát hành' CHECK (status IN ('Dự thảo', 'Đã phát hành', 'Đã thanh toán', 'Đã hủy')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, invoice_date)
) PARTITION BY RANGE (invoice_date);

-- Covering Index for invoice search
CREATE INDEX IF NOT EXISTS idx_invoices_cover ON invoices(customer_id, invoice_date) INCLUDE (code, status, total_amount, due_date);

-- Partial Index: Only unpaid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(customer_id, due_date) WHERE status NOT IN ('Đã thanh toán', 'Đã hủy');

-- 5.4 Purchase Invoices Partitioned by Month
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id BIGSERIAL,
    code VARCHAR(50) NOT NULL,
    purchase_order_id BIGINT,
    supplier_id INT,
    invoice_date DATE DEFAULT CURRENT_DATE NOT NULL,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    subtotal NUMERIC(15,2) DEFAULT 0 CHECK (subtotal >= 0),
    tax_amount NUMERIC(15,2) DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount NUMERIC(15,2) DEFAULT 0 CHECK (total_amount >= 0),
    status VARCHAR(30) DEFAULT 'Đã phát hành' CHECK (status IN ('Dự thảo', 'Đã phát hành', 'Đã thanh toán', 'Đã hủy')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, invoice_date)
) PARTITION BY RANGE (invoice_date);

-- Covering Index
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_cover ON purchase_invoices(supplier_id, invoice_date) INCLUDE (code, status, total_amount);

-- ============================================================
-- 6. CREATE PARTITIONS (For 2026-2028)
-- ============================================================

DO $$
DECLARE
    year_start DATE;
    year_end DATE;
    year_num INT;
    partition_name TEXT;
BEGIN
    FOR year_num IN 2026..2028 LOOP
        year_start := make_date(year_num, 1, 1);
        year_end := make_date(year_num, 12, 31);
        
        -- Stock Movements Partitions
        FOR month_num IN 1..12 LOOP
            partition_name := 'stock_movements_y' || year_num || '_m' || LPAD(month_num::TEXT, 2, '0');
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF stock_movements
                FOR VALUES FROM (%L) TO (%L)
            ', partition_name, 
               make_date(year_num, month_num, 1),
               make_date(year_num, month_num + 1, 1)
            );
        END LOOP;
        
        -- Journal Entries Partitions
        FOR month_num IN 1..12 LOOP
            partition_name := 'journal_entries_y' || year_num || '_m' || LPAD(month_num::TEXT, 2, '0');
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF journal_entries
                FOR VALUES FROM (%L) TO (%L)
            ', partition_name,
               make_date(year_num, month_num, 1),
               make_date(year_num, month_num + 1, 1)
            );
        END LOOP;
        
        -- Invoices Partitions
        FOR month_num IN 1..12 LOOP
            partition_name := 'invoices_y' || year_num || '_m' || LPAD(month_num::TEXT, 2, '0');
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF invoices
                FOR VALUES FROM (%L) TO (%L)
            ', partition_name,
               make_date(year_num, month_num, 1),
               make_date(year_num, month_num + 1, 1)
            );
        END LOOP;
        
        -- Purchase Invoices Partitions
        FOR month_num IN 1..12 LOOP
            partition_name := 'purchase_invoices_y' || year_num || '_m' || LPAD(month_num::TEXT, 2, '0');
            EXECUTE format('
                CREATE TABLE IF NOT EXISTS %I PARTITION OF purchase_invoices
                FOR VALUES FROM (%L) TO (%L)
            ', partition_name,
               make_date(year_num, month_num, 1),
               make_date(year_num, month_num + 1, 1)
            );
        END LOOP;
    END LOOP;
END $$;

-- ============================================================
-- 7. AUDIT LOGS (Without FK for performance)
-- ============================================================

CREATE TABLE IF NOT EXISTS sys_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id INT,
    action VARCHAR(50) NOT NULL,
    entity_name VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Covering Index for audit search
CREATE INDEX IF NOT EXISTS idx_audit_cover ON sys_audit_logs(entity_name, created_at) INCLUDE (user_id, action, entity_id);

-- Gin Index for JSONB search
CREATE INDEX IF NOT EXISTS idx_audit_old_data ON sys_audit_logs USING gin(old_data);
CREATE INDEX IF NOT EXISTS idx_audit_new_data ON sys_audit_logs USING gin(new_data);

-- Archive function for audit logs
CREATE OR REPLACE FUNCTION archive_audit_logs()
RETURNS VOID AS $$
BEGIN
    -- Move logs older than 1 year to archive table
    INSERT INTO sys_audit_logs_archive 
    SELECT * FROM sys_audit_logs 
    WHERE created_at < (CURRENT_DATE - INTERVAL '1 year');
    
    -- Delete from main table
    DELETE FROM sys_audit_logs 
    WHERE created_at < (CURRENT_DATE - INTERVAL '1 year');
END;
$$ LANGUAGE plpgsql;

-- Archive table (Same structure but without indexes for faster inserts)
CREATE TABLE IF NOT EXISTS sys_audit_logs_archive (
    LIKE sys_audit_logs INCLUDING ALL
);

-- ============================================================
-- 8. SUMMARY TABLES (For Dashboard)
-- ============================================================

-- Sales Summary by Day (Update via trigger or scheduled job)
CREATE TABLE IF NOT EXISTS sales_summary_daily (
    summary_date DATE PRIMARY KEY,
    total_orders INT DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    total_cogs NUMERIC(15,2) DEFAULT 0,
    total_profit NUMERIC(15,2) DEFAULT 0,
    total_tax NUMERIC(15,2) DEFAULT 0,
    unique_customers INT DEFAULT 0,
    avg_order_value NUMERIC(15,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Covering Index
CREATE INDEX IF NOT EXISTS idx_sales_summary_daily_cover ON sales_summary_daily(summary_date) INCLUDE (total_revenue, total_orders, total_profit);

-- Inventory Summary by Product
CREATE TABLE IF NOT EXISTS inventory_summary_daily (
    id SERIAL PRIMARY KEY,
    summary_date DATE NOT NULL,
    product_id INT NOT NULL,
    warehouse_id INT,
    current_quantity INT DEFAULT 0,
    reserved_quantity INT DEFAULT 0,
    reorder_point INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inv_summary UNIQUE(summary_date, product_id, warehouse_id)
);

-- Covering Index
CREATE INDEX IF NOT EXISTS idx_inventory_summary_cover ON inventory_summary_daily(product_id, summary_date) INCLUDE (current_quantity, reserved_quantity);

-- Customer Summary
CREATE TABLE IF NOT EXISTS customer_summary_daily (
    summary_date DATE NOT NULL,
    customer_id INT NOT NULL,
    total_orders INT DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    total_paid NUMERIC(15,2) DEFAULT 0,
    total_debt NUMERIC(15,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_customer_summary PRIMARY KEY(summary_date, customer_id)
);

-- ============================================================
-- 9. MATERIALIZED VIEWS (For Dashboard & Reports)
-- ============================================================

-- Sales Dashboard Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_dashboard_sales AS
WITH date_range AS (
    SELECT CURRENT_DATE - INTERVAL '30 days' as start_date,
           CURRENT_DATE as end_date
),
daily_sales AS (
    SELECT 
        DATE_TRUNC('day', i.invoice_date) as sale_date,
        COUNT(DISTINCT i.id) as order_count,
        COALESCE(SUM(i.total_amount), 0) as revenue,
        COALESCE(SUM(i.tax_amount), 0) as tax,
        COUNT(DISTINCT i.customer_id) as customer_count
    FROM invoices i
    WHERE i.invoice_date >= (SELECT start_date FROM date_range)
    AND i.invoice_date <= (SELECT end_date FROM date_range)
    AND i.status != 'Đã hủy'
    GROUP BY DATE_TRUNC('day', i.invoice_date)
)
SELECT 
    sale_date,
    order_count,
    revenue,
    tax,
    customer_count,
    AVG(revenue) OVER (ORDER BY sale_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as revenue_7d_avg,
    SUM(order_count) OVER (ORDER BY sale_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_orders,
    SUM(revenue) OVER (ORDER BY sale_date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as cumulative_revenue
FROM daily_sales
ORDER BY sale_date DESC;

-- Add indexes for Materialized View
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_dashboard_sales_date ON mv_dashboard_sales(sale_date);

-- Inventory Alert Materialized View
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_alerts AS
SELECT 
    p.id as product_id,
    p.code,
    p.name_vi,
    sb.warehouse_id,
    w.name_vi as warehouse_name,
    sb.quantity as current_stock,
    p.min_stock as reorder_point,
    (p.min_stock - sb.quantity) as shortage_quantity,
    CASE 
        WHEN sb.quantity = 0 THEN 'OUT_OF_STOCK'
        WHEN sb.quantity <= p.min_stock * 0.5 THEN 'CRITICAL'
        WHEN sb.quantity <= p.min_stock THEN 'LOW'
        ELSE 'OK'
    END as alert_level,
    CASE 
        WHEN sb.quantity = 0 THEN 4
        WHEN sb.quantity <= p.min_stock * 0.5 THEN 3
        WHEN sb.quantity <= p.min_stock THEN 2
        ELSE 1
    END as priority
FROM products p
JOIN stock_balances sb ON p.id = sb.product_id
JOIN warehouses w ON sb.warehouse_id = w.id
WHERE sb.quantity <= p.min_stock
AND p.is_active = TRUE;

-- Index for materialized view
CREATE INDEX IF NOT EXISTS idx_mv_inventory_alerts_priority ON mv_inventory_alerts(priority, alert_level);

-- Refresh Materialized Views
CREATE OR REPLACE FUNCTION refresh_dashboard_mvs()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dashboard_sales;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_inventory_alerts;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. READ MODELS (Separate from Transaction Tables)
-- ============================================================

-- Sales Read Model
CREATE TABLE IF NOT EXISTS read_sales_summary (
    id SERIAL PRIMARY KEY,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_orders INT DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    total_cogs NUMERIC(15,2) DEFAULT 0,
    total_profit NUMERIC(15,2) DEFAULT 0,
    total_tax NUMERIC(15,2) DEFAULT 0,
    unique_customers INT DEFAULT 0,
    avg_order_value NUMERIC(15,2) DEFAULT 0,
    top_product_id INT,
    top_product_revenue NUMERIC(15,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_read_sales_summary UNIQUE(period_type, period_start)
);

-- Customer Read Model
CREATE TABLE IF NOT EXISTS read_customer_summary (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL,
    customer_code VARCHAR(30),
    customer_name VARCHAR(200),
    total_orders INT DEFAULT 0,
    total_revenue NUMERIC(15,2) DEFAULT 0,
    total_paid NUMERIC(15,2) DEFAULT 0,
    current_debt NUMERIC(15,2) DEFAULT 0,
    avg_order_value NUMERIC(15,2) DEFAULT 0,
    last_order_date DATE,
    customer_segment VARCHAR(20) CHECK (customer_segment IN ('VIP', 'HIGH', 'MEDIUM', 'LOW', 'NEW')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_read_customer_summary UNIQUE(customer_id)
);

-- Inventory Read Model
CREATE TABLE IF NOT EXISTS read_inventory_summary (
    id SERIAL PRIMARY KEY,
    product_id INT NOT NULL,
    product_code VARCHAR(50),
    product_name_vi VARCHAR(200),
    warehouse_id INT,
    current_stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    available_stock INT DEFAULT 0,
    reorder_point INT DEFAULT 0,
    days_until_out_of_stock INT,
    stock_turnover_ratio NUMERIC(10,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_read_inventory_summary UNIQUE(product_id, warehouse_id)
);

-- ============================================================
-- 11. FUNCTION TO REFRESH READ MODELS
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_read_models()
RETURNS VOID AS $$
BEGIN
    -- Refresh Sales Summary
    INSERT INTO read_sales_summary (
        period_type, period_start, period_end,
        total_orders, total_revenue, total_cogs, total_profit, total_tax,
        unique_customers, avg_order_value
    )
    SELECT 
        'MONTHLY' as period_type,
        DATE_TRUNC('month', i.invoice_date) as period_start,
        DATE_TRUNC('month', i.invoice_date) + INTERVAL '1 month - 1 day' as period_end,
        COUNT(DISTINCT i.id) as total_orders,
        COALESCE(SUM(i.total_amount), 0) as total_revenue,
        COALESCE(SUM(ii.quantity * ii.unit_price * 0.7), 0) as total_cogs, -- Estimated
        COALESCE(SUM(i.total_amount - (ii.quantity * ii.unit_price * 0.7)), 0) as total_profit,
        COALESCE(SUM(i.tax_amount), 0) as total_tax,
        COUNT(DISTINCT i.customer_id) as unique_customers,
        COALESCE(AVG(i.total_amount), 0) as avg_order_value
    FROM invoices i
    LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
    WHERE i.invoice_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '12 months')
    AND i.status != 'Đã hủy'
    GROUP BY DATE_TRUNC('month', i.invoice_date)
    ON CONFLICT (period_type, period_start) 
    DO UPDATE SET
        period_end = EXCLUDED.period_end,
        total_orders = EXCLUDED.total_orders,
        total_revenue = EXCLUDED.total_revenue,
        total_cogs = EXCLUDED.total_cogs,
        total_profit = EXCLUDED.total_profit,
        total_tax = EXCLUDED.total_tax,
        unique_customers = EXCLUDED.unique_customers,
        avg_order_value = EXCLUDED.avg_order_value,
        updated_at = CURRENT_TIMESTAMP;

    -- Refresh Customer Summary
    INSERT INTO read_customer_summary (
        customer_id, customer_code, customer_name,
        total_orders, total_revenue, total_paid, current_debt,
        avg_order_value, last_order_date, customer_segment
    )
    SELECT 
        c.id,
        c.code,
        c.name,
        COUNT(DISTINCT i.id) as total_orders,
        COALESCE(SUM(i.total_amount), 0) as total_revenue,
        COALESCE(SUM(rp.amount), 0) as total_paid,
        COALESCE(SUM(i.total_amount - rp.amount), 0) as current_debt,
        COALESCE(AVG(i.total_amount), 0) as avg_order_value,
        MAX(i.invoice_date) as last_order_date,
        CASE 
            WHEN COALESCE(SUM(i.total_amount), 0) > 1000000000 THEN 'VIP'
            WHEN COALESCE(SUM(i.total_amount), 0) > 100000000 THEN 'HIGH'
            WHEN COALESCE(SUM(i.total_amount), 0) > 10000000 THEN 'MEDIUM'
            WHEN COALESCE(SUM(i.total_amount), 0) > 0 THEN 'LOW'
            ELSE 'NEW'
        END as customer_segment
    FROM customers c
    LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'Đã hủy'
    LEFT JOIN receipts_payments rp ON c.id = rp.partner_id AND rp.partner_type = 'KHACH_HANG' AND rp.voucher_type = 'THU'
    GROUP BY c.id, c.code, c.name
    ON CONFLICT (customer_id) 
    DO UPDATE SET
        total_orders = EXCLUDED.total_orders,
        total_revenue = EXCLUDED.total_revenue,
        total_paid = EXCLUDED.total_paid,
        current_debt = EXCLUDED.current_debt,
        avg_order_value = EXCLUDED.avg_order_value,
        last_order_date = EXCLUDED.last_order_date,
        customer_segment = EXCLUDED.customer_segment,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. ARCHIVE STRATEGY
-- ============================================================

-- Archive Tables (Separate Schema for Archiving)
CREATE SCHEMA IF NOT EXISTS archive;

-- Function to archive old data
CREATE OR REPLACE FUNCTION archive_transaction_data()
RETURNS VOID AS $$
DECLARE
    archive_date DATE := CURRENT_DATE - INTERVAL '2 years';
BEGIN
    -- Archive Stock Movements
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS archive.stock_movements_%s 
        AS SELECT * FROM stock_movements 
        WHERE movement_date < %L
    ', TO_CHAR(CURRENT_DATE, 'YYYY'), archive_date);
    
    -- Archive Journal Entries
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS archive.journal_entries_%s 
        AS SELECT * FROM journal_entries 
        WHERE entry_date < %L
    ', TO_CHAR(CURRENT_DATE, 'YYYY'), archive_date);
    
    -- Archive Invoices
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS archive.invoices_%s 
        AS SELECT * FROM invoices 
        WHERE invoice_date < %L
    ', TO_CHAR(CURRENT_DATE, 'YYYY'), archive_date);
    
    -- Delete old data (in batch to avoid long locks)
    WITH deleted AS (
        DELETE FROM stock_movements 
        WHERE movement_date < archive_date 
        AND id IN (
            SELECT id FROM stock_movements 
            WHERE movement_date < archive_date 
            LIMIT 10000
        )
        RETURNING *
    )
    INSERT INTO archive.stock_movements_deleted 
    SELECT * FROM deleted;
    
    WITH deleted AS (
        DELETE FROM journal_entries 
        WHERE entry_date < archive_date 
        AND id IN (
            SELECT id FROM journal_entries 
            WHERE entry_date < archive_date 
            LIMIT 10000
        )
        RETURNING *
    )
    INSERT INTO archive.journal_entries_deleted 
    SELECT * FROM deleted;
    
    WITH deleted AS (
        DELETE FROM invoices 
        WHERE invoice_date < archive_date 
        AND id IN (
            SELECT id FROM invoices 
            WHERE invoice_date < archive_date 
            LIMIT 10000
        )
        RETURNING *
    )
    INSERT INTO archive.invoices_deleted 
    SELECT * FROM deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. PERFORMANCE MONITORING VIEWS
-- ============================================================

-- View for query performance monitoring
CREATE OR REPLACE VIEW vw_query_performance AS
SELECT 
    queryid,
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time,
    rows,
    shared_blks_hit,
    shared_blks_read
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 50;

-- View for table size monitoring
CREATE OR REPLACE VIEW vw_table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================
-- 14. TRIGGERS FOR SUMMARY TABLES
-- ============================================================

-- Trigger to update daily sales summary
CREATE OR REPLACE FUNCTION update_sales_summary()
RETURNS TRIGGER AS $$
BEGIN
    -- Update daily summary
    INSERT INTO sales_summary_daily (summary_date, total_orders, total_revenue, total_tax)
    VALUES (
        NEW.invoice_date,
        1,
        NEW.total_amount,
        NEW.tax_amount
    )
    ON CONFLICT (summary_date) 
    DO UPDATE SET
        total_orders = sales_summary_daily.total_orders + 1,
        total_revenue = sales_summary_daily.total_revenue + NEW.total_amount,
        total_tax = sales_summary_daily.total_tax + NEW.tax_amount,
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_sales_summary
AFTER INSERT ON invoices
FOR EACH ROW
WHEN (NEW.status != 'Đã hủy')
EXECUTE FUNCTION update_sales_summary();

-- ============================================================
-- 15. INITIAL SEED DATA (With duplicate prevention)
-- ============================================================

INSERT INTO companies (id, code, name_vi, name_en, tax_code, address, phone, email, website) 
SELECT 1, 'ERPACC_VN', 'Công Ty Cổ Phần Công Nghệ ERPACC Việt Nam', 'ERPACC Technology Vietnam JSC', '0109988776', 'Tầng 12, Tòa nhà Landmark 81, Bình Thạnh, TP.HCM', '028.7300.9999', 'info@erpacc.vn', 'https://erpacc.vn'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE id = 1);

INSERT INTO branches (id, company_id, code, name_vi, name_en, address, phone, is_headquarter) 
SELECT 1, 1, 'HO_HCM', 'Trụ Sở Chính TP.Hồ Chí Minh', 'Ho Chi Minh Headquarters', 'Bình Thạnh, TP.HCM', '028.7300.9999', TRUE
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE id = 1);

-- Reset sequences
SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 1)) FROM companies;
SELECT setval(pg_get_serial_sequence('branches', 'id'), COALESCE(MAX(id), 1)) FROM branches;
SELECT setval(pg_get_serial_sequence('sys_users', 'id'), COALESCE(MAX(id), 1)) FROM sys_users;
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE(MAX(id), 1)) FROM customers;
SELECT setval(pg_get_serial_sequence('suppliers', 'id'), COALESCE(MAX(id), 1)) FROM suppliers;
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;
SELECT setval(pg_get_serial_sequence('warehouses', 'id'), COALESCE(MAX(id), 1)) FROM warehouses;

-- ============================================================
-- END OF ULTIMATE OPTIMIZED SCHEMA
-- ============================================================