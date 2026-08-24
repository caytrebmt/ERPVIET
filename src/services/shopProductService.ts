import { query } from '../db/index.js';
import {
  ProductItem,
  CategoryItem,
  PromotionItem,
  BannerItem,
  removeVietnameseTones,
} from './shopDataStore.js';

function requireCompanyId(companyId?: number): number {
  if (!Number.isInteger(companyId) || companyId! <= 0) {
    throw new Error('Không xác định được tenant WebShop.');
  }
  return companyId;
}

function mapProduct(row: any): ProductItem {
  const images = Array.isArray(row.images) ? row.images.filter(Boolean) : [];
  const name = row.name_vi || row.name_en || '';
  return {
    id: Number(row.id),
    listing_id: Number(row.id),
    sku: row.sku || '',
    name,
    name_vi: row.name_vi || '',
    name_en: row.name_en || '',
    description: row.description_vi || row.description_en || '',
    description_vi: row.description_vi || '',
    description_en: row.description_en || '',
    imageUrl: images[0] || '',
    images,
    salePrice: Number(row.sale_price) || 0,
    erpPrice: Number(row.erp_price) || 0,
    costPrice: Number(row.cost_price) || 0,
    brand: row.brand_name || '',
    contactForPrice: false,
    isFlashSale: false,
    flashSalePrice: null,
    stock: Number(row.stock) || 0,
    minStock: Number(row.min_stock) || 0,
    serialNumbers: [],
    categoryId: Number(row.category_id) || 0,
    category_vi: row.category_vi || '',
    category_en: row.category_en || '',
    unit: row.unit_vi || row.unit_en || '',
    unit_vi: row.unit_vi || '',
    unit_en: row.unit_en || '',
    slug: row.slug || '',
  };
}

function productSelectSql(whereSql: string, includeVisibility = true): string {
  const visibility = includeVisibility ? ' AND p.is_web_visible = TRUE' : '';
  return `
    SELECT p.id, p.sku, p.name_vi, p.name_en, p.description_vi, p.description_en,
           COALESCE(p.web_price, p.selling_price) AS sale_price,
           p.selling_price AS erp_price, p.cost_price,
           p.stock_quantity AS stock, p.min_stock, p.category_id,
           p.code AS slug, b.name_vi AS brand_name,
           c.name_vi AS category_vi, c.name_en AS category_en,
           u.name_vi AS unit_vi, u.name_en AS unit_en,
           COALESCE(images.images, ARRAY[]::text[]) AS images
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id AND c.company_id = p.company_id
      LEFT JOIN brands b ON b.id = p.brand_id AND b.company_id = p.company_id
      LEFT JOIN uom u ON u.id = p.uom_id
      LEFT JOIN LATERAL (
        SELECT array_agg(pi.image_url ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC) AS images
          FROM product_images pi
         WHERE pi.product_id = p.id AND pi.company_id = p.company_id
      ) images ON TRUE
     WHERE ${whereSql}${visibility}`;
}

export async function fetchCategories(companyId?: number): Promise<CategoryItem[]> {
  const tenantId = requireCompanyId(companyId);
  const result = await query(
    `SELECT id, code, name_vi, name_en
       FROM categories
      WHERE company_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC, id ASC`,
    [tenantId],
  );
  return (result.rows || []).map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name_vi || row.name_en || row.code,
    name_vi: row.name_vi,
    name_en: row.name_en,
  }));
}

