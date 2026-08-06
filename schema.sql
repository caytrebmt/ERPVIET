-- ============================================================
-- ERPVIET - Canonical, fast-loading schema.sql (branch: sql/standardize-all)
-- Purpose: single canonical schema for the project, optimized for
-- fast load in Postgres (v13+) while preserving necessary indexes
-- and adding trigram search + JSON pagination helper for the webshop.
-- ============================================================

-- Extensions (safe, commonly available on Postgres 13+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
-- OPTIONAL: trigram extension improves ILIKE search performance. Requires CREATE EXTENSION privilege.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

SET client_min_messages = WARNING;

-- Helper function to keep updated_at up-to-date
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------
-- Core lightweight tables
-- --------------------
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
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branches (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL,
  code VARCHAR(30) NOT NULL,
  name_vi VARCHAR(200) NOT NULL,
  address VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_branch_company_code UNIQUE(company_id, code)
  -- Foreign keys are intentionally optional to speed up bulk loads.
);

-- Users / Roles (core fields only)
CREATE TABLE IF NOT EXISTS sys_roles (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_vi VARCHAR(100) NOT NULL,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sys_users (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT DEFAULT 1,
  branch_id BIGINT DEFAULT 1,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  role_id BIGINT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','locked','disabled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_active ON sys_users(status) WHERE status = 'active';

-- --------------------
-- Master data: products and related
-- --------------------
CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT,
  code VARCHAR(30) UNIQUE NOT NULL,
  name_vi VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS brands (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name_vi VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS uom (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name_vi VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  sku VARCHAR(50) UNIQUE,
  name_vi VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  category_id BIGINT,
  brand_id BIGINT,
  uom_id BIGINT,
  cost_price NUMERIC(15,2) DEFAULT 0 CHECK (cost_price >= 0),
  selling_price NUMERIC(15,2) DEFAULT 0 CHECK (selling_price >= 0),
  web_price NUMERIC(15,2) DEFAULT 0 CHECK (web_price >= 0),
  vat_rate NUMERIC(5,2) DEFAULT 10.00 CHECK (vat_rate >= 0 AND vat_rate <= 100),
  stock_quantity INT DEFAULT 0,
  min_stock INT DEFAULT 10,
  is_web_visible BOOLEAN DEFAULT TRUE,
  description_vi TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Minimal image table used by webshop to display thumbnails
CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_attributes (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  attr_name VARCHAR(100) NOT NULL,
  attr_value VARCHAR(255) NOT NULL
);

-- Indexes to make webshop queries fast (search + list + pagination)
CREATE INDEX IF NOT EXISTS idx_products_is_web_visible_created_at ON products(is_web_visible, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_web_price ON products(web_price);
CREATE INDEX IF NOT EXISTS idx_products_name_vi_fts ON products USING gin(to_tsvector('vietnamese', coalesce(name_vi,'')));

-- Trigram indexes for fast ILIKE searches (requires pg_trgm)
CREATE INDEX IF NOT EXISTS idx_products_name_vi_trgm ON products USING gin (name_vi gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_name_en_trgm ON products USING gin (name_en gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_code_trgm ON products USING gin (code gin_trgm_ops);

-- Covering index for common listing queries
CREATE INDEX IF NOT EXISTS idx_products_list_cover ON products(is_web_visible, id) INCLUDE (web_price, stock_quantity, name_vi);

-- --------------------
-- Webshop helper: product pagination function (returns rows + total_count)
-- --------------------
CREATE OR REPLACE FUNCTION webshop_get_products(
  p_page INT DEFAULT 1,
  p_per_page INT DEFAULT 20,
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'created_at',
  p_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id BIGINT,
  code VARCHAR,
  sku VARCHAR,
  name_vi VARCHAR,
  name_en VARCHAR,
  web_price NUMERIC,
  stock_quantity INT,
  primary_image TEXT,
  is_web_visible BOOLEAN,
  total_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_offset INT := GREATEST(0, (p_page - 1) * p_per_page);
  v_sort_col TEXT := lower(p_sort);
  v_dir TEXT := lower(p_dir);
  v_total BIGINT;
  v_sql TEXT;
  v_allowed_cols TEXT[] := ARRAY['created_at','web_price','name_vi','stock_quantity','id'];
BEGIN
  -- validate inputs
  IF v_sort_col NOT IN (SELECT unnest(v_allowed_cols)) THEN
    v_sort_col := 'created_at';
  END IF;
  IF v_dir NOT IN ('asc','desc') THEN
    v_dir := 'desc';
  END IF;
  IF p_per_page <= 0 OR p_per_page > 1000 THEN
    p_per_page := 20; -- reasonable cap
  END IF;

  -- compute total count
  IF p_search IS NULL OR trim(p_search) = '' THEN
    SELECT COUNT(*) INTO v_total FROM products WHERE is_web_visible = TRUE;
  ELSE
    SELECT COUNT(*) INTO v_total FROM products p
      WHERE is_web_visible = TRUE
        AND (p.name_vi ILIKE ('%' || p_search || '%') OR p.name_en ILIKE ('%' || p_search || '%') OR p.code ILIKE ('%' || p_search || '%'));
  END IF;

  -- build dynamic SQL for the page
  v_sql := 'SELECT p.id, p.code, p.sku, p.name_vi, p.name_en, p.web_price, p.stock_quantity, pi.image_url AS primary_image, p.is_web_visible'
           || ', ' || v_total || '::bigint AS total_count'
           || ' FROM products p'
           || ' LEFT JOIN LATERAL (SELECT image_url FROM product_images WHERE product_id = p.id ORDER BY is_primary DESC, sort_order ASC LIMIT 1) pi ON true'
           || ' WHERE p.is_web_visible = TRUE';

  IF p_search IS NOT NULL AND trim(p_search) <> '' THEN
    v_sql := v_sql || ' AND (p.name_vi ILIKE ' || quote_literal('%' || p_search || '%')
                     || ' OR p.name_en ILIKE ' || quote_literal('%' || p_search || '%')
                     || ' OR p.code ILIKE ' || quote_literal('%' || p_search || '%') || ')';
  END IF;

  v_sql := v_sql || ' ORDER BY ' || format('%I %s', v_sort_col, v_dir)
                   || ' LIMIT ' || p_per_page::text || ' OFFSET ' || v_offset::text;

  RETURN QUERY EXECUTE v_sql;
END;
$$;

-- --------------------
-- Webshop JSON helper: returns JSON { items: [...], total: n, page, per_page }
-- --------------------
CREATE OR REPLACE FUNCTION webshop_get_products_json(
  p_page INT DEFAULT 1,
  p_per_page INT DEFAULT 20,
  p_search TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'created_at',
  p_dir TEXT DEFAULT 'desc'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  items JSONB;
  total BIGINT;
  v_record RECORD;
BEGIN
  items := '[]'::jsonb;
  FOR v_record IN SELECT * FROM webshop_get_products(p_page, p_per_page, p_search, p_sort, p_dir)
  LOOP
    items := items || jsonb_build_array(jsonb_build_object(
      'id', v_record.id,
      'code', v_record.code,
      'sku', v_record.sku,
      'name_vi', v_record.name_vi,
      'name_en', v_record.name_en,
      'web_price', v_record.web_price,
      'stock_quantity', v_record.stock_quantity,
      'primary_image', v_record.primary_image,
      'is_web_visible', v_record.is_web_visible
    ));
    total := v_record.total_count; -- repeated per row; last assignment is total
  END LOOP;

  IF total IS NULL THEN
    -- no rows returned, compute total via function (efficient enough)
    SELECT COUNT(*) INTO total FROM products WHERE is_web_visible = TRUE AND (p_search IS NULL OR p_search = '' OR (name_vi ILIKE ('%'||p_search||'%') OR name_en ILIKE ('%'||p_search||'%') OR code ILIKE ('%'||p_search||'%')));
  END IF;

  RETURN jsonb_build_object(
    'items', COALESCE(items, '[]'::jsonb),
    'total', total::bigint,
    'page', p_page,
    'per_page', p_per_page
  );
END;
$$;

-- Small convenience view for quick webshop product counts (cacheable by app)
CREATE OR REPLACE VIEW vw_webshop_product_counts AS
SELECT COUNT(*) FILTER (WHERE is_web_visible) AS visible_count, COUNT(*) AS total_products FROM products;

-- --------------------
-- Final notes
-- --------------------
-- - This schema.sql is optimized for fast load: no heavy seed inserts and minimal FK constraints.
-- - insertdata.sql remains the bulk seed file (run in staging/test only).
-- - pg_trgm extension and trigram indexes are added for fast ILIKE search; enabling extension
--   requires appropriate DB privileges. If your environment doesn't allow creating extensions,
--   remove the CREATE EXTENSION pg_trgm line and create trigram indexes manually when permitted.
-- - The webshop_get_products functions return items + total_count; webshop_get_products_json returns
--   a compact JSONB object suitable for API responses.
-- - Compatible with PostgreSQL 13+. If you run a different version, tell me and I'll adjust.

-- End of schema.sql (branch sql/standardize-all)
