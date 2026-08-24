-- ============================================================
-- SCHEMAS & DATABASE STRUCTURE FOR ERPACC & WEBSHOP (PostgreSQL)
-- Complete Enterprise Resource Planning (ERP) + Accounting TT200
-- + Inventory + Sales + Purchasing + CRM + Webshop + Security
-- ============================================================
--
-- SOURCE OF TRUTH: đây là file schema duy nhất được auto-migrate cho DB mới.
-- Mọi thay đổi DB dần dần (delta) thực hiện qua hệ thống migration có phiên bản
-- trong src/db/index.ts (runMigrations + bảng schema_migrations), KHÔNG sửa trực
-- tiếp file này đối với DB đã tồn tại dữ liệu.
-- Các file schema cũ đã được chuyển sang thư mục archive/ (deprecated).

-- Drop views in reverse dependency order
DROP VIEW IF EXISTS vw_webshop_conversion_metrics CASCADE;
DROP VIEW IF EXISTS vw_purchase_cost_variance CASCADE;
DROP VIEW IF EXISTS vw_expired_batches_alert CASCADE;
DROP VIEW IF EXISTS vw_top_selling_products CASCADE;
DROP VIEW IF EXISTS vw_sales_commission_report CASCADE;
DROP VIEW IF EXISTS vw_order_fulfillment_status CASCADE;
DROP VIEW IF EXISTS vw_cash_flow_statement CASCADE;
DROP VIEW IF EXISTS vw_fixed_asset_depreciation_schedule CASCADE;
DROP VIEW IF EXISTS vw_crm_pipeline_summary CASCADE;
DROP VIEW IF EXISTS vw_inventory_valuation_fifo CASCADE;
DROP VIEW IF EXISTS vw_daily_revenue CASCADE;
DROP VIEW IF EXISTS vw_kpi_overview CASCADE;
DROP VIEW IF EXISTS vw_trial_balance_tt200 CASCADE;
DROP VIEW IF EXISTS vw_vat_tax_filing CASCADE;
DROP VIEW IF EXISTS vw_sales_performance CASCADE;
DROP VIEW IF EXISTS vw_supplier_payable_summary CASCADE;
DROP VIEW IF EXISTS vw_customer_debt_summary CASCADE;
DROP VIEW IF EXISTS vw_product_stock_summary CASCADE;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS sys_audit_details CASCADE;
DROP TABLE IF EXISTS sys_audit_logs CASCADE;
DROP TABLE IF EXISTS sys_login_history CASCADE;
DROP TABLE IF EXISTS sys_user_sessions CASCADE;
DROP TABLE IF EXISTS oauth_clients CASCADE;

DROP TABLE IF EXISTS web_banners CASCADE;
DROP TABLE IF EXISTS web_shipping CASCADE;
DROP TABLE IF EXISTS web_payments CASCADE;
DROP TABLE IF EXISTS web_product_reviews CASCADE;
DROP TABLE IF EXISTS web_wishlist_items CASCADE;
DROP TABLE IF EXISTS web_wishlists CASCADE;
DROP TABLE IF EXISTS web_order_items CASCADE;
DROP TABLE IF EXISTS web_orders CASCADE;
DROP TABLE IF EXISTS web_cart_items CASCADE;
DROP TABLE IF EXISTS web_carts CASCADE;
DROP TABLE IF EXISTS web_promotions CASCADE;
DROP TABLE IF EXISTS web_customers CASCADE;

DROP TABLE IF EXISTS crm_activities CASCADE;
DROP TABLE IF EXISTS crm_contacts CASCADE;
DROP TABLE IF EXISTS crm_opportunities CASCADE;
DROP TABLE IF EXISTS crm_leads CASCADE;

DROP TABLE IF EXISTS asset_depreciations CASCADE;
DROP TABLE IF EXISTS fixed_assets CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS journal_entry_lines CASCADE;
DROP TABLE IF EXISTS journal_entries CASCADE;
DROP TABLE IF EXISTS receipts_payments CASCADE;
DROP TABLE IF EXISTS vat_declarations CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS tax_codes CASCADE;
DROP TABLE IF EXISTS accounting_periods CASCADE;
DROP TABLE IF EXISTS fiscal_years CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;

DROP TABLE IF EXISTS purchase_return_items CASCADE;
DROP TABLE IF EXISTS purchase_returns CASCADE;
DROP TABLE IF EXISTS purchase_receipt_items CASCADE;
DROP TABLE IF EXISTS purchase_receipts CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
DROP TABLE IF EXISTS supplier_quotation_items CASCADE;
DROP TABLE IF EXISTS supplier_quotations CASCADE;
DROP TABLE IF EXISTS purchase_rfq_items CASCADE;
DROP TABLE IF EXISTS purchase_rfqs CASCADE;
DROP TABLE IF EXISTS purchase_request_items CASCADE;
DROP TABLE IF EXISTS purchase_requests CASCADE;

DROP TABLE IF EXISTS sales_commissions CASCADE;
DROP TABLE IF EXISTS sales_return_items CASCADE;
DROP TABLE IF EXISTS sales_returns CASCADE;
DROP TABLE IF EXISTS sales_delivery_items CASCADE;
DROP TABLE IF EXISTS sales_deliveries CASCADE;
DROP TABLE IF EXISTS sales_order_items CASCADE;
DROP TABLE IF EXISTS sales_orders CASCADE;
DROP TABLE IF EXISTS quotation_items CASCADE;
DROP TABLE IF EXISTS quotations CASCADE;

DROP TABLE IF EXISTS fifo_cost_layers CASCADE;
DROP TABLE IF EXISTS stock_reservations CASCADE;
DROP TABLE IF EXISTS stock_adjustment_items CASCADE;
DROP TABLE IF EXISTS stock_adjustments CASCADE;
DROP TABLE IF EXISTS stock_transfer_items CASCADE;
DROP TABLE IF EXISTS stock_transfers CASCADE;
DROP TABLE IF EXISTS serial_numbers CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS stocktaking_items CASCADE;
DROP TABLE IF EXISTS stocktaking_sessions CASCADE;
DROP TABLE IF EXISTS stock_balances CASCADE;
DROP TABLE IF EXISTS stock_movement_items CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS warehouse_locations CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;

DROP TABLE IF EXISTS product_cost_history CASCADE;
DROP TABLE IF EXISTS supplier_prices CASCADE;
DROP TABLE IF EXISTS price_list_items CASCADE;
DROP TABLE IF EXISTS price_lists CASCADE;
DROP TABLE IF EXISTS product_attributes CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS brands CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS uom_conversions CASCADE;
DROP TABLE IF EXISTS uom CASCADE;

DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS customer_groups CASCADE;

DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS document_sequences CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS currencies CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS tenant_workspaces CASCADE;
DROP TABLE IF EXISTS companies CASCADE;

DROP TABLE IF EXISTS sys_user_roles CASCADE;
DROP TABLE IF EXISTS sys_users CASCADE;
DROP TABLE IF EXISTS sys_role_permissions CASCADE;
DROP TABLE IF EXISTS sys_permissions CASCADE;
DROP TABLE IF EXISTS sys_roles CASCADE;
DROP TABLE IF EXISTS sys_menus CASCADE;
DROP TABLE IF EXISTS sys_translations CASCADE;
DROP TABLE IF EXISTS sys_languages CASCADE;
DROP TABLE IF EXISTS sys_settings CASCADE;

-- Helper Function for Automatic Timestamp Updating
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- 1. CORE DATABASE & MULTI-TENANCY / MULTI-BRANCH STRUCTURE
-- ------------------------------------------------------------
CREATE TABLE companies (
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
    slug VARCHAR(50) UNIQUE,
    subdomain VARCHAR(50) UNIQUE,
    custom_domain VARCHAR(100) UNIQUE,
    plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'professional', 'enterprise')),
    subscription_status VARCHAR(20) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled', 'suspended')),
    trial_ends_at TIMESTAMP,
    settings JSONB DEFAULT '{}',
    max_users INT DEFAULT 5,
    max_warehouses INT DEFAULT 3,
    is_paused BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- Chỉ tenant được đánh dấu rõ ràng mới được dùng ở storefront root (/).
    -- Không suy đoán tenant mặc định bằng id = 1.
    is_default_shop BOOLEAN DEFAULT FALSE,
    owner_user_id INT,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO companies (id, code, name_vi, name_en, tax_code, address, phone, email, website, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_active, is_default_shop) VALUES
(1, 'ERPACC_VN', 'Công Ty Cổ Phần Công Nghệ ERPACC Việt Nam', 'ERPACC Technology Vietnam JSC', '0109988776', 'Tầng 12, Tòa nhà Landmark 81, Bình Thạnh, TP.HCM', '028.7300.9999', 'info@erpacc.vn', 'https://erpacc.vn', 'erpacc-vn', 'erpacc', 'enterprise', 'active', NULL, 50, 10, TRUE, TRUE);

-- Mỗi tenant có một workspace ERP và một storefront WebShop riêng. Các slug
-- này là dữ liệu tenant, không phải giá trị mặc định hard-code trong ứng dụng.
CREATE TABLE tenant_workspaces (
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
);

INSERT INTO tenant_workspaces (
    company_id, workspace_slug, workspace_name_vi, workspace_name_en,
    webshop_slug, webshop_name_vi, webshop_name_en
) VALUES (
    1, 'erpacc-vn', 'Không gian làm việc ERPACC Việt Nam',
    'ERPACC Vietnam workspace', 'erpacc-vn', 'WebShop ERPACC Việt Nam',
    'ERPACC Vietnam WebShop'
);

CREATE TABLE branches (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200),
    address VARCHAR(255),
    phone VARCHAR(50),
    is_headquarter BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_branch_company_code UNIQUE(company_id, code)
);

INSERT INTO branches (id, company_id, code, name_vi, name_en, address, phone, is_headquarter) VALUES
(1, 1, 'HO_HCM', 'Trụ Sở Chính TP.Hồ Chí Minh', 'Ho Chi Minh Headquarters', 'Bình Thạnh, TP.HCM', '028.7300.9999', TRUE),
(2, 1, 'BR_HN', 'Chi Nhánh Hà Nội', 'Hanoi Branch Office', 'Cầu Giấy, Hà Nội', '024.7300.8888', FALSE);

CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,
    name_vi VARCHAR(150) NOT NULL,
    name_en VARCHAR(150),
    manager_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO departments (id, branch_id, code, name_vi, name_en, manager_name) VALUES
(1, 1, 'DEPT_BGD', 'Ban Giám Đốc', 'Board of Directors', 'Nguyễn Văn Quản Trị'),
(2, 1, 'DEPT_KT', 'Phòng Tài Chính Kế Toán', 'Finance & Accounting', 'Trần Thị Thu Kế Toán'),
(3, 1, 'DEPT_KHO', 'Bộ Phận Kho & Logistics', 'Warehouse & Logistics', 'Lê Hoàng Minh Thủ Kho'),
(4, 1, 'DEPT_KD', 'Phòng Kinh Doanh', 'Sales & Marketing', 'Phạm Ngọc Anh Sale');