export async function fetchProducts(queryParams: {
  category?: string | number;
  search?: string;
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
  includeInactive?: boolean;
  companyId?: number;
}): Promise<{ items: ProductItem[]; total: number; page: number; totalPages: number }> {
  const tenantId = requireCompanyId(queryParams.companyId);
  const page = Math.max(1, Number(queryParams.page || 1));
  const limit = Math.max(1, Math.min(1000, Number(queryParams.limit || 20)));
  const offset = (page - 1) * limit;
  const whereClauses: string[] = ['p.company_id = $1'];
  const params: any[] = [tenantId];
  let paramIdx = 2;

  if (!queryParams.includeInactive) whereClauses.push('p.is_active = TRUE AND p.is_web_visible = TRUE');
  if (queryParams.category && queryParams.category !== 'all') {
    const categoryId = Number(queryParams.category);
    if (Number.isInteger(categoryId)) {
      whereClauses.push(`p.category_id = $${paramIdx++}`);
      params.push(categoryId);
    }
  }
  if (queryParams.search?.trim()) {
    whereClauses.push(`(p.name_vi ILIKE $${paramIdx} OR p.name_en ILIKE $${paramIdx} OR p.code ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx})`);
    params.push(`%${queryParams.search.trim()}%`);
    paramIdx += 1;
  }
  if (queryParams.minPrice !== undefined && Number.isFinite(Number(queryParams.minPrice))) {
    whereClauses.push(`COALESCE(p.web_price, p.selling_price) >= $${paramIdx++}`);
    params.push(Number(queryParams.minPrice));
  }
  if (queryParams.maxPrice !== undefined && Number.isFinite(Number(queryParams.maxPrice))) {
    whereClauses.push(`COALESCE(p.web_price, p.selling_price) <= $${paramIdx++}`);
    params.push(Number(queryParams.maxPrice));
  }
  const whereSql = whereClauses.join(' AND ');
  let orderBy = 'p.id ASC';
  if (queryParams.sort === 'price-asc') orderBy = 'COALESCE(p.web_price, p.selling_price) ASC, p.id ASC';
  if (queryParams.sort === 'price-desc') orderBy = 'COALESCE(p.web_price, p.selling_price) DESC, p.id ASC';
  if (queryParams.sort === 'newest') orderBy = 'p.id DESC';

  const countResult = await query(`SELECT COUNT(*)::int AS total FROM products p WHERE ${whereSql}`, params);
  const total = Number(countResult.rows[0]?.total || 0);
  const dataResult = await query(
    `${productSelectSql(whereSql, false)} ORDER BY ${orderBy} LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, limit, offset],
  );
  return {
    items: (dataResult.rows || []).map(mapProduct),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function fetchProductByIdOrSlug(idOrSlug: string, companyId?: number): Promise<ProductItem | null> {
  const tenantId = requireCompanyId(companyId);
  const value = String(idOrSlug || '').trim();
  const numeric = Number(value);
  const identity = Number.isInteger(numeric) && numeric > 0 ? 'p.id = $2' : '(p.code = $2 OR p.sku = $2)';
  const result = await query(
    `${productSelectSql(`p.company_id = $1 AND ${identity}`)} LIMIT 1`,
    [tenantId, Number.isInteger(numeric) && numeric > 0 ? numeric : value],
  );
  return result.rows[0] ? mapProduct(result.rows[0]) : null;
}

export async function fetchBanners(companyId?: number): Promise<BannerItem[]> {
  const tenantId = requireCompanyId(companyId);
  const result = await query(
    `SELECT id, title, image_url, link_url, sort_order
       FROM web_banners
      WHERE company_id = $1 AND is_active = TRUE
      ORDER BY sort_order ASC, id ASC`,
    [tenantId],
  );
  return (result.rows || []).map((row) => ({
    id: Number(row.id),
    title: row.title,
    image_url: row.image_url,
    link_url: row.link_url,
    sort_order: Number(row.sort_order),
  }));
}

export async function fetchPromotions(companyId?: number): Promise<PromotionItem[]> {
  const tenantId = requireCompanyId(companyId);
  const result = await query(
    `SELECT id, code, title_vi AS name, title_vi AS description, discount_type,
            discount_value, min_order_value AS min_order_amount
       FROM web_promotions
      WHERE company_id = $1 AND is_active = TRUE
        AND CURRENT_DATE BETWEEN start_date AND end_date
      ORDER BY id DESC`,
    [tenantId],
  );
  return (result.rows || []).map((row) => ({
    id: Number(row.id),
    code: row.code,
    name: row.name,
    description: row.description,
    discount_type: row.discount_type,
    discount_value: Number(row.discount_value),
    min_order_amount: Number(row.min_order_amount) || 0,
  }));
}

type ProductPayload = Partial<ProductItem> & {
  categoryId?: number;
  category_id?: number;
  name?: string;
  name_vi?: string;
  name_en?: string;
  salePrice?: number;
  costPrice?: number;
  minStock?: number;
};

function productFromPayload(id: number, payload: ProductPayload, current?: ProductItem): ProductItem {
  const name = String(payload.name_vi || payload.name || current?.name || '').trim();
  const sku = String(payload.sku || current?.sku || `SKU-${id}`).trim();
  const slug = String(payload.slug || current?.slug || `${removeVietnameseTones(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id}`).trim();
  return {
    id,
    listing_id: id,
    sku,
    name,
    name_vi: String(payload.name_vi || payload.name || current?.name_vi || name),
    name_en: String(payload.name_en || current?.name_en || name),
    description: String(payload.description || current?.description || ''),
    description_vi: String(payload.description_vi || payload.description || current?.description_vi || ''),
    description_en: String(payload.description_en || payload.description || current?.description_en || ''),
    imageUrl: payload.imageUrl || current?.imageUrl || '',
    images: payload.images || current?.images || [],
    salePrice: Number(payload.salePrice ?? current?.salePrice ?? 0),
    erpPrice: Number(payload.erpPrice ?? current?.erpPrice ?? payload.salePrice ?? current?.salePrice ?? 0),
    costPrice: Number(payload.costPrice ?? current?.costPrice ?? 0),
    brand: payload.brand ?? current?.brand ?? '',
    contactForPrice: payload.contactForPrice ?? current?.contactForPrice ?? false,
    isFlashSale: payload.isFlashSale ?? current?.isFlashSale ?? false,
    flashSalePrice: payload.flashSalePrice ?? current?.flashSalePrice ?? null,
    stock: Number(payload.stock ?? current?.stock ?? 0),
    minStock: Number(payload.minStock ?? current?.minStock ?? 0),
    serialNumbers: payload.serialNumbers || current?.serialNumbers || [],
    categoryId: Number(payload.categoryId ?? payload.category_id ?? current?.categoryId ?? 0),
    category_vi: current?.category_vi,
    category_en: current?.category_en,
    unit: payload.unit || current?.unit || '',
    unit_vi: payload.unit_vi || current?.unit_vi || payload.unit || current?.unit || '',
    unit_en: payload.unit_en || current?.unit_en || '',
    slug,
  };
}

async function replaceProductImages(productId: number, companyId: number, images: string[]): Promise<void> {
  const uniqueImages = [...new Set(images.filter((image) => typeof image === 'string' && image.trim()))];
  await query('DELETE FROM product_images WHERE product_id = $1 AND company_id = $2', [productId, companyId]);
  for (const [index, imageUrl] of uniqueImages.entries()) {
    await query(
      `INSERT INTO product_images (product_id, company_id, image_url, is_primary, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, companyId, imageUrl.trim(), index === 0, index],
    );
  }
}

