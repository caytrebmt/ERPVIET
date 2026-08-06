-- ============================================================
-- BULK HIGH-VOLUME TEST DATA GENERATOR FOR ERPACC & WEBSHOP
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
            '$2a$10$wT0C2c2E1v6cE8Xg8A3A8uQ4P0O6N9M8L7K6J5H4G3F2E1D0C',
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