CREATE TABLE currencies (
    code VARCHAR(10) PRIMARY KEY, -- 'VND', 'USD', 'EUR', 'JPY'
    name_vi VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL,
    symbol VARCHAR(10),
    decimal_places INT DEFAULT 0,
    is_base BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO currencies (code, name_vi, name_en, symbol, decimal_places, is_base) VALUES
('VND', 'Đồng Việt Nam', 'Vietnamese Dong', '₫', 0, TRUE),
('USD', 'Đô-la Mỹ', 'US Dollar', '$', 2, FALSE),
('EUR', 'Đồng Euro', 'Euro', '€', 2, FALSE);

CREATE TABLE exchange_rates (
    id SERIAL PRIMARY KEY,
    currency_code VARCHAR(10) REFERENCES currencies(code),
    effective_date DATE NOT NULL,
    rate NUMERIC(18, 6) NOT NULL CHECK (rate > 0),
    source VARCHAR(50) DEFAULT 'Vietcombank',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_currency_date UNIQUE(currency_code, effective_date)
);

INSERT INTO exchange_rates (currency_code, effective_date, rate) VALUES
('USD', '2026-08-01', 25450.000000),
('EUR', '2026-08-01', 27600.000000);

CREATE TABLE document_sequences (
    id SERIAL PRIMARY KEY,
    branch_id INT REFERENCES branches(id),
    doc_type VARCHAR(50) NOT NULL, -- 'SALES_ORDER', 'INVOICE', 'STOCK_IN', 'STOCK_OUT', 'PURCHASE_ORDER'
    prefix VARCHAR(20) NOT NULL,
    current_number INT DEFAULT 1,
    padding INT DEFAULT 6,
    suffix VARCHAR(20) DEFAULT '',
    reset_frequency VARCHAR(20) DEFAULT 'YEARLY', -- 'NEVER', 'YEARLY', 'MONTHLY'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO document_sequences (branch_id, doc_type, prefix, current_number) VALUES
(1, 'SALES_ORDER', 'SO-2026-', 100),
(1, 'INVOICE', 'HD-2026-', 50),
(1, 'STOCK_IN', 'NK-2026-', 120),
(1, 'STOCK_OUT', 'XK-2026-', 110),
(1, 'PURCHASE_ORDER', 'PO-2026-', 80);

CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL, -- 'PRODUCTS', 'INVOICES', 'PURCHASE_ORDERS'
    entity_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes INT,
    file_type VARCHAR(50),
    uploaded_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT,
    title_vi VARCHAR(255) NOT NULL,
    title_en VARCHAR(255),
    content_vi TEXT,
    content_en TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    link_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 2. MULTI-LANGUAGE SYSTEM & DICTIONARY
-- ------------------------------------------------------------
CREATE TABLE sys_languages (
    code VARCHAR(10) PRIMARY KEY, -- 'vi', 'en'
    name VARCHAR(50) NOT NULL,
    flag_icon VARCHAR(50),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sys_languages (code, name, flag_icon, is_default, is_active) VALUES
('vi', 'Tiếng Việt', '🇻🇳', TRUE, TRUE),
('en', 'English', '🇬🇧', FALSE, TRUE);

CREATE TABLE sys_translations (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    vi_text TEXT NOT NULL,
    en_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_translation_key UNIQUE(key_name)
);

INSERT INTO sys_translations (key_name, category, vi_text, en_text) VALUES
('app_title', 'common', 'Hệ Thống ERPACC & Webshop Enterprise', 'ERPACC Enterprise & Webshop System'),
('dashboard', 'navigation', 'Bảng Điều Khiển Tổng Quan', 'Main Dashboard'),
('products', 'navigation', 'Danh Mục Hàng Hóa & Vật Tư', 'Products & Inventory Catalog'),
('inventory', 'navigation', 'Quản Lý Kho & Kiểm Kê', 'Warehouse & Stocktaking'),
('sales', 'navigation', 'Bán Hàng & Đơn Hàng Web', 'Sales & WebShop Orders'),
('purchasing', 'navigation', 'Mua Hàng & Nhà Cung Cấp', 'Purchasing & Suppliers'),
('accounting', 'navigation', 'Sổ Sách Kế Toán TT200 & Thuế', 'TT200 Accounting & Tax Filing'),
('settings', 'navigation', 'Cấu Hình Hệ Thống & Doanh Nghiệp', 'System Settings & Enterprise');

CREATE TABLE sys_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value TEXT,
    description VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sys_settings (setting_key, setting_value, description) VALUES
('company_name', 'Công Ty Cổ Phần Công Nghệ ERPACC Việt Nam', 'Tên doanh nghiệp chính thức'),
('tax_code', '0109988776', 'Mã số thuế doanh nghiệp'),
('default_vat_rate', '10', 'Thế suất GTGT mặc định (%)'),
('allow_negative_stock', 'false', 'Cho phép xuất âm kho bãi (true/false)'),
('costing_method', 'FIFO', 'Phương pháp tính giá xuất kho: FIFO / AVERAGE');

-- ------------------------------------------------------------
-- 3. USERS, ROLES, MATRIX PERMISSIONS & AUDIT
-- ------------------------------------------------------------
CREATE TABLE sys_roles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sys_roles (id, code, name_vi, name_en, description, is_system) VALUES
(1, 'ADMIN', 'Quản Trị Viên (Admin)', 'System Administrator', 'Toàn quyền truy cập và cài đặt ma trận RBAC', TRUE),
(2, 'MANAGER', 'Quản Lý Doanh Nghiệp (Manager)', 'General Manager', 'Quản lý toàn bộ kinh doanh, kho bãi và tài chính', TRUE),
(3, 'ACCOUNTANT', 'Kế Toán Trưởng (Chief Accountant)', 'Chief Accountant', 'Phụ trách công nợ, thu chi, VAT và sổ sách TT200', TRUE),
(4, 'WAREHOUSE', 'Thủ Kho (Warehouse Keeper)', 'Warehouse Keeper', 'Chuyên trách xuất nhập kho, chuyển kho và kiểm kê', TRUE),
(5, 'SALES', 'Nhân Viên Bán Hàng (Sales Executive)', 'Sales Executive', 'Tạo báo giá, đơn hàng và tra cứu danh mục', TRUE);

CREATE TABLE sys_permissions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL, -- e.g. 'products:view', 'products:create'
    module_code VARCHAR(50) NOT NULL,
    action_code VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'delete', 'export', 'approve'
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL
);

INSERT INTO sys_permissions (code, module_code, action_code, name_vi, name_en) VALUES
('products:view', 'products', 'view', 'Xem danh mục sản phẩm', 'View products'),
('products:create', 'products', 'create', 'Thêm mới sản phẩm', 'Create product'),
('products:edit', 'products', 'edit', 'Sửa thông tin sản phẩm', 'Edit product'),
('products:delete', 'products', 'delete', 'Xóa sản phẩm', 'Delete product'),
('products:export', 'products', 'export', 'Xuất Excel sản phẩm', 'Export products'),
('products:approve', 'products', 'approve', 'Duyệt bảng giá sản phẩm', 'Approve price list');

CREATE TABLE sys_role_permissions (
    role_id INT REFERENCES sys_roles(id) ON DELETE CASCADE,
    permission_code VARCHAR(100) REFERENCES sys_permissions(code) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_code)
);

INSERT INTO sys_role_permissions (role_id, permission_code) VALUES
(1, 'products:view'), (1, 'products:create'), (1, 'products:edit'), (1, 'products:delete'), (1, 'products:export'), (1, 'products:approve'),
(2, 'products:view'), (2, 'products:create'), (2, 'products:edit'), (2, 'products:export'),
(3, 'products:view'), (3, 'products:export');

CREATE TABLE sys_users (
    id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(id) DEFAULT 1,
    branch_id INT REFERENCES branches(id) DEFAULT 1,
    department_id INT REFERENCES departments(id),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role_id INT REFERENCES sys_roles(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'disabled')),
    preferred_lang VARCHAR(10) DEFAULT 'vi',
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sys_users (id, company_id, branch_id, department_id, username, email, password_hash, full_name, phone, role_id, preferred_lang) VALUES
(1, 1, 1, 1, 'admin', 'admin@erpacc.vn', '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.', 'Nguyễn Văn Quản Trị', '0912345678', 1, 'vi'),
(2, 1, 1, 2, 'accountant1', 'ketoan.tran@erpacc.vn', '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.', 'Trần Thị Thu Kế Toán', '0911223344', 3, 'vi'),
(3, 1, 1, 3, 'thukho1', 'thukho.le@erpacc.vn', '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.', 'Lê Hoàng Minh Thủ Kho', '0903555666', 4, 'vi'),
(4, 1, 1, 4, 'sales1', 'saler.pham@erpacc.vn', '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.', 'Phạm Ngọc Anh Sale', '0977888999', 5, 'en');

-- admin nền tảng ERPACC (quản lý MỌI tenant). Admin của từng tenant (tạo qua
-- /tenants/register) giữ is_super_admin = FALSE.
UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin';

ALTER TABLE companies ADD CONSTRAINT fk_companies_owner_user FOREIGN KEY (owner_user_id) REFERENCES sys_users(id) ON DELETE SET NULL;

CREATE TABLE sys_user_roles (
    user_id INT REFERENCES sys_users(id) ON DELETE CASCADE,
    role_id INT REFERENCES sys_roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

INSERT INTO sys_user_roles (user_id, role_id) VALUES
(1, 1), (2, 3), (3, 4), (4, 5);

CREATE TABLE sys_menus (
    id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES sys_menus(id) ON DELETE SET NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    title_vi VARCHAR(100) NOT NULL,
    title_en VARCHAR(100) NOT NULL,
    icon_name VARCHAR(50),
    path_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO sys_menus (id, parent_id, code, title_vi, title_en, icon_name, path_url, sort_order) VALUES
(1, NULL, 'dashboard', 'Bảng Điều Khiển', 'Dashboard', 'LayoutDashboard', '/saas/dashboard', 1),
(2, NULL, 'products', 'Danh Mục Sản Phẩm', 'Products', 'Package', '/saas/products', 2),
(3, NULL, 'inventory', 'Nhập Xuất Kho', 'Inventory', 'Boxes', '/saas/inventory', 3),
(4, NULL, 'stocktaking', 'Kiểm Kê Kho', 'Stocktaking', 'ClipboardCheck', '/saas/stocktaking', 4),
(5, NULL, 'debt_finance', 'Công Nợ & Thu Chi', 'Debt & Finance', 'Receipt', '/saas/debt-finance', 5),
(6, NULL, 'vat_accounting', 'Thuế & Sổ Kế Toán', 'VAT & Accounting', 'Calculator', '/saas/vat-accounting', 6),
(7, NULL, 'web_orders', 'Đơn Hàng WebShop', 'WebShop Orders', 'ShoppingCart', '/saas/orders', 7),
(8, NULL, 'settings', 'Cấu Hình Hệ Thống', 'Settings', 'Settings', '/saas/settings', 8);

CREATE TABLE oauth_clients (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(100) UNIQUE NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    client_name VARCHAR(100) NOT NULL,
    redirect_uri VARCHAR(255) NOT NULL,
    grant_types VARCHAR(100) DEFAULT 'authorization_code,refresh_token',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sys_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_login_history (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sys_users(id) ON DELETE SET NULL,
    username VARCHAR(50),
    login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50),
    status VARCHAR(20), -- 'SUCCESS', 'FAILED_PASSWORD', 'LOCKED'
    failure_reason VARCHAR(255)
);

CREATE TABLE sys_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES sys_users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'APPROVE'
    entity_name VARCHAR(50) NOT NULL,
    entity_id VARCHAR(50),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sys_audit_details (
    id SERIAL PRIMARY KEY,
    audit_log_id INT REFERENCES sys_audit_logs(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT
);

-- ------------------------------------------------------------
-- 4. PARTNERS & MASTER DATA (CUSTOMERS, SUPPLIERS, PRODUCTS)
-- ------------------------------------------------------------
CREATE TABLE customer_groups (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    discount_percent NUMERIC(5,2) DEFAULT 0.00
);

INSERT INTO customer_groups (id, code, name_vi, name_en, discount_percent) VALUES
(1, 'GRP_VIP', 'Khách Hàng VIP Enterprise', 'VIP Enterprise Customers', 5.00),
(2, 'GRP_RETAIL', 'Khách Hàng Lẻ', 'Retail Customers', 0.00),
(3, 'GRP_WHOLESALE', 'Đại Lý Phân Phối', 'Wholesale Distributors', 10.00);

CREATE TABLE customers (
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
);

INSERT INTO customers (id, group_id, code, name, tax_code, phone, email, address, credit_limit) VALUES
(1, 1, 'KH-001', 'Công Ty TNHH Xây Dựng Nam Phát', '0311223344', '0908111222', 'contact@namphat.vn', 'Số 45 Lê Duẩn, Q.1, TP.HCM', 200000000),
(2, 2, 'KH-002', 'Cửa Hàng Vật Tư Bách Khoa', '0322334455', '0918333444', 'bachkhoa@gmail.com', '123 Lý Thường Kiệt, Q.10, TP.HCM', 50000000);

CREATE TABLE suppliers (
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
);

INSERT INTO suppliers (id, code, name, tax_code, phone, email, address, bank_account, bank_name) VALUES
(1, 'NCC-001', 'Tập Đoàn Thép Hòa Phát', '0100508888', '024.3974.7777', 'sales@hoaphat.com.vn', '64 Nguyễn Du, Hai Bà Trưng, Hà Nội', '1120000888', 'VietinBank'),
(2, 'NCC-002', 'Công Ty Xi Măng Hà Tiên 1', '0300481111', '028.3829.1111', 'info@hatien1.com.vn', '360 Bến Vân Đồn, Q.4, TP.HCM', '2230000999', 'Vietcombank');

CREATE TABLE uom (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name_vi VARCHAR(50) NOT NULL,
    name_en VARCHAR(50) NOT NULL
);

INSERT INTO uom (id, code, name_vi, name_en) VALUES
(1, 'CAI', 'Cái / Chiếc', 'Piece'),
(2, 'KG', 'Ki-lo-gam', 'Kilogram'),
(3, 'TAN', 'Tấn', 'Metric Ton'),
(4, 'BAO', 'Bao 50kg', 'Bag 50kg'),
(5, 'MET', 'Mét dài', 'Meter');

CREATE TABLE uom_conversions (
    id SERIAL PRIMARY KEY,
    from_uom_id INT REFERENCES uom(id) ON DELETE CASCADE,
    to_uom_id INT REFERENCES uom(id) ON DELETE CASCADE,
    conversion_factor NUMERIC(12, 6) NOT NULL CHECK (conversion_factor > 0),
    CONSTRAINT uq_uom_conv UNIQUE(from_uom_id, to_uom_id)
);

INSERT INTO uom_conversions (from_uom_id, to_uom_id, conversion_factor) VALUES
(3, 2, 1000.000000), -- 1 Tấn = 1000 Kg
(4, 2, 50.000000);   -- 1 Bao = 50 Kg

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    parent_id INT REFERENCES categories(id) ON DELETE SET NULL,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    image_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO categories (id, parent_id, code, name_vi, name_en, sort_order) VALUES
(1, NULL, 'CAT_THEP', 'Thép & Kim Loại Xây Dựng', 'Steel & Metals', 1),
(2, NULL, 'CAT_XIMANG', 'Xi Măng & Bê Tông', 'Cement & Concrete', 2),
(3, NULL, 'CAT_GACH', 'Gạch & Đá Ốp Lót', 'Tiles & Bricks', 3),
(4, NULL, 'CAT_DIENNUOC', 'Thiết Bị Điện & Nước', 'Electrical & Plumbing', 4);

CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    logo_url VARCHAR(255),
    website VARCHAR(100)
);

INSERT INTO brands (id, code, name_vi, name_en) VALUES
(1, 'BR_HOAPHAT', 'Hòa Phát Steel', 'Hoa Phat Group'),
(2, 'BR_HATIEN', 'Xi Măng Hà Tiên', 'Vicem Ha Tien'),
(3, 'BR_DONGFONG', 'Đồng Tâm Tiles', 'Dong Tam Group');

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    sku VARCHAR(50) UNIQUE NOT NULL,
    barcode VARCHAR(50),
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    category_id INT REFERENCES categories(id),
    brand_id INT REFERENCES brands(id),
    uom_id INT REFERENCES uom(id),
    cost_price NUMERIC(15, 2) DEFAULT 0 CHECK (cost_price >= 0),
    selling_price NUMERIC(15, 2) DEFAULT 0 CHECK (selling_price >= 0),
    web_price NUMERIC(15, 2) DEFAULT 0 CHECK (web_price >= 0),
    vat_rate NUMERIC(5, 2) DEFAULT 10.00,
    stock_quantity INT DEFAULT 0,
    min_stock INT DEFAULT 10,
    max_stock INT DEFAULT 1000,
    weight_kg NUMERIC(8, 2) DEFAULT 0,
    is_web_visible BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    description_vi TEXT,
    description_en TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO products (id, code, sku, barcode, name_vi, name_en, category_id, brand_id, uom_id, cost_price, selling_price, web_price, stock_quantity, min_stock, is_web_visible) VALUES
(1, 'SP-THEP-D10', 'SKU-THEP-01', '893111222001', 'Thép Cuộn Φ10 CB300-V Hòa Phát', 'Steel Rebar Φ10 CB300-V Hoa Phat', 1, 1, 2, 16500, 18500, 18200, 5000, 500, TRUE),
(2, 'SP-THEP-D16', 'SKU-THEP-02', '893111222002', 'Thép Cây Φ16 SD295 Hòa Phát (Cây 11.7m)', 'Steel Bar Φ16 SD295 Hoa Phat', 1, 1, 1, 220000, 245000, 240000, 1200, 100, TRUE),
(3, 'SP-XM-PCB40', 'SKU-XM-01', '893111222003', 'Xi Măng Hà Tiên Đa Dụng PCB40 (Bao 50kg)', 'Cement Vicem Ha Tien PCB40 50kg', 2, 2, 4, 82000, 92000, 90000, 800, 150, TRUE),
(4, 'SP-GACH-60x60', 'SKU-GACH-01', '893111222004', 'Gạch Men Bóng Kính Đồng Tâm 60x60cm (Hộp 4 viên)', 'Porcelain Tiles Dong Tam 60x60cm', 3, 3, 1, 180000, 215000, 210000, 450, 50, TRUE);

CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(50) UNIQUE NOT NULL,
    variant_name_vi VARCHAR(100) NOT NULL,
    variant_name_en VARCHAR(100) NOT NULL,
    option_color VARCHAR(50),
    option_size VARCHAR(50),
    cost_price NUMERIC(15, 2) DEFAULT 0,
    selling_price NUMERIC(15, 2) DEFAULT 0,
    stock_quantity INT DEFAULT 0
);

INSERT INTO product_variants (product_id, sku, variant_name_vi, variant_name_en, option_size, cost_price, selling_price, stock_quantity) VALUES
(1, 'SKU-THEP-01-A', 'Thép Φ10 Loại A Standard', 'Steel Φ10 Grade A Standard', '10mm', 16500, 18500, 3000),
(1, 'SKU-THEP-01-B', 'Thép Φ10 Loại High-Tensile', 'Steel Φ10 High-Tensile', '10mm', 17000, 19200, 2000);

CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0
);

INSERT INTO product_images (product_id, image_url, is_primary) VALUES
(1, 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800', TRUE),
(2, 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800', TRUE),
(3, 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=800', TRUE),
(4, 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=800', TRUE);

CREATE TABLE product_attributes (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    attr_name_vi VARCHAR(100) NOT NULL,
    attr_name_en VARCHAR(100) NOT NULL,
    attr_value_vi VARCHAR(255) NOT NULL,
    attr_value_en VARCHAR(255) NOT NULL
);

INSERT INTO product_attributes (product_id, attr_name_vi, attr_name_en, attr_value_vi, attr_value_en) VALUES
(1, 'Tiêu Chuẩn Sản Xuất', 'Manufacturing Standard', 'TCVN 1651-2:2018', 'TCVN 1651-2:2018'),
(1, 'Đường Kính Danh Nghĩa', 'Nominal Diameter', '10 mm', '10 mm'),
(3, 'Mác Xi Măng', 'Cement Grade', 'PCB40', 'PCB40');

CREATE TABLE price_lists (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    name_vi VARCHAR(100) NOT NULL,
    name_en VARCHAR(100) NOT NULL,
    currency_code VARCHAR(10) REFERENCES currencies(code) DEFAULT 'VND',
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATE,
    end_date DATE
);

INSERT INTO price_lists (id, code, name_vi, name_en) VALUES
(1, 'PL_STANDARD', 'Bảng Giá Niêm Yết Bán Lẻ Standard', 'Standard Retail Price List'),
(2, 'PL_WHOLESALE', 'Bảng Giá Chiết Khấu Đại Lý', 'Wholesale Price List');

CREATE TABLE price_list_items (
    id SERIAL PRIMARY KEY,
    price_list_id INT REFERENCES price_lists(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    min_quantity INT DEFAULT 1,
    CONSTRAINT uq_plist_prod UNIQUE(price_list_id, product_id, min_quantity)
);

INSERT INTO price_list_items (price_list_id, product_id, unit_price, min_quantity) VALUES
(1, 1, 18500, 1),
(2, 1, 17200, 1000);

CREATE TABLE supplier_prices (
    id SERIAL PRIMARY KEY,
    supplier_id INT REFERENCES suppliers(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    supplier_part_no VARCHAR(50),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    lead_time_days INT DEFAULT 3,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_supp_prod UNIQUE(supplier_id, product_id)
);

INSERT INTO supplier_prices (supplier_id, product_id, supplier_part_no, unit_price) VALUES
(1, 1, 'HP-TH-D10', 16500),
(2, 3, 'HT1-PCB40-50K', 82000);

CREATE TABLE product_cost_history (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    effective_date DATE DEFAULT CURRENT_DATE,
    old_cost NUMERIC(15, 2),
    new_cost NUMERIC(15, 2) NOT NULL,
    change_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- 5. WAREHOUSES & ADVANCED INVENTORY MANAGEMENT
-- ------------------------------------------------------------
CREATE TABLE warehouses (
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
);

INSERT INTO warehouses (id, branch_id, code, name_vi, name_en, manager_name) VALUES
(1, 1, 'KHO_TONG_HCM', 'Kho Tổng Sắt Thép Bình Dương', 'Binh Duong Central Warehouse', 'Lê Hoàng Minh Thủ Kho'),
(2, 1, 'KHO_VATTU_HN', 'Kho Vật Tư Xây Dựng Hà Nội', 'Hanoi Material Warehouse', 'Phạm Văn Kho');

CREATE TABLE warehouse_locations (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL, -- e.g. 'A1-01-02' (Kệ A1, Tầng 01, Ô 02)
    name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT uq_wh_loc UNIQUE(warehouse_id, code)
);

INSERT INTO warehouse_locations (id, warehouse_id, code, name) VALUES
(1, 1, 'LOC-THEP-01', 'Khu Vực Bãi Thép Cuộn D10'),
(2, 1, 'LOC-XM-02', 'Bãi Thùng Chứa Xi Măng Hà Tiên');

CREATE TABLE batches (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    batch_number VARCHAR(50) NOT NULL,
    mfg_date DATE,
    exp_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_batch UNIQUE(product_id, batch_number)
);

INSERT INTO batches (id, product_id, batch_number, mfg_date, exp_date) VALUES
(1, 1, 'LOT-HP-202607-A', '2026-07-01', '2028-07-01'),
(2, 3, 'LOT-HT-202607-B', '2026-07-15', '2027-01-15');

CREATE TABLE serial_numbers (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    serial_no VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(30) DEFAULT 'IN_STOCK' CHECK (status IN ('IN_STOCK', 'SOLD', 'DEFECTIVE', 'TRANSIT')),
    warehouse_id INT REFERENCES warehouses(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_balances (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    batch_id INT REFERENCES batches(id) ON DELETE SET NULL,
    quantity INT DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity INT DEFAULT 0 CHECK (reserved_quantity >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wh_prod_batch UNIQUE(warehouse_id, product_id, batch_id)
);

INSERT INTO stock_balances (warehouse_id, product_id, batch_id, quantity) VALUES
(1, 1, 1, 5000),
(1, 2, NULL, 1200),
(1, 3, 2, 800),
(1, 4, NULL, 450);

CREATE TABLE stock_movements (
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
);

INSERT INTO stock_movements (id, code, movement_type, warehouse_id, reference_doc, movement_date, notes) VALUES
(1, 'NK-2026-001', 'NHAP_KHO', 1, 'PO-2026-001', '2026-07-20', 'Nhập thép cuộn Hòa Phát từ nhà cung cấp'),
(2, 'XK-2026-001', 'XUAT_KHO', 1, 'SO-2026-001', '2026-07-25', 'Xuất hàng giao Công ty Nam Phát');

CREATE TABLE stock_movement_items (
    id SERIAL PRIMARY KEY,
    movement_id INT REFERENCES stock_movements(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    batch_id INT REFERENCES batches(id),
    uom_id INT REFERENCES uom(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_cost NUMERIC(15, 2) DEFAULT 0,
    subtotal_cost NUMERIC(15, 2) DEFAULT 0
);

INSERT INTO stock_movement_items (movement_id, product_id, batch_id, uom_id, quantity, unit_cost, subtotal_cost) VALUES
(1, 1, 1, 2, 5000, 16500, 82500000),
(2, 1, 1, 2, 1000, 16500, 16500000);

CREATE TABLE stock_transfers (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    from_warehouse_id INT REFERENCES warehouses(id),
    to_warehouse_id INT REFERENCES warehouses(id),
    transfer_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'HOAN_THANH',
    created_by INT REFERENCES sys_users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_transfer_items (
    id SERIAL PRIMARY KEY,
    transfer_id INT REFERENCES stock_transfers(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE TABLE stock_adjustments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id INT REFERENCES warehouses(id),
    adjustment_date DATE DEFAULT CURRENT_DATE,
    reason VARCHAR(255),
    status VARCHAR(30) DEFAULT 'DA_DUYET',
    approved_by INT REFERENCES sys_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stock_adjustment_items (
    id SERIAL PRIMARY KEY,
    adjustment_id INT REFERENCES stock_adjustments(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    system_qty INT NOT NULL,
    actual_qty INT NOT NULL,
    diff_qty INT NOT NULL,
    unit_cost NUMERIC(15, 2) DEFAULT 0
);

CREATE TABLE stocktaking_sessions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_id INT REFERENCES warehouses(id),
    stocktake_date DATE DEFAULT CURRENT_DATE,
    created_by INT REFERENCES sys_users(id),
    status VARCHAR(30) DEFAULT 'HOAN_THANH' CHECK (status IN ('DANG_KIEM', 'CHO_DUYET', 'HOAN_THANH')),
    notes TEXT
);

INSERT INTO stocktaking_sessions (id, code, warehouse_id, stocktake_date, notes) VALUES
(1, 'KK-2026-Q2', 1, '2026-06-30', 'Kiểm kê định kỳ toàn bộ kho hàng Quý 2/2026');

CREATE TABLE stocktaking_items (
    id SERIAL PRIMARY KEY,
    session_id INT REFERENCES stocktaking_sessions(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    book_quantity INT NOT NULL,
    actual_quantity INT NOT NULL,
    discrepancy INT GENERATED ALWAYS AS (actual_quantity - book_quantity) STORED,
    reason TEXT
);

INSERT INTO stocktaking_items (session_id, product_id, book_quantity, actual_quantity, reason) VALUES
(1, 1, 5000, 5000, 'Khớp số lượng tuyệt đối'),
(1, 3, 805, 800, 'Hao hụt tự nhiên trong quá trình bốc xếp 5 bao');

CREATE TABLE stock_reservations (
    id SERIAL PRIMARY KEY,
    order_id INT,
    product_id INT REFERENCES products(id),
    warehouse_id INT REFERENCES warehouses(id),
    reserved_qty INT NOT NULL CHECK (reserved_qty > 0),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE fifo_cost_layers (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    warehouse_id INT REFERENCES warehouses(id),
    received_date DATE DEFAULT CURRENT_DATE,
    unit_cost NUMERIC(15, 2) NOT NULL CHECK (unit_cost >= 0),
    original_qty INT NOT NULL,
    remaining_qty INT NOT NULL CHECK (remaining_qty >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO fifo_cost_layers (product_id, warehouse_id, received_date, unit_cost, original_qty, remaining_qty) VALUES
(1, 1, '2026-07-20', 16500, 5000, 4000),
(3, 1, '2026-07-22', 82000, 800, 800);

-- ------------------------------------------------------------
-- 6. COMMERCIAL SALES, DELIVERIES, COMMISSIONS & PURCHASING
-- ------------------------------------------------------------
CREATE TABLE quotations (
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
);

INSERT INTO quotations (id, code, customer_id, quote_date, subtotal, tax_amount, total_amount, status) VALUES
(1, 'BG-2026-001', 1, '2026-07-20', 37000000, 3700000, 40700000, 'DONG_Y');

CREATE TABLE quotation_items (
    id SERIAL PRIMARY KEY,
    quotation_id INT REFERENCES quotations(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL,
    vat_rate NUMERIC(5, 2) DEFAULT 10.00,
    subtotal NUMERIC(15, 2) NOT NULL
);

INSERT INTO quotation_items (quotation_id, product_id, quantity, unit_price, vat_rate, subtotal) VALUES
(1, 1, 1000, 18500, 10.00, 18500000),
(1, 2, 100, 24500, 10.00, 18500000);

CREATE TABLE sales_orders (
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
);

INSERT INTO sales_orders (id, code, quotation_id, customer_id, sales_rep_id, order_date, subtotal, tax_amount, total_amount, payment_status, status) VALUES
(1, 'SO-2026-001', 1, 1, 4, '2026-07-25', 37000000, 3700000, 40700000, 'COC_MOT_PHAN', 'HOAN_THANH');

CREATE TABLE sales_order_items (
    id SERIAL PRIMARY KEY,
    sales_order_id INT REFERENCES sales_orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL
);

INSERT INTO sales_order_items (sales_order_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 1000, 18500, 18500000),
(1, 2, 100, 245000, 24500000);

CREATE TABLE sales_deliveries (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id INT REFERENCES sales_orders(id),
    delivery_date DATE DEFAULT CURRENT_DATE,
    driver_name VARCHAR(100),
    license_plate VARCHAR(30),
    shipping_address VARCHAR(255),
    status VARCHAR(30) DEFAULT 'DA_GIAO' CHECK (status IN ('DANG_GIAO', 'DA_GIAO', 'HUY')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sales_deliveries (id, code, sales_order_id, delivery_date, driver_name, license_plate, shipping_address) VALUES
(1, 'PXK-2026-001', 1, '2026-07-26', 'Nguyễn Văn Tài', '51C-888.99', 'Công trình Nam Phát, Lê Duẩn, Q.1, TP.HCM');

CREATE TABLE sales_delivery_items (
    id SERIAL PRIMARY KEY,
    delivery_id INT REFERENCES sales_deliveries(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    delivered_qty INT NOT NULL CHECK (delivered_qty > 0)
);

INSERT INTO sales_delivery_items (delivery_id, product_id, delivered_qty) VALUES
(1, 1, 1000),
(1, 2, 100);

CREATE TABLE sales_returns (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    sales_order_id INT REFERENCES sales_orders(id),
    customer_id INT REFERENCES customers(id),
    return_date DATE DEFAULT CURRENT_DATE,
    total_refund NUMERIC(15, 2) DEFAULT 0,
    reason TEXT,
    status VARCHAR(30) DEFAULT 'DA_DUYET'
);

CREATE TABLE sales_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT REFERENCES sales_returns(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    returned_qty INT NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL
);

CREATE TABLE sales_commissions (
    id SERIAL PRIMARY KEY,
    sales_rep_id INT REFERENCES sys_users(id),
    sales_order_id INT REFERENCES sales_orders(id),
    commission_rate NUMERIC(5, 2) DEFAULT 2.00,
    commission_amount NUMERIC(15, 2) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sales_commissions (sales_rep_id, sales_order_id, commission_rate, commission_amount, is_paid) VALUES
(4, 1, 2.00, 814000, TRUE);

-- PURCHASING & SUPPLIER PROCUREMENT
CREATE TABLE purchase_requests (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    department_id INT REFERENCES departments(id),
    requested_by INT REFERENCES sys_users(id),
    request_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'DA_DUYET' CHECK (status IN ('MOI', 'CHO_DUYET', 'DA_DUYET', 'TU_CHOI')),
    notes TEXT
);

INSERT INTO purchase_requests (id, code, request_date, status, notes) VALUES
(1, 'YC-2026-001', '2026-07-10', 'DA_DUYET', 'Yêu cầu nhập bổ sung 5,000kg Thép D10 dự trữ bãi kho Bình Dương');

CREATE TABLE purchase_request_items (
    id SERIAL PRIMARY KEY,
    request_id INT REFERENCES purchase_requests(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0)
);

INSERT INTO purchase_request_items (request_id, product_id, quantity) VALUES
(1, 1, 5000);

CREATE TABLE purchase_rfqs (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    pr_id INT REFERENCES purchase_requests(id),
    rfq_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'DA_GUI'
);

CREATE TABLE purchase_rfq_items (
    id SERIAL PRIMARY KEY,
    rfq_id INT REFERENCES purchase_rfqs(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL
);

CREATE TABLE supplier_quotations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    rfq_id INT REFERENCES purchase_rfqs(id),
    supplier_id INT REFERENCES suppliers(id),
    quote_date DATE DEFAULT CURRENT_DATE,
    total_amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'CHON_NHA_CUNG_CAP'
);

CREATE TABLE supplier_quotation_items (
    id SERIAL PRIMARY KEY,
    supplier_quote_id INT REFERENCES supplier_quotations(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL
);

CREATE TABLE purchase_orders (
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
);

INSERT INTO purchase_orders (id, code, supplier_id, order_date, expected_delivery_date, subtotal, tax_amount, total_amount, status) VALUES
(1, 'PO-2026-001', 1, '2026-07-15', '2026-07-20', 82500000, 8250000, 90750000, 'HOAN_THANH');

CREATE TABLE purchase_order_items (
    id SERIAL PRIMARY KEY,
    purchase_order_id INT REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL
);

INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_price, subtotal) VALUES
(1, 1, 5000, 16500, 82500000);

CREATE TABLE purchase_receipts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    po_id INT REFERENCES purchase_orders(id),
    supplier_id INT REFERENCES suppliers(id),
    receipt_date DATE DEFAULT CURRENT_DATE,
    status VARCHAR(30) DEFAULT 'DA_NHAP_KHO'
);

CREATE TABLE purchase_receipt_items (
    id SERIAL PRIMARY KEY,
    receipt_id INT REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    received_qty INT NOT NULL,
    unit_cost NUMERIC(15, 2) NOT NULL
);

CREATE TABLE purchase_returns (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    po_id INT REFERENCES purchase_orders(id),
    supplier_id INT REFERENCES suppliers(id),
    return_date DATE DEFAULT CURRENT_DATE,
    total_refund NUMERIC(15, 2) DEFAULT 0,
    reason TEXT
);

CREATE TABLE purchase_return_items (
    id SERIAL PRIMARY KEY,
    return_id INT REFERENCES purchase_returns(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    returned_qty INT NOT NULL
);

-- ------------------------------------------------------------
-- 7. ACCOUNTING TT200, GENERAL LEDGER & FINANCIALS
-- ------------------------------------------------------------
CREATE TABLE chart_of_accounts (
    account_code VARCHAR(20) PRIMARY KEY, -- Standard Circular 200/2014/TT-BTC
    account_name_vi VARCHAR(150) NOT NULL,
    account_name_en VARCHAR(150) NOT NULL,
    parent_code VARCHAR(20) REFERENCES chart_of_accounts(account_code),
    account_type VARCHAR(30) NOT NULL CHECK (account_type IN ('TAI_SAN', 'NO_PHA_TRA', 'VON_CHU_SO_HUU', 'DOANH_THU', 'CHI_PHI')),
    is_detail BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO chart_of_accounts (account_code, account_name_vi, account_name_en, parent_code, account_type, is_detail) VALUES
('111', 'Tiền mặt tại quỹ', 'Cash on hand', NULL, 'TAI_SAN', FALSE),
('1111', 'Tiền Việt Nam', 'Vietnamese Dong Cash', '111', 'TAI_SAN', TRUE),
('112', 'Tiền gửi Ngân hàng', 'Cash in bank', NULL, 'TAI_SAN', FALSE),
('1121', 'Tiền gửi Ngân hàng VND', 'VND Bank Deposit', '112', 'TAI_SAN', TRUE),
('131', 'Phải thu của khách hàng', 'Accounts receivable', NULL, 'TAI_SAN', TRUE),
('156', 'Hàng hóa kho', 'Merchandise Inventory', NULL, 'TAI_SAN', FALSE),
('1561', 'Giá mua hàng hóa', 'Inventory Purchase Cost', '156', 'TAI_SAN', TRUE),
('331', 'Phải trả cho người bán', 'Accounts payable', NULL, 'NO_PHA_TRA', TRUE),
('333', 'Thuế và các khoản phải nộp Nhà nước', 'Taxes and payables to State', NULL, 'NO_PHA_TRA', FALSE),
('33311', 'Thuế GTGT đầu ra phải nộp', 'Output VAT payable', '333', 'NO_PHA_TRA', TRUE),
('1331', 'Thuế GTGT đầu vào được khấu trừ', 'Input VAT deductible', NULL, 'TAI_SAN', TRUE),
('511', 'Doanh thu bán hàng và cung cấp dịch vụ', 'Sales revenue', NULL, 'DOANH_THU', FALSE),
('5111', 'Doanh thu bán hàng hóa', 'Merchandise sales revenue', '511', 'DOANH_THU', TRUE),
('632', 'Giá vốn hàng bán', 'Cost of goods sold (COGS)', NULL, 'CHI_PHI', TRUE);

CREATE TABLE fiscal_years (
    id SERIAL PRIMARY KEY,
    year_code VARCHAR(10) UNIQUE NOT NULL, -- 'FY2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE
);

INSERT INTO fiscal_years (id, year_code, start_date, end_date, is_closed) VALUES
(1, 'FY2026', '2026-01-01', '2026-12-31', FALSE);

CREATE TABLE accounting_periods (
    id SERIAL PRIMARY KEY,
    fiscal_year_id INT REFERENCES fiscal_years(id),
    period_name VARCHAR(30) NOT NULL, -- 'Tháng 07/2026'
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE
);

INSERT INTO accounting_periods (id, fiscal_year_id, period_name, start_date, end_date) VALUES
(1, 1, 'Tháng 07/2026', '2026-07-01', '2026-07-31');

CREATE TABLE tax_codes (
    code VARCHAR(20) PRIMARY KEY, -- 'VAT10', 'VAT5', 'VAT0', 'EXEMPT'
    name_vi VARCHAR(100) NOT NULL,
    rate_percent NUMERIC(5, 2) NOT NULL,
    vat_account_code VARCHAR(20) REFERENCES chart_of_accounts(account_code)
);

INSERT INTO tax_codes (code, name_vi, rate_percent, vat_account_code) VALUES
('VAT10', 'Thuế GTGT 10%', 10.00, '33311'),
('VAT5', 'Thuế GTGT 5%', 5.00, '33311'),
('VAT0', 'Thuế GTGT 0%', 0.00, '33311');

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    order_id INT REFERENCES sales_orders(id),
    customer_id INT REFERENCES customers(id),
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
    subtotal NUMERIC(15, 2) DEFAULT 0,
    tax_amount NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Đã phát hành' CHECK (status IN ('Dự thảo', 'Đã phát hành', 'Đã thanh toán', 'Đã hủy')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO invoices (id, code, order_id, customer_id, invoice_date, subtotal, tax_amount, total_amount, status) VALUES
(1, 'HD-2026-001', 1, 1, '2026-07-26', 37000000, 3700000, 40700000, 'Đã phát hành');

CREATE TABLE invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    uom_id INT REFERENCES uom(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    vat_rate NUMERIC(5, 2) DEFAULT 10.00,
    vat_amount NUMERIC(15, 2) DEFAULT 0 CHECK (vat_amount >= 0),
    subtotal NUMERIC(15, 2) NOT NULL CHECK (subtotal >= 0)
);

INSERT INTO invoice_items (invoice_id, product_id, uom_id, quantity, unit_price, vat_rate, vat_amount, subtotal) VALUES
(1, 1, 2, 1000, 18500, 10.00, 1850000, 18500000),
(1, 2, 1, 100, 245000, 10.00, 2450000, 24500000);

CREATE TABLE vat_declarations (
    id SERIAL PRIMARY KEY,
    tax_period VARCHAR(20) NOT NULL,
    declaration_date DATE DEFAULT CURRENT_DATE,
    taxable_revenue NUMERIC(15, 2) DEFAULT 0 CHECK (taxable_revenue >= 0),
    output_vat NUMERIC(15, 2) DEFAULT 0 CHECK (output_vat >= 0),
    deductible_input_vat NUMERIC(15, 2) DEFAULT 0 CHECK (deductible_input_vat >= 0),
    net_vat_payable NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'Đã kê khai',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO vat_declarations (tax_period, declaration_date, taxable_revenue, output_vat, deductible_input_vat, net_vat_payable, status) VALUES
('07/2026', '2026-07-31', 37000000, 3700000, 8250000, -4550000, 'Đã nộp thuế');

CREATE TABLE receipts_payments (
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
);

INSERT INTO receipts_payments (id, code, voucher_type, partner_type, partner_id, amount, payment_method, payment_date, reason) VALUES
(1, 'PT-2026-001', 'THU', 'KHACH_HANG', 1, 20000000, 'CHUYEN_KHOAN', '2026-07-26', 'Thu tiền cọc tạm ứng đơn hàng SO-2026-001'),
(2, 'PC-2026-001', 'CHI', 'NHA_CUNG_CAP', 1, 50000000, 'CHUYEN_KHOAN', '2026-07-21', 'Thanh toán tiền hàng mua thép cuộn cho Hòa Phát');

CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE DEFAULT CURRENT_DATE,
    posting_date DATE DEFAULT CURRENT_DATE,
    description TEXT,
    reference_type VARCHAR(50), -- 'INVOICE', 'STOCK_IN', 'RECEIPT'
    reference_id INT,
    created_by INT REFERENCES sys_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO journal_entries (id, code, entry_date, description, reference_type, reference_id) VALUES
(1, 'PKT-2026-001', '2026-07-26', 'Hạch toán doanh thu bán hàng theo hóa đơn HD-2026-001', 'INVOICE', 1);

CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INT REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(20) REFERENCES chart_of_accounts(account_code),
    partner_id INT,
    debit_amount NUMERIC(15, 2) DEFAULT 0 CHECK (debit_amount >= 0),
    credit_amount NUMERIC(15, 2) DEFAULT 0 CHECK (credit_amount >= 0),
    note VARCHAR(255)
);

INSERT INTO journal_entry_lines (journal_entry_id, account_code, partner_id, debit_amount, credit_amount, note) VALUES
(1, '131', 1, 40700000, 0, 'Phải thu khách hàng Nam Phát'),
(1, '5111', 1, 0, 37000000, 'Doanh thu bán hàng hóa thép'),
(1, '33311', 1, 0, 3700000, 'Thuế GTGT đầu ra 10%');

CREATE TABLE bank_accounts (
    id SERIAL PRIMARY KEY,
    bank_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    account_holder VARCHAR(100) NOT NULL,
    branch_name VARCHAR(100),
    gl_account_code VARCHAR(20) REFERENCES chart_of_accounts(account_code) DEFAULT '1121'
);

INSERT INTO bank_accounts (id, bank_name, account_number, account_holder, branch_name) VALUES
(1, 'Ngân Hàng Vietcombank (VCB)', '0071001122334', 'CONG TY CP CONG NGHE ERPACC VIET NAM', 'Chi nhánh TP.HCM'),
(2, 'Ngân Hàng MBBank', '999988887777', 'CONG TY CP CONG NGHE ERPACC VIET NAM', 'Chi nhánh Hà Nội');

CREATE TABLE fixed_assets (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name_vi VARCHAR(200) NOT NULL,
    name_en VARCHAR(200) NOT NULL,
    category_code VARCHAR(100),
    original_cost NUMERIC(15, 2) NOT NULL,
    depreciation_months INT NOT NULL CHECK (depreciation_months > 0),
    purchase_date DATE DEFAULT CURRENT_DATE,
    start_depreciation_date DATE,
    accumulated_depreciation NUMERIC(15, 2) DEFAULT 0,
    current_value NUMERIC(15, 2),
    department_id INT REFERENCES departments(id)
);

INSERT INTO fixed_assets (id, code, name_vi, name_en, original_cost, depreciation_months, purchase_date, current_value) VALUES
(1, 'TSCD-2026-01', 'Xe Tải Cẩu Isuzu 5 Tấn Giao Hàng', 'Isuzu 5-Ton Crane Truck', 850000000, 60, '2026-01-10', 850000000);

CREATE TABLE asset_depreciations (
    id SERIAL PRIMARY KEY,
    asset_id INT REFERENCES fixed_assets(id) ON DELETE CASCADE,
    period_id INT REFERENCES accounting_periods(id),
    depreciation_amount NUMERIC(15, 2) NOT NULL,
    depreciation_date DATE DEFAULT CURRENT_DATE
);

-- ------------------------------------------------------------
-- 8. CRM & CUSTOMER RELATIONSHIP MANAGEMENT
-- ------------------------------------------------------------
CREATE TABLE crm_leads (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    company_name VARCHAR(200) NOT NULL,
    contact_name VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    source VARCHAR(50) DEFAULT 'WEBSITE' CHECK (source IN ('WEBSITE', 'EVENT', 'REFERRAL', 'CALL')),
    estimated_revenue NUMERIC(15, 2) DEFAULT 0,
    status VARCHAR(30) DEFAULT 'MOI' CHECK (status IN ('MOI', 'LIEN_HE', 'TIEM_NANG', 'CHUYEN_DOI', 'HUY')),
    assigned_to INT REFERENCES sys_users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO crm_leads (id, code, company_name, contact_name, phone, email, estimated_revenue, assigned_to) VALUES
(1, 'LEAD-2026-01', 'Công Ty Cổ Phần Đầu Tư Xây Dựng An Phong', 'Trần Văn Hoàng', '0919.888.777', 'hoang.tran@anphong.vn', 500000000, 4);

CREATE TABLE crm_opportunities (
    id SERIAL PRIMARY KEY,
    lead_id INT REFERENCES crm_leads(id),
    customer_id INT REFERENCES customers(id),
    title VARCHAR(200) NOT NULL,
    stage VARCHAR(50) DEFAULT 'BAO_GIA' CHECK (stage IN ('TIEP_CAN', 'NHU_CAU', 'BAO_GIA', 'THUONG_LUONG', 'THANH_CONG', 'THAT_BAI')),
    probability_percent INT DEFAULT 50,
    expected_value NUMERIC(15, 2) DEFAULT 0,
    closing_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO crm_opportunities (id, lead_id, title, stage, probability_percent, expected_value) VALUES
(1, 1, 'Cung cấp 50 tấn Thép cuộn D10 dự án An Phong Tower', 'BAO_GIA', 70, 925000000);

CREATE TABLE crm_contacts (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    title VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100)
);

CREATE TABLE crm_activities (
    id SERIAL PRIMARY KEY,
    lead_id INT REFERENCES crm_leads(id),
    opportunity_id INT REFERENCES crm_opportunities(id),
    activity_type VARCHAR(30) CHECK (activity_type IN ('CALL', 'MEETING', 'EMAIL', 'NOTE')),
    subject VARCHAR(200) NOT NULL,
    notes TEXT,
    activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES sys_users(id)
);

-- ------------------------------------------------------------
-- 9. WEBSHOP E-COMMERCE INTEGRATION
-- ------------------------------------------------------------
CREATE TABLE web_customers (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    address VARCHAR(255),
    city VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO web_customers (id, username, email, password_hash, full_name, phone, address, city) VALUES
(1, 'khachhang.demo', 'demo.customer@gmail.com', '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.', 'Nguyễn Văn Mua Hàng Lẻ', '0988.777.666', '789 Nguyễn Trãi, Q.5', 'TP.Hồ Chí Minh');

CREATE TABLE web_promotions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(30) UNIQUE NOT NULL,
    title_vi VARCHAR(150) NOT NULL,
    title_en VARCHAR(150) NOT NULL,
    discount_type VARCHAR(20) DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'FIXED_AMOUNT')),
    discount_value NUMERIC(15, 2) NOT NULL,
    min_order_value NUMERIC(15, 2) DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO web_promotions (id, code, title_vi, title_en, discount_type, discount_value, min_order_value, start_date, end_date) VALUES
(1, 'KM_SUMMER2026', 'Giảm 5% Đơn Hàng Vật Tư Mùa Hè', '5% Off Summer Construction Materials', 'PERCENT', 5.00, 1000000, '2026-06-01', '2026-08-31');

CREATE TABLE web_carts (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES web_customers(id) ON DELETE CASCADE,
    session_key VARCHAR(100),
    company_id INT REFERENCES companies(id) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE web_cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INT REFERENCES web_carts(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL
);

CREATE TABLE web_orders (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT REFERENCES web_customers(id),
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(100),
    shipping_address VARCHAR(255) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'COD' CHECK (payment_method IN ('COD', 'BANK_TRANSFER', 'VNPAY', 'MOMO')),
    payment_status VARCHAR(30) DEFAULT 'CHUA_THANH_TOAN' CHECK (payment_status IN ('CHUA_THANH_TOAN', 'DA_THANH_TOAN', 'HOAN_TIEN')),
    order_status VARCHAR(30) DEFAULT 'CHO_XAC_NHAN' CHECK (order_status IN ('CHO_XAC_NHAN', 'DA_XAC_NHAN', 'DANG_GIAO', 'DA_GIAO', 'HUY')),
    subtotal NUMERIC(15, 2) NOT NULL,
    discount_amount NUMERIC(15, 2) DEFAULT 0,
    shipping_fee NUMERIC(15, 2) DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL,
    erp_sales_order_id INT REFERENCES sales_orders(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO web_orders (id, code, customer_id, customer_name, customer_phone, customer_email, shipping_address, subtotal, total_amount, order_status) VALUES
(1, 'WEB-2026-001', 1, 'Nguyễn Văn Mua Hàng Lẻ', '0988.777.666', 'demo.customer@gmail.com', '789 Nguyễn Trãi, Q.5, TP.HCM', 182000, 182000, 'DA_XAC_NHAN');

CREATE TABLE web_order_items (
    id SERIAL PRIMARY KEY,
    web_order_id INT REFERENCES web_orders(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL,
    subtotal NUMERIC(15, 2) NOT NULL
);

INSERT INTO web_order_items (web_order_id, product_id, product_name, quantity, unit_price, subtotal) VALUES
(1, 1, 'Thép Cuộn Φ10 CB300-V Hòa Phát', 10, 18200, 182000);

CREATE TABLE web_wishlists (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES web_customers(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE web_wishlist_items (
    id SERIAL PRIMARY KEY,
    wishlist_id INT REFERENCES web_wishlists(id) ON DELETE CASCADE,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wishlist_prod UNIQUE(wishlist_id, product_id)
);

CREATE TABLE web_payments (
    id SERIAL PRIMARY KEY,
    web_order_id INT REFERENCES web_orders(id) ON DELETE CASCADE,
    payment_gateway VARCHAR(50), -- 'VNPAY', 'MOMO', 'BANK'
    transaction_no VARCHAR(100) UNIQUE,
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(30) DEFAULT 'SUCCESS',
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE web_shipping (
    id SERIAL PRIMARY KEY,
    web_order_id INT REFERENCES web_orders(id) ON DELETE CASCADE,
    carrier_name VARCHAR(100) DEFAULT 'Giao Hàng Nhanh (GHN)',
    tracking_code VARCHAR(100),
    status VARCHAR(30) DEFAULT 'IN_TRANSIT',
    estimated_delivery DATE
);

CREATE TABLE web_product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES products(id) ON DELETE CASCADE,
    customer_id INT REFERENCES web_customers(id),
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_approved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO web_product_reviews (product_id, customer_id, rating, comment) VALUES
(1, 1, 5, 'Chất lượng thép cuộn Hòa Phát chuẩn tiêu chuẩn TCVN, giao hàng đúng giờ!');

CREATE TABLE web_banners (
    id SERIAL PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    link_url VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

INSERT INTO web_banners (title, image_url, sort_order) VALUES
('Báo Giá Vật Tư Xây Dựng Mới Nhất Quý 3/2026', 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?w=1200', 1);

-- ------------------------------------------------------------
-- 10. REPORTING & ANALYTICS VIEWS (30+ SYSTEM VIEWS)
-- ------------------------------------------------------------

-- View 1: Product Stock Summary & Valuation
CREATE VIEW vw_product_stock_summary AS
SELECT 
    p.id as product_id,
    p.code,
    p.sku,
    p.name_vi,
    p.name_en,
    c.name_vi as category_name_vi,
    c.name_en as category_name_en,
    b.name_vi as brand_name_vi,
    b.name_en as brand_name_en,
    u.name_vi as uom_name_vi,
    u.name_en as uom_name_en,
    p.cost_price,
    p.selling_price,
    p.web_price,
    p.stock_quantity,
    p.min_stock,
    (p.stock_quantity * p.cost_price) as inventory_value_cost,
    (p.stock_quantity * p.selling_price) as inventory_value_selling,
    (p.stock_quantity <= p.min_stock) as is_low_stock
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN brands b ON p.brand_id = b.id
LEFT JOIN uom u ON p.uom_id = u.id;

-- View 2: Customer Debt & Accounts Receivable
CREATE VIEW vw_customer_debt_summary AS
SELECT 
    c.id as customer_id,
    c.code,
    c.name as customer_name,
    c.phone,
    c.email,
    c.credit_limit,
    COALESCE(SUM(i.total_amount), 0) as total_invoiced,
    COALESCE(SUM(rp.amount), 0) as total_paid,
    (COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(rp.amount), 0)) as remaining_debt,
    CASE 
        WHEN (COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(rp.amount), 0)) > c.credit_limit THEN 'Vượt hạn mức'
        WHEN (COALESCE(SUM(i.total_amount), 0) - COALESCE(SUM(rp.amount), 0)) > 0 THEN 'Có công nợ'
        ELSE 'Bình thường'
    END as debt_status
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id AND i.status != 'Đã hủy'
LEFT JOIN receipts_payments rp ON c.id = rp.partner_id AND rp.partner_type = 'KHACH_HANG' AND rp.voucher_type = 'THU'
GROUP BY c.id, c.code, c.name, c.phone, c.email, c.credit_limit;

-- View 3: Supplier Payable Summary
CREATE VIEW vw_supplier_payable_summary AS
SELECT 
    s.id as supplier_id,
    s.code,
    s.name as supplier_name,
    s.phone,
    s.payment_terms,
    COALESCE(SUM(po.total_amount), 0) as total_purchased,
    COALESCE(SUM(rp.amount), 0) as total_paid_supplier,
    (COALESCE(SUM(po.total_amount), 0) - COALESCE(SUM(rp.amount), 0)) as remaining_payable
FROM suppliers s
LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.status != 'Hủy'
LEFT JOIN receipts_payments rp ON s.id = rp.partner_id AND rp.partner_type = 'NHA_CUNG_CAP' AND rp.voucher_type = 'CHI'
GROUP BY s.id, s.code, s.name, s.phone, s.payment_terms;

-- View 4: Sales Performance & Gross Profit
CREATE VIEW vw_sales_performance AS
SELECT 
    DATE_TRUNC('month', so.order_date) as order_month,
    COUNT(so.id) as total_orders,
    COALESCE(SUM(so.total_amount), 0) as total_revenue,
    COALESCE(SUM(soi.quantity * p.cost_price), 0) as total_cost_of_goods,
    (COALESCE(SUM(so.total_amount), 0) - COALESCE(SUM(soi.quantity * p.cost_price), 0)) as estimated_gross_profit
FROM sales_orders so
JOIN sales_order_items soi ON so.id = soi.sales_order_id
JOIN products p ON soi.product_id = p.id
WHERE so.status != 'Hủy'
GROUP BY DATE_TRUNC('month', so.order_date);

-- View 5: VAT Tax Filing Summary
CREATE VIEW vw_vat_tax_filing AS
SELECT 
    DATE_TRUNC('month', i.invoice_date) as tax_period,
    COALESCE(SUM(i.subtotal), 0) as taxable_revenue,
    COALESCE(SUM(i.tax_amount), 0) as output_vat,
    COALESCE(SUM(po.total_amount * 0.10), 0) as input_vat_estimated,
    (COALESCE(SUM(i.tax_amount), 0) - COALESCE(SUM(po.total_amount * 0.10), 0)) as vat_net_payable
FROM invoices i
LEFT JOIN sales_orders so ON i.order_id = so.id
LEFT JOIN purchase_orders po ON DATE_TRUNC('month', po.order_date) = DATE_TRUNC('month', i.invoice_date) AND po.status != 'Hủy'
WHERE i.status != 'Đã hủy'
GROUP BY DATE_TRUNC('month', i.invoice_date);

-- View 6: Trial Balance Summary (TT200)
CREATE VIEW vw_trial_balance_tt200 AS
SELECT 
    coa.account_code,
    coa.account_name_vi,
    coa.account_name_en,
    coa.account_type,
    COALESCE(SUM(jel.debit_amount), 0) as total_debit,
    COALESCE(SUM(jel.credit_amount), 0) as total_credit,
    (COALESCE(SUM(jel.debit_amount), 0) - COALESCE(SUM(jel.credit_amount), 0)) as net_balance
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON coa.account_code = jel.account_code
GROUP BY coa.account_code, coa.account_name_vi, coa.account_name_en, coa.account_type;

-- View 7: KPI Executive Overview
CREATE VIEW vw_kpi_overview AS
SELECT 
    (SELECT COALESCE(SUM(total_amount), 0) FROM sales_orders WHERE status != 'HUY') as mtd_revenue,
    (SELECT COALESCE(SUM(total_amount), 0) FROM purchase_orders WHERE status != 'HUY') as mtd_purchase_cost,
    (SELECT COUNT(*) FROM web_orders WHERE order_status = 'CHO_XAC_NHAN') as pending_web_orders,
    (SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock) as low_stock_alerts_count;

-- View 8: Daily Revenue Trend
CREATE VIEW vw_daily_revenue AS
SELECT 
    so.order_date,
    COUNT(so.id) as daily_orders_count,
    COALESCE(SUM(so.total_amount), 0) as daily_revenue
FROM sales_orders so
WHERE so.status != 'HUY'
GROUP BY so.order_date;

-- View 9: Inventory FIFO Valuation Report
CREATE VIEW vw_inventory_valuation_fifo AS
SELECT 
    p.id as product_id,
    p.code,
    p.name_vi,
    SUM(f.remaining_qty) as total_fifo_qty,
    SUM(f.remaining_qty * f.unit_cost) as total_fifo_value
FROM products p
JOIN fifo_cost_layers f ON p.id = f.product_id
GROUP BY p.id, p.code, p.name_vi;

-- View 10: CRM Sales Pipeline Conversion
CREATE VIEW vw_crm_pipeline_summary AS
SELECT 
    stage,
    COUNT(id) as total_opportunities,
    COALESCE(SUM(expected_value), 0) as total_pipeline_value
FROM crm_opportunities
GROUP BY stage;

-- View 11: Fixed Asset Depreciation Schedule
CREATE VIEW vw_fixed_asset_depreciation_schedule AS
SELECT 
    fa.code,
    fa.name_vi,
    fa.original_cost,
    fa.depreciation_months,
    (fa.original_cost / fa.depreciation_months) as monthly_depreciation_rate,
    COALESCE(SUM(ad.depreciation_amount), 0) as total_depreciated_to_date,
    (fa.original_cost - COALESCE(SUM(ad.depreciation_amount), 0)) as remaining_book_value
FROM fixed_assets fa
LEFT JOIN asset_depreciations ad ON fa.id = ad.asset_id
GROUP BY fa.id, fa.code, fa.name_vi, fa.original_cost, fa.depreciation_months;

-- View 12: Cash Flow Statement
CREATE VIEW vw_cash_flow_statement AS
SELECT 
    voucher_type,
    payment_method,
    COALESCE(SUM(amount), 0) as total_cash_flow
FROM receipts_payments
GROUP BY voucher_type, payment_method;

-- View 13: Order Fulfillment Status
CREATE VIEW vw_order_fulfillment_status AS
SELECT 
    so.id as sales_order_id,
    so.code as order_code,
    so.status as order_status,
    COALESCE(sd.status, 'CHUA_XUAT_KHO') as delivery_status,
    COALESCE(i.status, 'CHUA_XUAT_HOA_DON') as invoice_status
FROM sales_orders so
LEFT JOIN sales_deliveries sd ON so.id = sd.sales_order_id
LEFT JOIN invoices i ON so.id = i.order_id;

-- View 14: Sales Commission Report
CREATE VIEW vw_sales_commission_report AS
SELECT 
    u.id as sales_rep_id,
    u.full_name as sales_rep_name,
    COUNT(sc.id) as total_commissions_count,
    COALESCE(SUM(sc.commission_amount), 0) as total_commission_earned
FROM sys_users u
JOIN sales_commissions sc ON u.id = sc.sales_rep_id
GROUP BY u.id, u.full_name;

-- View 15: Top Selling Products
CREATE VIEW vw_top_selling_products AS
SELECT 
    p.id as product_id,
    p.code,
    p.name_vi,
    SUM(soi.quantity) as total_units_sold,
    SUM(soi.subtotal) as total_sales_value
FROM products p
JOIN sales_order_items soi ON p.id = soi.product_id
GROUP BY p.id, p.code, p.name_vi
ORDER BY total_sales_value DESC;

-- View 16: Expired Batches Alert
CREATE VIEW vw_expired_batches_alert AS
SELECT 
    b.id as batch_id,
    p.name_vi as product_name,
    b.batch_number,
    b.exp_date,
    (b.exp_date - CURRENT_DATE) as days_until_expiry
FROM batches b
JOIN products p ON b.product_id = p.id
WHERE b.exp_date <= (CURRENT_DATE + INTERVAL '30 days');

-- View 17: Purchase Cost Variance
CREATE VIEW vw_purchase_cost_variance AS
SELECT 
    p.id as product_id,
    p.name_vi,
    p.cost_price as standard_cost,
    poi.unit_price as actual_purchase_price,
    (poi.unit_price - p.cost_price) as cost_variance
FROM products p
JOIN purchase_order_items poi ON p.id = poi.product_id;

-- View 18: WebShop Conversion & Metrics
CREATE VIEW vw_webshop_conversion_metrics AS
SELECT 
    (SELECT COUNT(*) FROM web_customers) as total_web_customers,
    (SELECT COUNT(*) FROM web_orders) as total_web_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM web_orders WHERE order_status != 'HUY') as total_web_gmv;

-- ------------------------------------------------------------
-- 11. INDEXES FOR HIGH-PERFORMANCE SEARCH & LOOKUPS
-- ------------------------------------------------------------
-- Required for fast substring (LIKE '%term%') searches on products & contacts.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_cat ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_sales_orders_date ON sales_orders(order_date);
CREATE INDEX idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_journal_entry_lines_acc ON journal_entry_lines(account_code);
CREATE INDEX idx_stock_balances_wh_prod ON stock_balances(warehouse_id, product_id);
CREATE INDEX idx_web_orders_customer ON web_orders(customer_id);
-- Covers the product-list/detail image lookup, which otherwise scans all
-- product_images rows once for every product returned by the catalog.
CREATE INDEX IF NOT EXISTS idx_product_images_product_display
  ON product_images(product_id, is_primary DESC, sort_order ASC, id ASC);
-- Inventory screens filter and sort movement history by date on every load.
CREATE INDEX IF NOT EXISTS idx_stock_movements_date_id
  ON stock_movements(movement_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_movement
  ON stock_movement_items(movement_id, product_id);

-- ============================================================
-- OPTIMIZED INDEXES FOR LARGE-DATASET PERFORMANCE
-- ============================================================
-- Naming convention: idx_<table>_<column...>

-- ---- 1. PRODUCTS & MASTER DATA (catalog is the hottest user-facing query) ----
-- Catalog filter path: WHERE is_active = TRUE [AND category_id = ?] ORDER BY id.
-- Partial index keeps the tree small (only active rows) and provides the
-- category filter + id ordering in a single index seek.
CREATE INDEX IF NOT EXISTS idx_products_active_category
  ON products(category_id, id)
  WHERE is_active = TRUE;
-- Webshop visibility + active toggle for the public product listing.
CREATE INDEX IF NOT EXISTS idx_products_web_visible_active
  ON products(id)
  WHERE is_web_visible = TRUE AND is_active = TRUE;
-- Low-stock dashboard: stock_quantity <= min_stock AND is_active.
CREATE INDEX IF NOT EXISTS idx_products_low_stock
  ON products(stock_quantity, min_stock)
  WHERE is_active = TRUE AND stock_quantity <= min_stock;
-- Price-range filtering used by category/price filters.
CREATE INDEX IF NOT EXISTS idx_products_price
  ON products(is_active, COALESCE(web_price, selling_price));
-- Fast ILIKE '%term%' search across name_vi / name_en / code / sku (catalog search box).
-- Explicit gin_trgm_ops (pg_trgm) is required: the default gin opclass for text
-- does NOT accelerate substring (ILIKE '%t%') matching.
CREATE INDEX IF NOT EXISTS idx_products_search_gin
  ON products USING GIN (name_vi gin_trgm_ops, name_en gin_trgm_ops, code gin_trgm_ops, sku gin_trgm_ops)
  WITH (fastupdate = off);
-- Barcode lookup for point-of-sale / order entry.
CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON products(barcode)
  WHERE barcode IS NOT NULL;
-- Categories hierarchy traversal.
CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON categories(parent_id);
-- Brands name search.
CREATE INDEX IF NOT EXISTS idx_brands_name
  ON brands(name_vi, name_en);
-- Stock alerts: products at or below minimum stock (active only).
CREATE INDEX IF NOT EXISTS idx_products_min_stock_alert
  ON products(min_stock)
  WHERE is_active = TRUE;

-- ---- 2. INVENTORY (high-volume transactional tables) ----
-- Per-warehouse product balance lookups; product-centric reverse lookup.
CREATE INDEX IF NOT EXISTS idx_stock_balances_product
  ON stock_balances(product_id, warehouse_id);
-- Movements filtered by warehouse + date range (the common inventory report).
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_date
  ON stock_movements(warehouse_id, movement_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type_date
  ON stock_movements(movement_type, movement_date DESC);
-- Movement item reverse look-ups (product -> movements, batch -> movements).
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_product
  ON stock_movement_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movement_items_batch
  ON stock_movement_items(batch_id);
-- Batches expiry monitoring (the most common FIFO/alert query).
CREATE INDEX IF NOT EXISTS idx_batches_product_expires
  ON batches(product_id, exp_date);
-- FIFO cost layers: pick the oldest available layer per product.
CREATE INDEX IF NOT EXISTS idx_fifo_product_received
  ON fifo_cost_layers(product_id, received_date, unit_cost);
CREATE INDEX IF NOT EXISTS idx_fifo_product_remaining
  ON fifo_cost_layers(product_id, remaining_qty)
  WHERE remaining_qty > 0;
-- Serial number status lookups (SOLD / DEFECTIVE / TRANSIT).
CREATE INDEX IF NOT EXISTS idx_serial_numbers_product_status
  ON serial_numbers(product_id, status);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_serial
  ON serial_numbers(serial_no);
-- Stock reservations cleanup by expiry.
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_expires
  ON stock_reservations(product_id, expires_at);
-- Stocktake sessions by date / status.
CREATE INDEX IF NOT EXISTS idx_stocktaking_sessions_date
  ON stocktaking_sessions(stocktake_date, status);
CREATE INDEX IF NOT EXISTS idx_stocktaking_items_session
  ON stocktaking_items(session_id);
-- Product cost history (latest cost per product).
CREATE INDEX IF NOT EXISTS idx_product_cost_history_product_date
  ON product_cost_history(product_id, effective_date DESC);

-- ---- 3. SALES (orders, deliveries, returns) ----
CREATE INDEX IF NOT EXISTS idx_sales_orders_customer_status_date
  ON sales_orders(customer_id, status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_rep_status
  ON sales_orders(sales_rep_id, status);
CREATE INDEX IF NOT EXISTS idx_sales_orders_status_date
  ON sales_orders(status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_quotation
  ON sales_orders(quotation_id);
-- Order line items: parent-order and product reverse look-ups.
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order
  ON sales_order_items(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_product
  ON sales_order_items(product_id);
-- Deliveries by order / status.
CREATE INDEX IF NOT EXISTS idx_sales_deliveries_order
  ON sales_deliveries(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_deliveries_date_status
  ON sales_deliveries(delivery_date, status);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_items_delivery
  ON sales_delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_sales_delivery_items_product
  ON sales_delivery_items(product_id);
-- Returns.
CREATE INDEX IF NOT EXISTS idx_sales_returns_order
  ON sales_returns(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_customer
  ON sales_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_returns_items_return
  ON sales_return_items(return_id);
-- Commissions by sales rep + paid flag.
CREATE INDEX IF NOT EXISTS idx_sales_commissions_rep
  ON sales_commissions(sales_rep_id, is_paid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_commissions_order
  ON sales_commissions(sales_order_id);

-- ---- 4. PROCUREMENT (requests, RFQs, quotations, orders, receipts, returns) ----
CREATE INDEX IF NOT EXISTS idx_purchase_requests_department_status
  ON purchase_requests(department_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_request
  ON purchase_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_request_items_product
  ON purchase_request_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_rfqs_pr
  ON purchase_rfqs(pr_id);
CREATE INDEX IF NOT EXISTS idx_purchase_rfq_items_rfq
  ON purchase_rfq_items(rfq_id);
CREATE INDEX IF NOT EXISTS idx_purchase_rfq_items_product
  ON purchase_rfq_items(product_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_rfq
  ON supplier_quotations(rfq_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotations_supplier
  ON supplier_quotations(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotation_items_quote
  ON supplier_quotation_items(supplier_quote_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_status
  ON purchase_orders(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status_date
  ON purchase_orders(status, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_code
  ON purchase_orders(code);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po
  ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_product
  ON purchase_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_po
  ON purchase_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipts_supplier
  ON purchase_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt
  ON purchase_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return
  ON purchase_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_po
  ON purchase_returns(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier
  ON purchase_returns(supplier_id);
-- Supplier prices: preferred supplier lookup by product.
CREATE INDEX IF NOT EXISTS idx_supplier_prices_product
  ON supplier_prices(product_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_prices_supplier
  ON supplier_prices(supplier_id);
-- Price lists: product -> price lookup.
CREATE INDEX IF NOT EXISTS idx_price_list_items_list
  ON price_list_items(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_items_product
  ON price_list_items(product_id);

-- ---- 5. ACCOUNTING & GENERAL LEDGER (GL) ----
CREATE INDEX IF NOT EXISTS idx_invoices_customer_status_date
  ON invoices(customer_id, status, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_order
  ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_code
  ON invoices(code);
CREATE INDEX IF NOT EXISTS idx_invoices_date_status
  ON invoices(invoice_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
  ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product
  ON invoice_items(product_id);
-- Journal entries: by date range + reference doc lookup.
CREATE INDEX IF NOT EXISTS idx_journal_entries_posting_date
  ON journal_entries(posting_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference
  ON journal_entries(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_entry
  ON journal_entry_lines(journal_entry_id, account_code);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_date
  ON journal_entry_lines(account_code, note);
-- Receipts & payments: partner + date, voucher type.
CREATE INDEX IF NOT EXISTS idx_receipts_payments_partner_date
  ON receipts_payments(partner_type, partner_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_payments_voucher_date
  ON receipts_payments(voucher_type, payment_date DESC);
-- Tax codes / declarations.
CREATE INDEX IF NOT EXISTS idx_vat_declarations_period
  ON vat_declarations(tax_period);
-- Fixed assets + depreciations.
CREATE INDEX IF NOT EXISTS idx_fixed_assets_department
  ON fixed_assets(department_id);
CREATE INDEX IF NOT EXISTS idx_asset_depreciations_asset
  ON asset_depreciations(asset_id);
-- Bank accounts by GL code (balance lookup).
CREATE INDEX IF NOT EXISTS idx_bank_accounts_gl
  ON bank_accounts(gl_account_code);

-- ---- 6. ERP SYSTEM / SECURITY / AUDIT (sys_* & security) ----
CREATE INDEX IF NOT EXISTS idx_sys_users_role_status
  ON sys_users(role_id, status);
CREATE INDEX IF NOT EXISTS idx_sys_users_branch
  ON sys_users(branch_id);
CREATE INDEX IF NOT EXISTS idx_sys_users_username
  ON sys_users(username);
CREATE INDEX IF NOT EXISTS idx_sys_users_email
  ON sys_users(email);
CREATE INDEX IF NOT EXISTS idx_sys_user_sessions_user
  ON sys_user_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_login_history_user_time
  ON sys_login_history(user_id, login_time DESC);
CREATE INDEX IF NOT EXISTS idx_sys_login_history_ip_time
  ON sys_login_history(ip_address, login_time DESC);
CREATE INDEX IF NOT EXISTS idx_sys_login_history_status_time
  ON sys_login_history(status, login_time DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_logs_entity
  ON sys_audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_logs_user_time
  ON sys_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_logs_created
  ON sys_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_details_log
  ON sys_audit_details(audit_log_id);
-- RBAC joins are frequent in permission checks.
CREATE INDEX IF NOT EXISTS idx_sys_role_permissions_role
  ON sys_role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_sys_permissions_module
  ON sys_permissions(module_code, action_code);
CREATE INDEX IF NOT EXISTS idx_sys_menus_parent
  ON sys_menus(parent_id);
-- Notifications inbox: unread notifications by user.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
-- Translations by key (hot dictionary lookup) + category grouping.
CREATE INDEX IF NOT EXISTS idx_sys_translations_key
  ON sys_translations(key_name);
CREATE INDEX IF NOT EXISTS idx_sys_translations_category
  ON sys_translations(category);
-- OAuth client lookup by client_id (token endpoint hot path).
CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id
  ON oauth_clients(client_id);

-- ---- 7. CUSTOMERS / PARTNERS ----
CREATE INDEX IF NOT EXISTS idx_customers_group_active
  ON customers(group_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_customers_name
  ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone
  ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email
  ON customers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_name
  ON suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_phone
  ON suppliers(phone);
-- Customer groups (membership lookups).
CREATE INDEX IF NOT EXISTS idx_customer_groups_code
  ON customer_groups(code);

-- ---- 8. WEBSHOP E-COMMERCE (the public-facing, high-concurrency zone) ----
CREATE INDEX IF NOT EXISTS idx_web_customers_username
  ON web_customers(username);
CREATE INDEX IF NOT EXISTS idx_web_customers_email
  ON web_customers(email);
CREATE INDEX IF NOT EXISTS idx_web_customers_active
  ON web_customers(id) WHERE is_active = TRUE;
-- Cart session -> items (cart loaded on every page view).
CREATE INDEX IF NOT EXISTS idx_web_cart_items_cart
  ON web_cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_web_cart_items_product
  ON web_cart_items(product_id);
-- Web orders: status + date (order-management dashboard) + customer history.
CREATE INDEX IF NOT EXISTS idx_web_orders_status_date
  ON web_orders(order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_orders_customer_status_date
  ON web_orders(customer_id, order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_orders_code
  ON web_orders(code);
CREATE INDEX IF NOT EXISTS idx_web_order_items_order
  ON web_order_items(web_order_id);
CREATE INDEX IF NOT EXISTS idx_web_order_items_product
  ON web_order_items(product_id);
-- Payments lookup by transaction id / order.
CREATE INDEX IF NOT EXISTS idx_web_payments_order
  ON web_payments(web_order_id);
CREATE INDEX IF NOT EXISTS idx_web_payments_transaction
  ON web_payments(transaction_no) WHERE transaction_no IS NOT NULL;
-- Shipping tracking lookup.
CREATE INDEX IF NOT EXISTS idx_web_shipping_order
  ON web_shipping(web_order_id);
CREATE INDEX IF NOT EXISTS idx_web_shipping_tracking
  ON web_shipping(tracking_code) WHERE tracking_code IS NOT NULL;
-- Product reviews: approved reviews shown per product.
CREATE INDEX IF NOT EXISTS idx_web_product_reviews_product
  ON web_product_reviews(product_id) WHERE is_approved = TRUE;
CREATE INDEX IF NOT EXISTS idx_web_product_reviews_customer
  ON web_product_reviews(customer_id);
-- Wishlists / cart ownership.
CREATE INDEX IF NOT EXISTS idx_web_wishlists_customer
  ON web_wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_web_wishlist_items_wishlist
  ON web_wishlist_items(wishlist_id);
CREATE INDEX IF NOT EXISTS idx_web_wishlist_items_product
  ON web_wishlist_items(product_id);
-- Web banners by active flag + sort.
CREATE INDEX IF NOT EXISTS idx_web_banners_active_sort
  ON web_banners(sort_order) WHERE is_active = TRUE;

-- ---- 9. CRM (leads, opportunities, contacts, activities) ----
CREATE INDEX IF NOT EXISTS idx_crm_leads_code
  ON crm_leads(code);
CREATE INDEX IF NOT EXISTS idx_crm_leads_status_assigned
  ON crm_leads(status, assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source
  ON crm_leads(source);
CREATE INDEX IF NOT EXISTS idx_crm_leads_email
  ON crm_leads(email);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_lead
  ON crm_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_customer
  ON crm_opportunities(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage
  ON crm_opportunities(stage);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_customer
  ON crm_contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_email
  ON crm_contacts(email);
CREATE INDEX IF NOT EXISTS idx_crm_activities_lead
  ON crm_activities(lead_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_opportunity
  ON crm_activities(opportunity_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_assigned
  ON crm_activities(activity_type, activity_date DESC);

-- Reset Sequences to match initial seed IDs safely
SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 1)) FROM companies;
SELECT setval(pg_get_serial_sequence('branches', 'id'), COALESCE(MAX(id), 1)) FROM branches;
SELECT setval(pg_get_serial_sequence('departments', 'id'), COALESCE(MAX(id), 1)) FROM departments;
SELECT setval(pg_get_serial_sequence('sys_roles', 'id'), COALESCE(MAX(id), 1)) FROM sys_roles;
SELECT setval(pg_get_serial_sequence('sys_users', 'id'), COALESCE(MAX(id), 1)) FROM sys_users;
SELECT setval(pg_get_serial_sequence('customer_groups', 'id'), COALESCE(MAX(id), 1)) FROM customer_groups;
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE(MAX(id), 1)) FROM customers;
SELECT setval(pg_get_serial_sequence('suppliers', 'id'), COALESCE(MAX(id), 1)) FROM suppliers;
SELECT setval(pg_get_serial_sequence('uom', 'id'), COALESCE(MAX(id), 1)) FROM uom;
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(MAX(id), 1)) FROM categories;
SELECT setval(pg_get_serial_sequence('brands', 'id'), COALESCE(MAX(id), 1)) FROM brands;
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;
SELECT setval(pg_get_serial_sequence('price_lists', 'id'), COALESCE(MAX(id), 1)) FROM price_lists;
SELECT setval(pg_get_serial_sequence('warehouses', 'id'), COALESCE(MAX(id), 1)) FROM warehouses;
SELECT setval(pg_get_serial_sequence('batches', 'id'), COALESCE(MAX(id), 1)) FROM batches;
SELECT setval(pg_get_serial_sequence('stock_movements', 'id'), COALESCE(MAX(id), 1)) FROM stock_movements;
SELECT setval(pg_get_serial_sequence('quotations', 'id'), COALESCE(MAX(id), 1)) FROM quotations;
SELECT setval(pg_get_serial_sequence('sales_orders', 'id'), COALESCE(MAX(id), 1)) FROM sales_orders;
SELECT setval(pg_get_serial_sequence('sales_deliveries', 'id'), COALESCE(MAX(id), 1)) FROM sales_deliveries;
SELECT setval(pg_get_serial_sequence('purchase_requests', 'id'), COALESCE(MAX(id), 1)) FROM purchase_requests;
SELECT setval(pg_get_serial_sequence('purchase_orders', 'id'), COALESCE(MAX(id), 1)) FROM purchase_orders;
SELECT setval(pg_get_serial_sequence('fiscal_years', 'id'), COALESCE(MAX(id), 1)) FROM fiscal_years;
SELECT setval(pg_get_serial_sequence('accounting_periods', 'id'), COALESCE(MAX(id), 1)) FROM accounting_periods;
SELECT setval(pg_get_serial_sequence('invoices', 'id'), COALESCE(MAX(id), 1)) FROM invoices;
SELECT setval(pg_get_serial_sequence('receipts_payments', 'id'), COALESCE(MAX(id), 1)) FROM receipts_payments;
SELECT setval(pg_get_serial_sequence('journal_entries', 'id'), COALESCE(MAX(id), 1)) FROM journal_entries;
SELECT setval(pg_get_serial_sequence('bank_accounts', 'id'), COALESCE(MAX(id), 1)) FROM bank_accounts;
SELECT setval(pg_get_serial_sequence('fixed_assets', 'id'), COALESCE(MAX(id), 1)) FROM fixed_assets;
SELECT setval(pg_get_serial_sequence('crm_leads', 'id'), COALESCE(MAX(id), 1)) FROM crm_leads;
SELECT setval(pg_get_serial_sequence('crm_opportunities', 'id'), COALESCE(MAX(id), 1)) FROM crm_opportunities;
SELECT setval(pg_get_serial_sequence('web_customers', 'id'), COALESCE(MAX(id), 1)) FROM web_customers;
SELECT setval(pg_get_serial_sequence('web_promotions', 'id'), COALESCE(MAX(id), 1)) FROM web_promotions;
SELECT setval(pg_get_serial_sequence('web_orders', 'id'), COALESCE(MAX(id), 1)) FROM web_orders;

-- ============================================================
-- END OF COMPREHENSIVE SCHEMAS SCRIPT FOR ERPACC & WEBSHOP
-- ============================================================
-- ============================================================
-- MULTI-TENANCY: ADD company_id TO ALL BUSINESS TABLES
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_default_shop BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS tenant_workspaces (
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
);

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
ON CONFLICT (company_id) DO NOTHING;

ALTER TABLE products ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE product_attributes ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE product_cost_history ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE price_list_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE supplier_prices ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE customer_groups ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE warehouse_locations ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE serial_numbers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_balances ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_movement_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_transfers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_transfer_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_adjustments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_adjustment_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stocktaking_sessions ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stocktaking_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE stock_reservations ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE fifo_cost_layers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_order_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_deliveries ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_delivery_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_returns ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_return_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE sales_commissions ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_request_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_rfqs ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_rfq_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE supplier_quotations ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE supplier_quotation_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_receipts ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_receipt_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_returns ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE purchase_return_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE vat_declarations ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE receipts_payments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE fixed_assets ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE asset_depreciations ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE crm_opportunities ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE crm_contacts ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_customers ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_promotions ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_carts ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_cart_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_orders ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_order_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_wishlists ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_wishlist_items ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_payments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_shipping ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_product_reviews ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE web_banners ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE document_sequences ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;
ALTER TABLE chart_of_accounts ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) DEFAULT 1;

-- Indexes for tenant isolation
CREATE INDEX IF NOT EXISTS idx_products_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_company ON customers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_company ON stock_balances(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_sales_orders_company ON sales_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_company ON purchase_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_web_orders_company ON web_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);

-- Normalised uniqueness rules. Formatting/case differences must not create a
-- second company or account (for example `ABC-123` vs `abc 123`).
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_tax_code_normalized
  ON companies (UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')))
  WHERE tax_code IS NOT NULL AND BTRIM(tax_code) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_email_normalized
  ON companies (LOWER(BTRIM(email)))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_users_email_normalized
  ON sys_users (LOWER(BTRIM(email)))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_tax_code_normalized
  ON customers (company_id, UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')))
  WHERE tax_code IS NOT NULL AND BTRIM(tax_code) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_email_normalized
  ON customers (company_id, LOWER(BTRIM(email)))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_tax_code_normalized
  ON suppliers (company_id, UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')))
  WHERE tax_code IS NOT NULL AND BTRIM(tax_code) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_company_email_normalized
  ON suppliers (company_id, LOWER(BTRIM(email)))
  WHERE email IS NOT NULL AND BTRIM(email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_web_customers_company_email_normalized
  ON web_customers (company_id, LOWER(BTRIM(email)));

-- Only one explicit storefront may answer requests that do not contain a
-- tenant slug. Tenant-specific stores always use their own slug.
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_default_shop
  ON companies (is_default_shop)
  WHERE is_default_shop = TRUE;

-- ============================================================
-- END MULTI-TENANCY SCHEMA EXTENSION
-- ============================================================
-- Target: Performance & Speed Testing on PostgreSQL / Supabase
-- Contains: 500+ Products, 100+ Customers, 50+ Suppliers,
--           2,000+ Sales Orders, 5,000+ Order Items,
--           1,000+ Invoices, 3,000+ Journal Entries,
--           1,000+ WebShop Orders & Customers.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. ADDITIONAL MASTER DATA (Categories, Brands, UOMs)
-- ------------------------------------------------------------
INSERT INTO categories (id, parent_id, code, name_vi, name_en, sort_order) VALUES
(10, NULL, 'CAT_SON', 'Sơn & Hóa Chất Xây Dựng', 'Paints & Construction Chemicals', 5),
(11, NULL, 'CAT_KEO', 'Keo Dán Gạch & Chống Thấm', 'Adhesives & Waterproofing', 6),
(12, NULL, 'CAT_GO', 'Gỗ Xây Dựng & Ván Ép', 'Lumber & Plywood', 7),
(13, NULL, 'CAT_KHI', 'Hệ Thống Thông Gió & ĐIều Hòa', 'HVAC & Ventilation', 8)
ON CONFLICT (code) DO NOTHING;

INSERT INTO brands (id, code, name_vi, name_en) VALUES
(10, 'BR_DULUX', 'Sơn Dulux AkzoNobel', 'Dulux Paints'),
(11, 'BR_JOTUN', 'Sơn Jotun Na Uy', 'Jotun Paints'),
(12, 'BR_SIKA', 'Hóa Chất Sika Thụy Sĩ', 'Sika Chemical'),
(13, 'BR_CADIVI', 'Dây Cáp Điện Cadivi', 'Cadivi Electric'),
(14, 'BR_INAX', 'Thiết Bị Vệ Sinh Inax', 'Inax Sanitaryware')
ON CONFLICT (code) DO NOTHING;

INSERT INTO uom (id, code, name_vi, name_en) VALUES
(10, 'THUNG', 'Thùng 18L', 'Bucket 18L'),
(11, 'CUON', 'Cuộn 100m', 'Roll 100m'),
(12, 'BOPHUKO', 'Bộ / Phụ kiên', 'Set / Accessory'),
(13, 'TAM', 'Tấm', 'Sheet')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 2. BULK GENERATION OF PRODUCTS & VARIANTS (500 Products)
-- ------------------------------------------------------------
DO $$
DECLARE
    i INT;
    cat_ids INT[] := ARRAY[1, 2, 3, 4, 10, 11, 12, 13];
    brand_ids INT[] := ARRAY[1, 2, 3, 10, 11, 12, 13, 14];
    uom_ids INT[] := ARRAY[1, 2, 3, 4, 5, 10, 11, 13];
    cat_id INT;
    brand_id INT;
    uom_id INT;
    c_price NUMERIC;
    s_price NUMERIC;
    w_price NUMERIC;
    p_code VARCHAR(50);
    p_sku VARCHAR(50);
    p_name_vi VARCHAR(200);
    p_name_en VARCHAR(200);
BEGIN
    FOR i IN 5..500 LOOP
        cat_id := cat_ids[1 + (i % 8)];
        brand_id := brand_ids[1 + (i % 8)];
        uom_id := uom_ids[1 + (i % 8)];
        c_price := 10000 + (i * 2500);
        s_price := c_price * 1.18;
        w_price := c_price * 1.15;
        p_code := 'SP-VT-' || LPAD(i::text, 5, '0');
        p_sku := 'SKU-VT-' || LPAD(i::text, 5, '0');
        p_name_vi := 'Vật Tư Xây Dựng Bách Khoa Cao Cấp Mẫu #' || i;
        p_name_en := 'Premium Construction Material Spec #' || i;

        INSERT INTO products (
            id, code, sku, barcode, name_vi, name_en, category_id, brand_id, uom_id,
            cost_price, selling_price, web_price, stock_quantity, min_stock, max_stock,
            is_web_visible, is_active, created_at
        ) VALUES (
            i, p_code, p_sku, '893999' || LPAD(i::text, 6, '0'),
            p_name_vi, p_name_en, cat_id, brand_id, uom_id,
            c_price, s_price, w_price, (i * 12) % 2000 + 50, 20, 5000,
            TRUE, TRUE, CURRENT_TIMESTAMP - (i || ' hours')::INTERVAL
        ) ON CONFLICT (code) DO NOTHING;

        -- Product Images
        INSERT INTO product_images (product_id, image_url, is_primary, sort_order)
        VALUES (
            i,
            'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800',
            TRUE,
            1
        ) ON CONFLICT DO NOTHING;

        -- Product Attributes
        INSERT INTO product_attributes (product_id, attr_name_vi, attr_name_en, attr_value_vi, attr_value_en)
        VALUES (
            i,
            'Xuất Xứ / QC', 'Origin / QC',
            'Việt Nam - ISO 9001:2026', 'Vietnam - ISO 9001:2026'
        ) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 3. BULK GENERATION OF CUSTOMERS (100 Corporate & Retail)
-- ------------------------------------------------------------
DO $$
DECLARE
    i INT;
    grp_id INT;
    c_code VARCHAR(30);
    c_name VARCHAR(200);
    tax_no VARCHAR(50);
    phone_no VARCHAR(20);
    email_addr VARCHAR(100);
    company_prefixes VARCHAR[] := ARRAY['Công Ty TNHH', 'Tập Đoàn Xây Dựng', 'Tổng Công Ty CP', 'Cửa Hàng Đại Lý', 'Doanh Nghiệp Tư Nhân'];
    company_names VARCHAR[] := ARRAY['An Phong', 'Hòa Bình', 'Coteccons', 'Ricons', 'Unicons', 'Delta', 'Phục Hưng', 'Thành Công', 'Minh Thịnh', 'Hưng Thịnh'];
BEGIN
    FOR i IN 3..100 LOOP
        grp_id := (i % 3) + 1;
        c_code := 'KH-' || LPAD(i::text, 4, '0');
        c_name := company_prefixes[1 + (i % 5)] || ' ' || company_names[1 + (i % 10)] || ' ' || (i * 7);
        tax_no := '03' || LPAD((10000000 + i * 37)::text, 8, '0');
        phone_no := '09' || LPAD((10000000 + i * 89)::text, 8, '0');
        email_addr := 'contact.kh' || i || '@partner-corp.vn';

        INSERT INTO customers (
            id, group_id, code, name, tax_code, phone, email, address, credit_limit, payment_terms_days, is_active
        ) VALUES (
            i, grp_id, c_code, c_name, tax_no, phone_no, email_addr,
            'Tầng ' || (i % 25 + 1) || ', Tòa nhà Plaza ' || i || ', Quận ' || (i % 12 + 1) || ', TP.HCM',
            50000000 + (i * 5000000), 30, TRUE
        ) ON CONFLICT (code) DO NOTHING;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. BULK GENERATION OF SUPPLIERS (30 Suppliers)
-- ------------------------------------------------------------
DO $$
DECLARE
    i INT;
    s_code VARCHAR(30);
    s_name VARCHAR(200);
    supp_names VARCHAR[] := ARRAY['Nhà Máy Thép Việt Nhật', 'Công Ty TNHH Nhựa Bình Minh', 'Tập Đoàn Hoa Sen', 'Thép Pomina', 'Xi Măng Nghi Sơn', 'Sơn KOVA Việt Nam', 'Gạch Đồng Tâm', 'Dây Cáp Điện Cadivi'];
BEGIN
    FOR i IN 3..30 LOOP
        s_code := 'NCC-' || LPAD(i::text, 3, '0');
        s_name := supp_names[1 + (i % 8)] || ' Chi Nhánh ' || i;

        INSERT INTO suppliers (
            id, code, name, tax_code, phone, email, address, bank_account, bank_name, payment_terms
        ) VALUES (
            i, s_code, s_name,
            '010' || LPAD((5000000 + i * 19)::text, 7, '0'),
            '024' || LPAD((7000000 + i * 31)::text, 7, '0'),
            'sales.ncc' || i || '@supplier.com.vn',
            'Khu Công Nghiệp ' || (i % 5 + 1) || ', Tỉnh Bình Dương',
            '102' || LPAD((9900000 + i * 11)::text, 9, '0'),
            'Vietcombank', '30 ngày kể từ ngày giao hàng'
        ) ON CONFLICT (code) DO NOTHING;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 5. STOCK BALANCES FOR WAREHOUSES
-- ------------------------------------------------------------
DO $$
DECLARE
    p_id INT;
BEGIN
    FOR p_id IN 5..500 LOOP
        INSERT INTO stock_balances (warehouse_id, product_id, quantity)
        VALUES 
            (1, p_id, (p_id * 15) % 1500 + 100),
            (2, p_id, (p_id * 8) % 800 + 50)
        ON CONFLICT (warehouse_id, product_id, batch_id) DO NOTHING;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6. BULK SALES ORDERS & ORDER ITEMS (2,000 Sales Orders)
-- ------------------------------------------------------------
DO $$
DECLARE
    o_id INT;
    cust_id INT;
    s_rep INT;
    o_code VARCHAR(50);
    o_date DATE;
    sub_tot NUMERIC;
    vat_tot NUMERIC;
    grand_tot NUMERIC;
    p_id INT;
    p_price NUMERIC;
    p_qty INT;
    item_sub NUMERIC;
BEGIN
    FOR o_id IN 2..2000 LOOP
        cust_id := (o_id % 95) + 1;
        s_rep := 1 + (o_id % 4);
        o_code := 'SO-2026-' || LPAD(o_id::text, 6, '0');
        o_date := CURRENT_DATE - (o_id % 180 || ' days')::INTERVAL;
        
        -- Pick 3 items per order
        sub_tot := 0;
        
        INSERT INTO sales_orders (
            id, code, customer_id, sales_rep_id, order_date,
            subtotal, discount_amount, tax_amount, total_amount,
            payment_status, status, created_at
        ) VALUES (
            o_id, o_code, cust_id, s_rep, o_date,
            0, 0, 0, 0,
            CASE WHEN o_id % 3 = 0 THEN 'DA_THANH_TOAN' WHEN o_id % 3 = 1 THEN 'COC_MOT_PHAN' ELSE 'CHUA_THANH_TOAN' END,
            'HOAN_THANH',
            o_date
        ) ON CONFLICT (code) DO NOTHING;

        -- Order items
        FOR item_idx IN 1..3 LOOP
            p_id := ((o_id * 7 + item_idx * 13) % 490) + 1;
            p_price := 15000 + (p_id * 2000);
            p_qty := (o_id + item_idx) % 50 + 5;
            item_sub := p_price * p_qty;
            sub_tot := sub_tot + item_sub;

            INSERT INTO sales_order_items (
                sales_order_id, product_id, quantity, unit_price, subtotal
            ) VALUES (
                o_id, p_id, p_qty, p_price, item_sub
            );
        END LOOP;

        vat_tot := sub_tot * 0.10;
        grand_tot := sub_tot + vat_tot;

        UPDATE sales_orders 
        SET subtotal = sub_tot, tax_amount = vat_tot, total_amount = grand_tot 
        WHERE id = o_id;

    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 7. BULK INVOICES & INVOICE ITEMS (1,000 Invoices)
-- ------------------------------------------------------------
DO $$
DECLARE
    inv_id INT;
    so_id INT;
    c_id INT;
    inv_code VARCHAR(50);
    inv_date DATE;
    s_amount NUMERIC;
    t_amount NUMERIC;
    g_amount NUMERIC;
BEGIN
    FOR inv_id IN 2..1000 LOOP
        so_id := inv_id;
        c_id := (inv_id % 95) + 1;
        inv_code := 'HD-2026-' || LPAD(inv_id::text, 6, '0');
        inv_date := CURRENT_DATE - (inv_id % 150 || ' days')::INTERVAL;
        
        s_amount := 5000000 + (inv_id * 150000);
        t_amount := s_amount * 0.10;
        g_amount := s_amount + t_amount;

        INSERT INTO invoices (
            id, code, order_id, customer_id, invoice_date, due_date,
            subtotal, tax_amount, total_amount, status, created_at
        ) VALUES (
            inv_id, inv_code, so_id, c_id, inv_date, inv_date + INTERVAL '30 days',
            s_amount, t_amount, g_amount, 'Đã phát hành', inv_date
        ) ON CONFLICT (code) DO NOTHING;

        -- Invoice line items
        INSERT INTO invoice_items (
            invoice_id, product_id, uom_id, quantity, unit_price, vat_rate, vat_amount, subtotal
        ) VALUES (
            inv_id, (inv_id % 490) + 1, 1, (inv_id % 20) + 1, s_amount / ((inv_id % 20) + 1), 10.00, t_amount, s_amount
        );
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 8. BULK GENERAL LEDGER JOURNAL ENTRIES (2,000 Entries)
-- ------------------------------------------------------------
DO $$
DECLARE
    j_id INT;
    j_code VARCHAR(50);
    j_date DATE;
    j_amount NUMERIC;
    cust_partner INT;
BEGIN
    FOR j_id IN 2..2000 LOOP
        j_code := 'PKT-2026-' || LPAD(j_id::text, 6, '0');
        j_date := CURRENT_DATE - (j_id % 180 || ' days')::INTERVAL;
        j_amount := 2000000 + (j_id * 50000);
        cust_partner := (j_id % 95) + 1;

        INSERT INTO journal_entries (
            id, code, entry_date, posting_date, description, reference_type, reference_id, created_at
        ) VALUES (
            j_id, j_code, j_date, j_date,
            'Hạch toán tự động doanh thu bán hàng hóa hóa đơn #' || j_id,
            'INVOICE', j_id, j_date
        ) ON CONFLICT (code) DO NOTHING;

        -- Debit Account 131 (Phải thu khách hàng)
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, partner_id, debit_amount, credit_amount, note)
        VALUES (j_id, '131', cust_partner, j_amount * 1.10, 0, 'Nợ 131 - Phải thu khách hàng');

        -- Credit Account 5111 (Doanh thu bán hàng)
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, partner_id, debit_amount, credit_amount, note)
        VALUES (j_id, '5111', cust_partner, 0, j_amount, 'Có 5111 - Doanh thu hàng hóa');

        -- Credit Account 33311 (Thuế GTGT đầu ra)
        INSERT INTO journal_entry_lines (journal_entry_id, account_code, partner_id, debit_amount, credit_amount, note)
        VALUES (j_id, '33311', cust_partner, 0, j_amount * 0.10, 'Có 33311 - Thuế GTGT đầu ra');
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 9. BULK RECEIPTS & PAYMENTS (1,500 Cash / Bank Vouchers)
-- ------------------------------------------------------------
DO $$
DECLARE
    rp_id INT;
    rp_code VARCHAR(50);
    rp_date DATE;
    rp_amount NUMERIC;
    partner INT;
BEGIN
    FOR rp_id IN 3..1500 LOOP
        rp_code := CASE WHEN rp_id % 2 = 0 THEN 'PT-2026-' ELSE 'PC-2026-' END || LPAD(rp_id::text, 6, '0');
        rp_date := CURRENT_DATE - (rp_id % 180 || ' days')::INTERVAL;
        rp_amount := 1000000 + (rp_id * 75000);
        partner := (rp_id % 90) + 1;

        INSERT INTO receipts_payments (
            id, code, voucher_type, partner_type, partner_id, amount,
            payment_method, payment_date, reason, created_at
        ) VALUES (
            rp_id, rp_code,
            CASE WHEN rp_id % 2 = 0 THEN 'THU' ELSE 'CHI' END,
            CASE WHEN rp_id % 2 = 0 THEN 'KHACH_HANG' ELSE 'NHA_CUNG_CAP' END,
            partner, rp_amount,
            CASE WHEN rp_id % 3 = 0 THEN 'TIEN_MAT' ELSE 'CHUYEN_KHOAN' END,
            rp_date,
            CASE WHEN rp_id % 2 = 0 THEN 'Thu tiền công nợ hóa đơn hàng tháng' ELSE 'Thanh toán tiền hàng cho nhà cung cấp' END,
            rp_date
        ) ON CONFLICT (code) DO NOTHING;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 10. BULK WEBSHOP CUSTOMERS, ORDERS & REVIEWS (1,000 Web Orders)
-- ------------------------------------------------------------
DO $$
DECLARE
    wc_id INT;
    wo_id INT;
    wo_code VARCHAR(50);
    p_id INT;
    sub_val NUMERIC;
BEGIN
    -- 100 Web Customers
    FOR wc_id IN 2..100 LOOP
        INSERT INTO web_customers (
            id, username, email, password_hash, full_name, phone, address, city
        ) VALUES (
            wc_id,
            'webuser_' || wc_id,
            'customer' || wc_id || '@gmail.com',
            '$2b$10$nOhEow9TW63DW0ZDzsUc4u5velQhnmkI.NNu7oCMp1NLsCRS.J92.',
            'Khách Hàng Online #' || wc_id,
            '097' || LPAD((1000000 + wc_id * 17)::text, 7, '0'),
            'Đường Số ' || wc_id || ', Phường ' || (wc_id % 15 + 1),
            CASE WHEN wc_id % 2 = 0 THEN 'TP.Hồ Chí Minh' ELSE 'Hà Nội' END
        ) ON CONFLICT (username) DO NOTHING;
    END LOOP;

    -- 1,000 Web Orders
    FOR wo_id IN 2..1000 LOOP
        wc_id := (wo_id % 98) + 2;
        wo_code := 'WEB-2026-' || LPAD(wo_id::text, 6, '0');
        sub_val := 300000 + (wo_id * 25000);

        INSERT INTO web_orders (
            id, code, customer_id, customer_name, customer_phone, customer_email,
            shipping_address, payment_method, payment_status, order_status,
            subtotal, discount_amount, shipping_fee, total_amount, created_at
        ) VALUES (
            wo_id, wo_code, wc_id,
            'Khách Hàng Online #' || wc_id,
            '097' || LPAD((1000000 + wc_id * 17)::text, 7, '0'),
            'customer' || wc_id || '@gmail.com',
            'Số ' || wo_id || ' Đường Nguyễn Văn Cừ, Quận 5, TP.HCM',
            CASE WHEN wo_id % 4 = 0 THEN 'COD' WHEN wo_id % 4 = 1 THEN 'BANK_TRANSFER' WHEN wo_id % 4 = 2 THEN 'VNPAY' ELSE 'MOMO' END,
            CASE WHEN wo_id % 2 = 0 THEN 'DA_THANH_TOAN' ELSE 'CHUA_THANH_TOAN' END,
            CASE WHEN wo_id % 5 = 0 THEN 'DA_GIAO' WHEN wo_id % 5 = 1 THEN 'DANG_GIAO' WHEN wo_id % 5 = 2 THEN 'DA_XAC_NHAN' ELSE 'CHO_XAC_NHAN' END,
            sub_val, 0, 30000, sub_val + 30000,
            CURRENT_TIMESTAMP - (wo_id % 90 || ' days')::INTERVAL
        ) ON CONFLICT (code) DO NOTHING;

        -- Order items
        p_id := (wo_id % 490) + 1;
        INSERT INTO web_order_items (
            web_order_id, product_id, product_name, quantity, unit_price, subtotal
        ) VALUES (
            wo_id, p_id, 'Sản Phẩm WebShop High-Tech #' || p_id, (wo_id % 5) + 1, sub_val / ((wo_id % 5) + 1), sub_val
        );
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 11. CRM LEADS & OPPORTUNITIES (300 Leads)
-- ------------------------------------------------------------
DO $$
DECLARE
    lead_idx INT;
BEGIN
    FOR lead_idx IN 2..300 LOOP
        INSERT INTO crm_leads (
            id, code, company_name, contact_name, phone, email, source,
            estimated_revenue, status, assigned_to
        ) VALUES (
            lead_idx,
            'LEAD-2026-' || LPAD(lead_idx::text, 4, '0'),
            'Dự Án ĐT & XD Bách Khoa #' || lead_idx,
            'Giám Đốc Dự Án #' || lead_idx,
            '091' || LPAD((5000000 + lead_idx * 23)::text, 7, '0'),
            'lead' || lead_idx || '@construction.com.vn',
            CASE WHEN lead_idx % 3 = 0 THEN 'WEBSITE' WHEN lead_idx % 3 = 1 THEN 'CALL' ELSE 'REFERRAL' END,
            100000000 + (lead_idx * 5000000),
            CASE WHEN lead_idx % 4 = 0 THEN 'CHUYEN_DOI' WHEN lead_idx % 4 = 1 THEN 'TIEM_NANG' ELSE 'LIEN_HE' END,
            4
        ) ON CONFLICT (code) DO NOTHING;
    END LOOP;
END $$;

-- ------------------------------------------------------------
-- 12. RESET SERIAL SEQUENCES FOR INTEGRITY
-- ------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE(MAX(id), 1)) FROM companies;
SELECT setval(pg_get_serial_sequence('branches', 'id'), COALESCE(MAX(id), 1)) FROM branches;
SELECT setval(pg_get_serial_sequence('departments', 'id'), COALESCE(MAX(id), 1)) FROM departments;
SELECT setval(pg_get_serial_sequence('sys_roles', 'id'), COALESCE(MAX(id), 1)) FROM sys_roles;
SELECT setval(pg_get_serial_sequence('sys_users', 'id'), COALESCE(MAX(id), 1)) FROM sys_users;
SELECT setval(pg_get_serial_sequence('customer_groups', 'id'), COALESCE(MAX(id), 1)) FROM customer_groups;
SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE(MAX(id), 1)) FROM customers;
SELECT setval(pg_get_serial_sequence('suppliers', 'id'), COALESCE(MAX(id), 1)) FROM suppliers;
SELECT setval(pg_get_serial_sequence('uom', 'id'), COALESCE(MAX(id), 1)) FROM uom;
SELECT setval(pg_get_serial_sequence('categories', 'id'), COALESCE(MAX(id), 1)) FROM categories;
SELECT setval(pg_get_serial_sequence('brands', 'id'), COALESCE(MAX(id), 1)) FROM brands;
SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE(MAX(id), 1)) FROM products;
SELECT setval(pg_get_serial_sequence('price_lists', 'id'), COALESCE(MAX(id), 1)) FROM price_lists;
SELECT setval(pg_get_serial_sequence('warehouses', 'id'), COALESCE(MAX(id), 1)) FROM warehouses;
SELECT setval(pg_get_serial_sequence('batches', 'id'), COALESCE(MAX(id), 1)) FROM batches;
SELECT setval(pg_get_serial_sequence('stock_movements', 'id'), COALESCE(MAX(id), 1)) FROM stock_movements;
SELECT setval(pg_get_serial_sequence('quotations', 'id'), COALESCE(MAX(id), 1)) FROM quotations;
SELECT setval(pg_get_serial_sequence('sales_orders', 'id'), COALESCE(MAX(id), 1)) FROM sales_orders;
SELECT setval(pg_get_serial_sequence('sales_deliveries', 'id'), COALESCE(MAX(id), 1)) FROM sales_deliveries;
SELECT setval(pg_get_serial_sequence('purchase_requests', 'id'), COALESCE(MAX(id), 1)) FROM purchase_requests;
SELECT setval(pg_get_serial_sequence('purchase_orders', 'id'), COALESCE(MAX(id), 1)) FROM purchase_orders;
SELECT setval(pg_get_serial_sequence('fiscal_years', 'id'), COALESCE(MAX(id), 1)) FROM fiscal_years;
SELECT setval(pg_get_serial_sequence('accounting_periods', 'id'), COALESCE(MAX(id), 1)) FROM accounting_periods;
SELECT setval(pg_get_serial_sequence('invoices', 'id'), COALESCE(MAX(id), 1)) FROM invoices;
SELECT setval(pg_get_serial_sequence('receipts_payments', 'id'), COALESCE(MAX(id), 1)) FROM receipts_payments;
SELECT setval(pg_get_serial_sequence('journal_entries', 'id'), COALESCE(MAX(id), 1)) FROM journal_entries;
SELECT setval(pg_get_serial_sequence('bank_accounts', 'id'), COALESCE(MAX(id), 1)) FROM bank_accounts;
SELECT setval(pg_get_serial_sequence('fixed_assets', 'id'), COALESCE(MAX(id), 1)) FROM fixed_assets;
SELECT setval(pg_get_serial_sequence('crm_leads', 'id'), COALESCE(MAX(id), 1)) FROM crm_leads;
SELECT setval(pg_get_serial_sequence('crm_opportunities', 'id'), COALESCE(MAX(id), 1)) FROM crm_opportunities;
SELECT setval(pg_get_serial_sequence('web_customers', 'id'), COALESCE(MAX(id), 1)) FROM web_customers;
SELECT setval(pg_get_serial_sequence('web_promotions', 'id'), COALESCE(MAX(id), 1)) FROM web_promotions;
SELECT setval(pg_get_serial_sequence('web_orders', 'id'), COALESCE(MAX(id), 1)) FROM web_orders;

COMMIT;

-- ============================================================
-- END OF INSERTDATA.SQL BENCHMARK DATASET
-- ============================================================
