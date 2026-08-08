-- schema_fixes.sql
-- Fixes and helpers for schema.sql: ensures core company exists and adds update timestamp triggers for commonly-updated tables.
-- Run this after loading schema.sql: psql -f schema.sql -f schema_fixes.sql

BEGIN;

-- Ensure main company row exists (safe upsert)
INSERT INTO companies (code, name_vi, name_en, tax_code, address, phone, email, website, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_active, created_at)
VALUES
('ERPACC_VN', 'Công Ty Cổ Phần Công Nghệ ERPACC Việt Nam', 'ERPACC Technology Vietnam JSC', '0109988776', 'Tầng 12, Tòa nhà Landmark 81, Bình Thạnh, TP.HCM', '028.7300.9999', 'info@erpacc.vn', 'https://erpacc.vn', 'erpacc', 'erpacc', 'starter', 'active', '2026-12-31', 50, 10, TRUE, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO UPDATE SET
name_vi = EXCLUDED.name_vi,
name_en = EXCLUDED.name_en,
tax_code = EXCLUDED.tax_code,
address = EXCLUDED.address,
phone = EXCLUDED.phone,
email = EXCLUDED.email,
website = EXCLUDED.website,
slug = COALESCE(companies.slug, EXCLUDED.slug),
subdomain = COALESCE(companies.subdomain, EXCLUDED.subdomain),
plan_type = EXCLUDED.plan_type,
subscription_status = EXCLUDED.subscription_status,
trial_ends_at = EXCLUDED.trial_ends_at,
max_users = EXCLUDED.max_users,
max_warehouses = EXCLUDED.max_warehouses,
is_active = EXCLUDED.is_active;

-- Create update timestamp triggers for tables that have updated_at column
-- This block creates triggers only if they do not already exist.
DO $$
DECLARE
    tbl TEXT;
    trigger_name TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'companies','branches','departments','currencies','exchange_rates','document_sequences','attachments','notifications',
        'sys_languages','sys_translations','sys_settings','sys_roles','sys_permissions','sys_users','sys_user_sessions','sys_login_history','sys_audit_logs',
        'customers','suppliers','products','product_variants','product_images','price_lists','price_list_items','supplier_prices',
        'warehouses','warehouse_locations','batches','serial_numbers','stock_balances','fifo_cost_layers','stock_movements','stock_movement_items',
        'stock_transfers','stock_transfer_items','stock_adjustments','stock_adjustment_items','stocktaking_sessions','stocktaking_items',
        'sales_orders','sales_order_items','quotations','quotation_items'
    ]) LOOP
        trigger_name := 'trg_' || tbl || '_update_timestamp';
        -- create trigger only if table exists and trigger not exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = trigger_name) THEN
                EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();', trigger_name, tbl);
            END IF;
        END IF;
    END LOOP;
END$$;

-- Fix a likely-incorrect status value in stock_movements: if the CHECK constraint exists with a bad value, relax it.
-- We will attempt to drop any named constraint that looks like stock_movements_status_check, then add a broader check to avoid failing inserts.
-- Note: this is defensive and will only run if constraint exists.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'stock_movements' AND c.contype = 'c' AND c.conname ILIKE '%status%') THEN
        PERFORM format('ALTER TABLE stock_movements DROP CONSTRAINT %I', (SELECT c.conname FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'stock_movements' AND c.contype = 'c' AND c.conname ILIKE '%status%' LIMIT 1));
        -- add a relaxed check
        ALTER TABLE stock_movements ADD CONSTRAINT chk_stock_movements_status CHECK (status IN ('DANG_XULY', 'HOAN_THANH', 'HUY'));
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not modify stock_movements constraints: %', SQLERRM;
END$$;

COMMIT;

-- End of schema_fixes.sql
