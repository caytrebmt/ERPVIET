import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import {
  CartData,
} from '../services/shopDataStore.js';
import {
  fetchCategories,
  fetchProducts,
  fetchProductByIdOrSlug,
  fetchBanners,
  fetchPromotions,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../services/shopProductService.js';
import {
  loginWebCustomer,
  fetchAllWebCustomers,
  fetchWebCustomerById,
  saveOrUpdateWebCustomer,
  resetWebCustomerPassword,
  DuplicateWebCustomerEmailError,
} from '../services/shopCustomerService.js';
import {
  fetchOrders,
  fetchOrderByCodeOrToken,
  createNewOrder,
  updateOrderStatus,
  fetchCart,
  createOrUpdateCart,
  deleteCartItem,
  fetchPromotionByCode,
} from '../services/shopOrderService.js';
import { shopTenantMiddleware, ShopTenantRequest } from '../middleware/shopTenant.js';
import { query } from '../db/index.js';
import { JWT_SECRET } from '../config.js';
import { isUniqueViolation, normalizeEmail } from '../utils/identifiers.js';
import viLocales from '../../public/locales/vi.json';
import enLocales from '../../public/locales/en.json';

export const shopRouter = Router();

const BCRYPT_ROUNDS = 10;

shopRouter.use(shopTenantMiddleware);

shopRouter.get('/locales/:lang', async (req: Request, res: Response) => {
  const { lang } = req.params;
  if (!['vi', 'en'].includes(lang)) {
    return res.status(400).json({ ok: false, error: 'Invalid language code' });
  }

  try {
    let content: string = '';
    let found = false;

    try {
      const fs = await import('fs');
      const path = await import('path');
      const possiblePaths = [
        path.join(process.cwd(), 'public', 'locales', `${lang}.json`),
        path.join(process.cwd(), 'dist', 'locales', `${lang}.json`),
      ];

      for (const localePath of possiblePaths) {
        try {
          if (fs.existsSync(localePath)) {
            content = fs.readFileSync(localePath, 'utf8');
            found = true;
            break;
          }
        } catch { }
      }
    } catch { }

    if (!found) {
      const fallback = lang === 'vi' ? (viLocales as any).default || viLocales : (enLocales as any).default || enLocales;
      content = JSON.stringify(fallback);
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

async function serializeCart(cart: CartData, companyId?: number) {
  const items = await Promise.all(cart.items.map(async (item) => {
    const product = await fetchProductByIdOrSlug(String(item.product_id), companyId);
    const unitPrice = Number(item.unit_price || product?.salePrice || 0);
    return {
      ...item,
      unit_price: unitPrice,
      amount: unitPrice * Number(item.quantity || 0),
      name: product?.name || `Sản phẩm #${item.product_id}`,
      sku: product?.sku || `SKU-${item.product_id}`,
      slug: product?.slug || String(item.product_id),
    };
  }));
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  return {
    ...cart,
    cart_id: String(cart.id),
    items,
    item_count: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    subtotal,
    total: subtotal,
  };
}

// Middleware for JWT customer auth. The customer id and tenant id are both
// checked against PostgreSQL; a token from another WebShop cannot be reused.
async function authWebCustomer(req: ShopTenantRequest, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Yêu cầu đăng nhập tài khoản WebShop.' });
  }
  try {
    const decoded: any = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
    const customerId = Number(decoded.sub);
    const tokenCompanyId = Number(decoded.companyId);
    if (!Number.isInteger(customerId) || customerId <= 0 || tokenCompanyId !== req.companyId) {
      return res.status(401).json({ ok: false, message: 'Phiên đăng nhập không thuộc WebShop này.' });
    }
    const customer = await query(
      `SELECT id FROM web_customers WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1`,
      [customerId, req.companyId],
    );
    if (!customer.rows[0]) {
      return res.status(401).json({ ok: false, message: 'Tài khoản WebShop không còn hoạt động.' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
  }
}

// ERP actions under /api/shop/admin/* are still tenant-scoped. Public
// customers never get access just because a route happens to be mounted on
// the same router.
async function requireShopAdmin(req: ShopTenantRequest, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Yêu cầu đăng nhập tài khoản quản trị WebShop.' });
  }
  try {
    const decoded: any = jwt.verify(authHeader.slice(7).trim(), JWT_SECRET);
    const userId = Number(decoded.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(403).json({ ok: false, message: 'Token không phải tài khoản quản trị ERP.' });
    }
    const result = await query(
      `SELECT u.id, u.company_id, u.status, u.is_super_admin, r.code AS role_code
         FROM sys_users u
         LEFT JOIN sys_roles r ON r.id = u.role_id
        WHERE u.id = $1
        LIMIT 1`,
      [userId],
    );
    const user = result.rows[0];
    if (!user || user.status !== 'active') {
      return res.status(403).json({ ok: false, message: 'Tài khoản quản trị không còn hoạt động.' });
    }
    if (!user.is_super_admin && Number(user.company_id) !== Number(req.companyId)) {
      return res.status(403).json({ ok: false, message: 'Không có quyền trên WebShop của tenant này.' });
    }
    req.erpUser = {
      id: Number(user.id),
      companyId: user.company_id == null ? undefined : Number(user.company_id),
      isSuperAdmin: user.is_super_admin === true,
      roleCode: user.role_code || undefined,
    };
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Token quản trị không hợp lệ hoặc đã hết hạn.' });
  }
}

// ================= 1. PRODUCT & CATEGORY ENDPOINTS =================

shopRouter.get('/categories', async (req: ShopTenantRequest, res: Response) => {
  try {
    const data = await fetchCategories(req.companyId);
    return res.json({ ok: true, data: { categories: data }, categories: data });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// Admin product endpoints (ERP Master Management)
shopRouter.get('/admin/products', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const result = await fetchProducts({ limit: 1000, includeInactive: true, companyId: req.companyId });
    const items = result.items.map((p) => ({
      ...p,
      sku: p.sku,
      name: p.name_vi || p.name,
      name_vi: p.name_vi || p.name,
      name_en: p.name_en || p.name,
      categoryName: p.category_vi || 'Hàng hóa',
      category_vi: p.category_vi || 'Hàng hóa',
      category_en: p.category_en || 'Products',
      unit: p.unit_vi || p.unit || 'Cái',
      unit_vi: p.unit_vi || p.unit || 'Cái',
      unit_en: p.unit_en || 'Pcs',
      salePrice: p.salePrice || 0,
      costPrice: p.costPrice || 0,
      stock: p.stock || 0,
      minStock: p.minStock || 5,
      brand: p.brand || 'Khác',
      description: p.description_vi || p.description || '',
      description_vi: p.description_vi || p.description || '',
      description_en: p.description_en || p.description || '',
      imageUrl: p.imageUrl,
      images: p.images || (p.imageUrl ? [p.imageUrl] : []),
    }));
    return res.json({ ok: true, data: { items, products: items } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/admin/products', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const newProd = await createProduct(req.body || {}, req.companyId);
    return res.json({ ok: true, data: newProd, message: 'Thêm mới sản phẩm thành công!' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.put('/admin/products/:id', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updated = await updateProduct(id, req.body || {}, req.companyId);
    return res.json({ ok: true, data: updated, message: 'Cập nhật sản phẩm thành công!' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.delete('/admin/products/:id', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const deleted = await deleteProduct(id, req.companyId);
    if (!deleted) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm trong tenant.' });
    return res.json({ ok: true, message: 'Xóa sản phẩm thành công!' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// Catalog endpoint for WebShop
shopRouter.get('/catalog', async (req: ShopTenantRequest, res: Response) => {
  try {
    const { category_id, category, search, page, limit } = req.query;
    const cat = (category_id || category) as string;
    const result = await fetchProducts({
      category: cat,
      search: search as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      companyId: req.companyId,
    });
    const categories = await fetchCategories(req.companyId);
    return res.json({
      ok: true,
      data: {
        products: result.items,
        items: result.items,
        categories: categories,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/products', async (req: ShopTenantRequest, res: Response) => {
  try {
    const { category, search, page, limit, minPrice, maxPrice, sort } = req.query;
    const result = await fetchProducts({
      category: category as string,
      search: search as string,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 100,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      sort: sort as string,
      companyId: req.companyId,
    });
    return res.json({ ok: true, data: { items: result.items, products: result.items, total: result.total } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/products/flash-sale', async (req: ShopTenantRequest, res: Response) => {
  try {
    const result = await fetchProducts({ limit: 10, companyId: req.companyId });
    const flashSaleItems = result.items.map((p, idx) => ({
      ...p,
      isFlashSale: true,
      flashSalePrice: Math.round(p.salePrice * 0.85),
    }));
    return res.json({ ok: true, data: { items: flashSaleItems } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/products/slug/:slug', async (req: ShopTenantRequest, res: Response) => {
  try {
    const product = await fetchProductByIdOrSlug(req.params.slug, req.companyId);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
    }
    return res.json({ ok: true, data: product });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/products/:id', async (req: ShopTenantRequest, res: Response) => {
  try {
    const product = await fetchProductByIdOrSlug(req.params.id, req.companyId);
    if (!product) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm.' });
    }
    return res.json({ ok: true, data: product });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/banners', async (req: ShopTenantRequest, res: Response) => {
  try {
    const banners = await fetchBanners(req.companyId);
    return res.json({ ok: true, data: banners });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/tenant/info', async (req: ShopTenantRequest, res: Response) => {
  try {
    return res.json({
      ok: true,
      data: {
        slug: req.tenantSlug,
        name: req.tenantName,
        companyId: req.companyId,
        settings: req.tenantSettings || {},
        workspace: req.tenantWorkspace || null,
        webshop: req.tenantWorkspace
          ? {
              slug: req.tenantWorkspace.webshopSlug,
              name: req.tenantWorkspace.webshopName,
              url: `/shop/${req.tenantWorkspace.webshopSlug}`,
            }
          : null,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/promotions', async (req: ShopTenantRequest, res: Response) => {
  try {
    const promotions = await fetchPromotions(req.companyId);
    return res.json({ ok: true, data: promotions });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/promotions/validate', async (req: ShopTenantRequest, res: Response) => {
  const code = String(req.body?.code || '').trim();
  const amount = Math.max(0, Number(req.body?.amount) || 0);
  const promo = await fetchPromotionByCode(code, req.companyId);
  if (!promo) return res.status(400).json({ ok: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn.' });
  if (amount < promo.min_order_amount) {
    return res.status(400).json({ ok: false, message: `Đơn hàng tối thiểu ${promo.min_order_amount.toLocaleString('vi-VN')} đ.` });
  }
  const discount = promo.discount_type === 'PERCENT'
    ? Math.min(amount, Math.round(amount * promo.discount_value / 100))
    : Math.min(amount, promo.discount_value);
  return res.json({ ok: true, data: { ...promo, discount_amount: discount, description: promo.description } });
});

// ================= 2. SHOPPING CART ENDPOINTS =================

shopRouter.get('/cart', async (req: ShopTenantRequest, res: Response) => {
  const sessionKey = (req.query.session_key as string) || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;
  let cart = await fetchCart(tenantKey, req.companyId);
  if (!cart) {
    cart = { id: 0, session_key: tenantKey, items: [], status: 'active' };
  }
  return res.json({ ok: true, data: await serializeCart(cart, req.companyId) });
});

shopRouter.post('/cart/items', async (req: ShopTenantRequest, res: Response) => {
  const { session_key, product_id, quantity } = req.body || {};
  const sessionKey = session_key || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;
  const qty = Number(quantity || 1);
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ ok: false, message: 'Số lượng sản phẩm không hợp lệ.' });
  }

  let cart = await fetchCart(tenantKey, req.companyId);
  if (!cart) {
    cart = { id: 0, session_key: tenantKey, items: [], status: 'active' };
  }

  const p = await fetchProductByIdOrSlug(String(product_id), req.companyId);
  if (!p) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm trong WebShop này.' });
  const unitPrice = p.salePrice;

  const existing = cart.items.find((item) => item.product_id === Number(product_id));
  const nextQuantity = (existing?.quantity || 0) + qty;
  if (nextQuantity > p.stock) {
    return res.status(400).json({ ok: false, message: `Sản phẩm ${p.sku} chỉ còn ${p.stock} trong kho.` });
  }
  if (existing) {
    existing.quantity = nextQuantity;
  } else {
    cart.items.push({
      id: cart.items.length + 1,
      listing_id: Number(product_id),
      product_id: Number(product_id),
      quantity: qty,
      unit_price: unitPrice,
    });
  }

  const savedCart = await createOrUpdateCart(cart, req.companyId);
  return res.json({ ok: true, data: await serializeCart(savedCart, req.companyId), message: 'Đã thêm sản phẩm vào giỏ hàng.' });
});

shopRouter.put('/cart/items/:id', async (req: ShopTenantRequest, res: Response) => {
  const itemId = Number(req.params.id);
  const { session_key, quantity } = req.body || {};
  const sessionKey = session_key || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;

  const cart = await fetchCart(tenantKey, req.companyId);
  if (!cart) return res.status(404).json({ ok: false, message: 'Không tìm thấy giỏ hàng.' });

  const item = cart.items.find((it) => it.id === itemId || it.product_id === itemId);
  if (item) {
    item.quantity = Math.max(1, Number(quantity));
  }

  const savedCart = await createOrUpdateCart(cart, req.companyId);
  return res.json({ ok: true, data: await serializeCart(savedCart, req.companyId) });
});

shopRouter.delete('/cart/items/:id', async (req: ShopTenantRequest, res: Response) => {
  const itemId = Number(req.params.id);
  const sessionKey = (req.query.session_key as string) || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;

  const cart = await fetchCart(tenantKey, req.companyId);
  if (cart) {
    await deleteCartItem(cart.id, itemId, req.companyId);
    const refreshed = await fetchCart(tenantKey, req.companyId);
    return res.json({ ok: true, data: refreshed ? await serializeCart(refreshed, req.companyId) : null, message: 'Đã xóa sản phẩm khỏi giỏ hàng.' });
  }

  return res.json({ ok: true, data: null, message: 'Đã xóa sản phẩm khỏi giỏ hàng.' });
});

shopRouter.delete('/cart', async (req: ShopTenantRequest, res: Response) => {
  const sessionKey = (req.query.session_key as string) || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;

  const cart = await fetchCart(tenantKey, req.companyId);
  if (cart) {
    await createOrUpdateCart({ ...cart, items: [] }, req.companyId);
  }

  return res.json({ ok: true, data: { id: cart?.id || 0, session_key: tenantKey, items: [], status: 'active' }, message: 'Đã xóa giỏ hàng.' });
});

shopRouter.post('/cart/apply-promo', async (req: ShopTenantRequest, res: Response) => {
  const { code } = req.body || {};
  const promo = await fetchPromotionByCode(code || '', req.companyId);
  if (!promo) {
    return res.status(400).json({ ok: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn.' });
  }
  return res.json({ ok: true, data: promo, message: `Áp dụng thành công mã ${promo.code}` });
});

// ================= 3. CUSTOMER AUTHENTICATION (SEPARATED FROM ERP USER) =================

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { ok: false, message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

shopRouter.post('/auth/login', loginLimiter, async (req: ShopTenantRequest, res: Response) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập email và mật khẩu.' });
  }

  try {
    const result = await loginWebCustomer(email, password, req.companyId);
    return res.json({
      ok: true,
      data: {
        access_token: result.token,
        refresh_token: result.token,
        customer: result.customer,
      },
      message: 'Đăng nhập thành công tài khoản WebShop.',
    });
  } catch (err: any) {
    return res.status(401).json({ ok: false, message: err.message || 'Email hoặc mật khẩu không đúng.' });
  }
});

shopRouter.post('/auth/register', async (req: ShopTenantRequest, res: Response) => {
  const { name, email, phone, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'Vui lòng điền thông tin bắt buộc.' });
  }

  try {
    const cust = await saveOrUpdateWebCustomer({ name, email, phone, password }, req.companyId);
    if (!cust) return res.status(500).json({ ok: false, message: 'Không thể tạo tài khoản WebShop.' });
    const token = jwt.sign({ sub: String(cust.id), role: 'web_customer', companyId: req.companyId }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      ok: true,
      data: {
        access_token: token,
        refresh_token: token,
        customer: {
          id: cust.id,
          name: cust.name,
          email: cust.email,
          phone: cust.phone,
          customer_id: cust.customer_id,
        },
      },
      message: 'Đăng ký tài khoản WebShop thành công.',
    });
  } catch (err: any) {
    if (err instanceof DuplicateWebCustomerEmailError || err?.code === 'DUPLICATE_EMAIL' || isUniqueViolation(err)) {
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field: 'email', message: 'Email WebShop đã được sử dụng trong doanh nghiệp này.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/auth/google', async (req: ShopTenantRequest, res: Response) => {
  const { google_profile } = req.body || {};
  if (!google_profile?.email || !req.companyId) {
    return res.status(400).json({ ok: false, message: 'Thiếu email Google hoặc tenant WebShop.' });
  }

  try {
    const email = normalizeEmail(google_profile.email);
    const fullName = String(google_profile.name || google_profile.given_name || email.split('@')[0]).trim();
    const phone = String(google_profile.phone || '').trim();

    let customerResult = await query(
      `SELECT id, username, email, full_name, phone
         FROM web_customers
        WHERE company_id = $2 AND LOWER(BTRIM(email)) = $1 AND is_active = TRUE
        LIMIT 1`,
      [email, req.companyId],
    );

    let customer = customerResult.rows[0];
    if (!customer) {
      const randomHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
      customer = (await query(
        `INSERT INTO web_customers (company_id, username, email, password_hash, full_name, phone, is_active)
         VALUES ($1, $2, $2, $3, $4, $5, TRUE)
         RETURNING id, username, email, full_name, phone`,
        [req.companyId, email, randomHash, fullName, phone || null],
      )).rows[0];
    }

    const token = jwt.sign(
      { sub: String(customer.id), role: 'web_customer', companyId: req.companyId },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    return res.json({
      ok: true,
      message: customerResult.rows.length > 0 ? 'Đăng nhập Google thành công!' : 'Đăng ký từ Google thành công!',
      data: {
        access_token: token,
        refresh_token: token,
        customer: {
          id: customer.id,
          name: customer.full_name || fullName,
          email: customer.email,
          phone: customer.phone || '',
          customer_id: 100 + Number(customer.id),
        },
      },
    });
  } catch (err: any) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field: 'email', message: 'Email WebShop đã được sử dụng trong doanh nghiệp này.' });
    }
    console.error('[Google Auth Error]', err);
    return res.status(500).json({ ok: false, message: 'Lỗi xử lý đăng nhập Google.' });
  }
});

shopRouter.get('/auth/me', authWebCustomer, async (req: ShopTenantRequest, res: Response) => {
  const user = (req as any).user;
  const found = await fetchWebCustomerById(Number(user.sub), req.companyId);
  if (!found) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản WebShop.' });
  return res.json({ ok: true, data: found });
});

// ================= 4. ORDERS & CHECKOUT ENDPOINTS =================

shopRouter.get('/orders', async (req: ShopTenantRequest, res: Response, next) => {
  if (String(req.query.admin || '').toLowerCase() === 'true') {
    return requireShopAdmin(req, res, next);
  }
  return authWebCustomer(req, res, next);
}, async (req: ShopTenantRequest, res: Response) => {
  try {
    const isAdmin = Boolean(req.erpUser);
    const webCustId = isAdmin ? undefined : Number((req as any).user.sub);
    const orders = await fetchOrders(webCustId, req.companyId);
    return res.json({ ok: true, data: { items: orders } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

async function getOwnedOrder(req: ShopTenantRequest, res: Response) {
  try {
    const order = await fetchOrderByCodeOrToken(req.params.code, req.companyId);
    const customerId = Number((req as any).user.sub);
    if (!order || Number(order.webCustomerId) !== customerId) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    }
    return res.json({ ok: true, data: order });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
}

shopRouter.get('/orders/code/:code', authWebCustomer, getOwnedOrder);
// Compatibility route used by the existing order-detail page.
shopRouter.get('/orders/:code', authWebCustomer, getOwnedOrder);

shopRouter.get('/orders/track/:token', async (req: ShopTenantRequest, res: Response) => {
  try {
    const order = await fetchOrderByCodeOrToken(req.params.token, req.companyId);
    if (!order) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy mã tra cứu đơn hàng.' });
    }
    return res.json({ ok: true, data: order });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/orders', async (req: ShopTenantRequest, res: Response) => {
  try {
    const newOrder = await createNewOrder(req.body || {}, req.companyId);
    return res.json({
      ok: true,
      data: newOrder,
      message: 'Đặt hàng thành công! Mã tra cứu đơn hàng: ' + newOrder.code,
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// Called by the SaaS warehouse approval flow after a PXK is created.
shopRouter.post('/orders/:code/erp-status', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const order = await fetchOrderByCodeOrToken(req.params.code, req.companyId);
    if (!order) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    const status = String(req.body?.erpStatus || '').toLowerCase();
    const dbStatus = status.includes('hủy') ? 'HUY' : status.includes('giao') ? 'DANG_GIAO' : 'DA_XAC_NHAN';
    await updateOrderStatus(order.id, dbStatus, req.companyId);
    return res.json({ ok: true, message: 'Đã đồng bộ trạng thái ERP/PXK.' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ================= 5. ADMIN WEBSHOP MANAGEMENT =================

shopRouter.get('/admin/customers', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const items = await fetchAllWebCustomers(req.companyId);
    return res.json({ ok: true, data: { items } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/admin/customers', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const cust = await saveOrUpdateWebCustomer(req.body || {}, req.companyId);
    if (!cust) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản khách hàng trong tenant.' });
    return res.json({ ok: true, data: cust, message: 'Đã lưu tài khoản khách hàng WebShop.' });
  } catch (err: any) {
    if (err instanceof DuplicateWebCustomerEmailError || err?.code === 'DUPLICATE_EMAIL' || isUniqueViolation(err)) {
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field: 'email', message: 'Email WebShop đã được sử dụng trong doanh nghiệp này.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.delete('/admin/customers/:id', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const result = await query(
      `UPDATE web_customers SET is_active = FALSE WHERE id = $1 AND company_id = $2 RETURNING id`,
      [Number(req.params.id), req.companyId],
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản khách hàng trong tenant.' });
    return res.json({ ok: true, message: 'Đã vô hiệu hóa tài khoản khách hàng.' });
  } catch (err: any) { return res.status(500).json({ ok: false, message: err.message }); }
});

shopRouter.put('/admin/customers/:id/password', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const { password, email } = req.body || {};
    const updated = await resetWebCustomerPassword(targetId, email, password, req.companyId);
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản khách hàng.' });
    }
    return res.json({ ok: true, message: `Đã cấp lại mật khẩu WebShop cho ${updated.name}.`, data: updated });
  } catch (err: any) {
    return res.status(400).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/admin/orders', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const orders = await fetchOrders(undefined, req.companyId);
    return res.json({ ok: true, data: { items: orders } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.put('/admin/orders/:id/status', requireShopAdmin, async (req: ShopTenantRequest, res: Response) => {
  try {
    const orderId = Number(req.params.id);
    const { status } = req.body || {};
    const statusMap: Record<string, string> = {
      processing: 'DA_XAC_NHAN',
      completed: 'DA_GIAO',
      cancelled: 'HUY',
      new: 'CHO_XAC_NHAN',
    };
    const dbStatus = statusMap[status] || status;
    const updated = await updateOrderStatus(orderId, dbStatus, req.companyId);
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    }
    return res.json({ ok: true, data: updated, message: 'Cập nhật trạng thái đơn hàng thành công.' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});
