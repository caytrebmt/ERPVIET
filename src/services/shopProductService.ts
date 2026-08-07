import { query, isDbConnected } from '../db/index.js';
import {
  ProductItem,
  CategoryItem,
  PromotionItem,
  BannerItem,
  removeVietnameseTones,
} from './shopDataStore.js';

export async function fetchCategories(companyId?: number): Promise<CategoryItem[]> {
  try {
    const whereCompany = companyId ? 'WHERE company_id = $1' : '';
    const params = companyId ? [companyId] : [];
    const res = await query(
      `SELECT id, code, COALESCE(name_vi, code) as name, name_vi, name_en FROM categories ${whereCompany} ORDER BY id ASC`,
      params
    );
    if (res.rows && res.rows.length > 0) {
      return res.rows.map((row) => ({
        id: Number(row.id),
        code: row.code,
        name: row.name_vi || row.name || row.code,
        name_vi: row.name_vi,
        name_en: row.name_en,
      }));
    }
  } catch (err) {
    console.warn('[DB Category Query Error]', err);
  }
  return [];
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
  const page = Math.max(1, Number(queryParams.page || 1));
  const limit = Math.max(1, Math.min(1000, Number(queryParams.limit || 20)));
  const offset = (page - 1) * limit;

  try {
    const whereClauses: string[] = [];
    let params: any[] = [];
    let paramIdx = 1;

    if (!queryParams.includeInactive) {
      whereClauses.push('p.is_active = TRUE');
    }

    if (queryParams.companyId) {
      whereClauses.push(`p.company_id = $${paramIdx++}`);
      params.push(Number(queryParams.companyId));
    }

    if (queryParams.category && queryParams.category !== 'all') {
      whereClauses.push(`p.category_id = $${paramIdx++}`);
      params.push(Number(queryParams.category));
    }

    if (queryParams.search && queryParams.search.trim()) {
      const searchTerm = `%${queryParams.search.trim()}%`;
      whereClauses.push(`(p.name_vi ILIKE $${paramIdx} OR p.name_en ILIKE $${paramIdx} OR p.code ILIKE $${paramIdx} OR p.sku ILIKE $${paramIdx})`);
      params.push(searchTerm);
      paramIdx++;
    }

    if (queryParams.minPrice !== undefined && !isNaN(Number(queryParams.minPrice))) {
      whereClauses.push(`COALESCE(p.web_price, p.selling_price) >= $${paramIdx++}`);
      params.push(Number(queryParams.minPrice));
    }

    if (queryParams.maxPrice !== undefined && !isNaN(Number(queryParams.maxPrice))) {
      whereClauses.push(`COALESCE(p.web_price, p.selling_price) <= $${paramIdx++}`);
      params.push(Number(queryParams.maxPrice));
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderBy = 'ORDER BY p.id ASC';
    if (queryParams.sort === 'price-asc') orderBy = 'ORDER BY COALESCE(p.web_price, p.selling_price) ASC';
    if (queryParams.sort === 'price-desc') orderBy = 'ORDER BY COALESCE(p.web_price, p.selling_price) DESC';
    if (queryParams.sort === 'newest') orderBy = 'ORDER BY p.id DESC';

    const countRes = await query(`SELECT COUNT(*) FROM products p ${whereSql}`, params);
    const total = Number(countRes.rows[0]?.count || 0);

    const dataSql = `
      SELECT 
        p.id, p.sku, p.name_vi, p.name_en, 
        COALESCE(p.web_price, p.selling_price) as sale_price,
        p.selling_price as erp_price, p.cost_price,
        p.stock_quantity as stock, p.min_stock, p.category_id,
        p.code as slug,
        b.name_vi as brand_name,
        c.name_vi as category_vi, c.name_en as category_en,
        u.name_vi as unit_vi, u.name_en as unit_en,
        COALESCE(images.images, ARRAY[]::text[]) as images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN uom u ON p.uom_id = u.id
      LEFT JOIN LATERAL (
        SELECT array_agg(pi.image_url ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC) AS images
        FROM product_images pi
        WHERE pi.product_id = p.id
      ) images ON TRUE
      ${whereSql}
      ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;

    const dataRes = await query(dataSql, [...params, limit, offset]);

    if (dataRes.rows) {
      const items: ProductItem[] = dataRes.rows.map((row) => ({
        id: Number(row.id),
        listing_id: Number(row.id),
        sku: row.sku || `SKU-${row.id}`,
        name: row.name_vi || row.name_en || 'Sản Phẩm',
        name_vi: row.name_vi,
        name_en: row.name_en,
        description: `${row.name_vi || 'Sản phẩm vật tư'} chính hãng cao cấp.`,
        description_vi: `${row.name_vi || 'Sản phẩm vật tư'} chính hãng cao cấp.`,
        imageUrl: row.images?.[0] || 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800',
        images: row.images || [],
        salePrice: Number(row.sale_price || 0),
        erpPrice: Number(row.erp_price || 0),
        costPrice: Number(row.cost_price || 0),
        brand: row.brand_name || 'ERPACC',
        contactForPrice: false,
        isFlashSale: false,
        flashSalePrice: null,
        stock: Number(row.stock || 50),
        minStock: Number(row.min_stock || 10),
        serialNumbers: [],
        categoryId: Number(row.category_id || 1),
        category_vi: row.category_vi,
        category_en: row.category_en,
        unit: row.unit_vi || 'Cái',
        unit_vi: row.unit_vi || 'Cái',
        unit_en: row.unit_en || 'Pcs',
        slug: row.slug || `san-pham-${row.id}`,
      }));

      return {
        items,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }
  } catch (err) {
    console.warn('[DB Product Query Error]', err);
  }

  return { items: [], total: 0, page, totalPages: 1 };
}

export async function fetchProductByIdOrSlug(idOrSlug: string, companyId?: number): Promise<ProductItem | null> {
  try {
    const isNum = !isNaN(Number(idOrSlug));
    const whereCond = isNum ? `p.id = $1` : `p.code = $1 OR p.sku = $1`;

    const sql = `
      SELECT 
        p.id, p.sku, p.name_vi, p.name_en, 
        COALESCE(p.web_price, p.selling_price) as sale_price,
        p.selling_price as erp_price, p.cost_price,
        p.stock_quantity as stock, p.min_stock, p.category_id,
        p.code as slug,
        b.name_vi as brand_name,
        c.name_vi as category_vi, c.name_en as category_en,
        u.name_vi as unit_vi, u.name_en as unit_en,
        COALESCE(images.images, ARRAY[]::text[]) as images
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN uom u ON p.uom_id = u.id
      LEFT JOIN LATERAL (
        SELECT array_agg(pi.image_url ORDER BY pi.is_primary DESC, pi.sort_order ASC, pi.id ASC) AS images
        FROM product_images pi
        WHERE pi.product_id = p.id
      ) images ON TRUE
      WHERE ${whereCond} ${companyId ? `AND p.company_id = $${isNum ? 2 : 1}` : ''}
      LIMIT 1
    `;

    const res = await query(sql, companyId ? [isNum ? Number(idOrSlug) : idOrSlug, companyId] : [isNum ? Number(idOrSlug) : idOrSlug]);
    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        id: Number(row.id),
        listing_id: Number(row.id),
        sku: row.sku || `SKU-${row.id}`,
        name: row.name_vi || row.name_en || 'Sản Phẩm',
        name_vi: row.name_vi,
        name_en: row.name_en,
        description: `${row.name_vi || 'Sản phẩm vật tư'} chính hãng cao cấp tiêu chuẩn ISO.`,
        imageUrl: row.images?.[0] || 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=800',
        images: row.images || [],
        salePrice: Number(row.sale_price || 0),
        erpPrice: Number(row.erp_price || 0),
        costPrice: Number(row.cost_price || 0),
        brand: row.brand_name || 'ERPACC',
        contactForPrice: false,
        isFlashSale: false,
        flashSalePrice: null,
        stock: Number(row.stock || 50),
        minStock: Number(row.min_stock || 10),
        serialNumbers: [],
        categoryId: Number(row.category_id || 1),
        category_vi: row.category_vi,
        category_en: row.category_en,
        unit: row.unit_vi || 'Cái',
        unit_vi: row.unit_vi || 'Cái',
        unit_en: row.unit_en || 'Pcs',
        slug: row.slug || `san-pham-${row.id}`,
      };
    }
  } catch (err) {
    console.warn('[DB Product Detail Error]', err);
  }

  return null;
}

export async function fetchBanners(companyId?: number): Promise<BannerItem[]> {
  try {
    const whereCompany = companyId ? 'WHERE company_id = $1 AND is_active = TRUE' : 'WHERE is_active = TRUE';
    const params = companyId ? [companyId] : [];
    const res = await query(`SELECT id, title, image_url, link_url, sort_order FROM web_banners ${whereCompany} ORDER BY sort_order ASC`, params);
    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r) => ({
        id: Number(r.id),
        title: r.title,
        image_url: r.image_url,
        link_url: r.link_url,
        sort_order: Number(r.sort_order),
      }));
    }
  } catch (err) {
    console.warn('[DB Banners Query Error]', err);
  }

  return [];
}

export async function fetchPromotions(companyId?: number): Promise<PromotionItem[]> {
  try {
    const whereCompany = companyId ? 'WHERE company_id = $1 AND ' : 'WHERE ';
    const params = companyId ? [companyId] : [];
    const res = await query(`SELECT id, code, title_vi as name, title_vi as description, discount_type, discount_value, min_order_value as min_order_amount FROM web_promotions ${whereCompany}is_active = TRUE`, params);
    if (res.rows && res.rows.length > 0) {
      return res.rows.map((r) => ({
        id: Number(r.id),
        code: r.code,
        name: r.name,
        description: r.description,
        discount_type: r.discount_type,
        discount_value: Number(r.discount_value),
        min_order_amount: Number(r.min_order_amount),
      }));
    }
  } catch (err) {
    console.warn('[DB Promotions Query Error]', err);
  }

  return [];
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
  const name = payload.name_vi || payload.name || current?.name || 'Sản phẩm mới';
  const sku = payload.sku || current?.sku || `SKU-${id}`;
  const slug = payload.slug || current?.slug || `${removeVietnameseTones(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${id}`;

  return {
    id,
    listing_id: id,
    sku,
    name,
    name_vi: payload.name_vi || payload.name || current?.name_vi || name,
    name_en: payload.name_en || current?.name_en || name,
    description: payload.description || current?.description || '',
    description_vi: payload.description_vi || payload.description || current?.description_vi || '',
    description_en: payload.description_en || payload.description || current?.description_en || '',
    imageUrl: payload.imageUrl || current?.imageUrl || '',
    images: payload.images || current?.images || [],
    salePrice: Number(payload.salePrice ?? current?.salePrice ?? 0),
    erpPrice: Number(payload.erpPrice ?? current?.erpPrice ?? payload.salePrice ?? current?.salePrice ?? 0),
    costPrice: Number(payload.costPrice ?? current?.costPrice ?? 0),
    brand: payload.brand ?? current?.brand,
    contactForPrice: payload.contactForPrice ?? current?.contactForPrice ?? false,
    isFlashSale: payload.isFlashSale ?? current?.isFlashSale ?? false,
    flashSalePrice: payload.flashSalePrice ?? current?.flashSalePrice ?? null,
    stock: Number(payload.stock ?? current?.stock ?? 0),
    minStock: Number(payload.minStock ?? current?.minStock ?? 5),
    serialNumbers: payload.serialNumbers || current?.serialNumbers || [],
    categoryId: Number(payload.categoryId ?? payload.category_id ?? current?.categoryId ?? 1),
    unit: payload.unit || current?.unit || 'Cái',
    unit_vi: payload.unit_vi || current?.unit_vi || payload.unit || current?.unit || 'Cái',
    unit_en: payload.unit_en || current?.unit_en || 'Pcs',
    slug,
  };
}

async function replaceProductImages(productId: number, images: string[]): Promise<void> {
  const uniqueImages = [...new Set(images.filter((image) => typeof image === 'string' && image.trim()))];
  await query('DELETE FROM product_images WHERE product_id = $1', [productId]);
  for (const [index, imageUrl] of uniqueImages.entries()) {
    await query(
      'INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES ($1, $2, $3, $4)',
      [productId, imageUrl, index === 0, index]
    );
  }
}

export async function createProduct(payload: ProductPayload): Promise<ProductItem> {
  const draft = productFromPayload(Date.now(), payload);
  const res = await query(
    `INSERT INTO products (code, sku, name_vi, name_en, category_id, cost_price, selling_price, web_price, stock_quantity, min_stock, description_vi, description_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [draft.slug, draft.sku, draft.name_vi, draft.name_en, draft.categoryId, draft.costPrice, draft.erpPrice, draft.salePrice, draft.stock, draft.minStock, draft.description_vi, draft.description_en]
  );
  const productId = Number(res.rows[0].id);
  if (Array.isArray(payload.images)) await replaceProductImages(productId, payload.images);
  const product = await fetchProductByIdOrSlug(String(productId));
  if (product) return product;
  throw new Error('Failed to create product');
}

export async function updateProduct(id: number, payload: ProductPayload): Promise<ProductItem | null> {
  const current = await fetchProductByIdOrSlug(String(id));
  if (!current) return null;
  const product = productFromPayload(id, payload, current);

  await query(
    `UPDATE products SET code = $1, sku = $2, name_vi = $3, name_en = $4, category_id = $5, cost_price = $6, selling_price = $7, web_price = $8, stock_quantity = $9, min_stock = $10, description_vi = $11, description_en = $12, updated_at = CURRENT_TIMESTAMP WHERE id = $13`,
    [product.slug, product.sku, product.name_vi, product.name_en, product.categoryId, product.costPrice, product.erpPrice, product.salePrice, product.stock, product.minStock, product.description_vi, product.description_en, id]
  );
  if (Array.isArray(payload.images)) await replaceProductImages(id, payload.images);
  return fetchProductByIdOrSlug(String(id));
}

export async function deleteProduct(id: number): Promise<boolean> {
  const res = await query('DELETE FROM products WHERE id = $1', [id]);
  return (res.rowCount || 0) > 0;
}