export async function createProduct(payload: ProductPayload, companyId?: number): Promise<ProductItem> {
  const tenantId = requireCompanyId(companyId);
  const draft = productFromPayload(Date.now(), payload);
  if (!draft.name_vi || !draft.sku) throw new Error('Tên và mã SKU sản phẩm là bắt buộc.');
  const result = await query(
    `INSERT INTO products (
       company_id, code, sku, name_vi, name_en, category_id, cost_price,
       selling_price, web_price, stock_quantity, min_stock, description_vi, description_en
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id`,
    [tenantId, draft.slug, draft.sku, draft.name_vi, draft.name_en, draft.categoryId || null, draft.costPrice, draft.erpPrice, draft.salePrice, draft.stock, draft.minStock, draft.description_vi, draft.description_en],
  );
  const productId = Number(result.rows[0].id);
  if (Array.isArray(payload.images)) await replaceProductImages(productId, tenantId, payload.images);
  const product = await fetchProductByIdOrSlug(String(productId), tenantId);
  if (!product) throw new Error('Không thể đọc lại sản phẩm vừa tạo.');
  return product;
}

export async function updateProduct(id: number, payload: ProductPayload, companyId?: number): Promise<ProductItem | null> {
  const tenantId = requireCompanyId(companyId);
  const current = await fetchProductByIdOrSlug(String(id), tenantId);
  if (!current) return null;
  const product = productFromPayload(id, payload, current);
  await query(
    `UPDATE products
        SET code = $1, sku = $2, name_vi = $3, name_en = $4, category_id = $5,
            cost_price = $6, selling_price = $7, web_price = $8, stock_quantity = $9,
            min_stock = $10, description_vi = $11, description_en = $12,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = $13 AND company_id = $14`,
    [product.slug, product.sku, product.name_vi, product.name_en, product.categoryId || null, product.costPrice, product.erpPrice, product.salePrice, product.stock, product.minStock, product.description_vi, product.description_en, id, tenantId],
  );
  if (Array.isArray(payload.images)) await replaceProductImages(id, tenantId, payload.images);
  return fetchProductByIdOrSlug(String(id), tenantId);
}

export async function deleteProduct(id: number, companyId?: number): Promise<boolean> {
  const tenantId = requireCompanyId(companyId);
  const result = await query('DELETE FROM products WHERE id = $1 AND company_id = $2', [id, tenantId]);
  return (result.rowCount || 0) > 0;
}
