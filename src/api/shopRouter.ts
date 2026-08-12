import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
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
  saveOrUpdateWebCustomer,
  resetWebCustomerPassword,
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
import viLocales from '../../public/locales/vi.json';
import enLocales from '../../public/locales/en.json';

export const shopRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'jwt-secret-webshop-2026';

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

async function serializeCart(cart: CartData) {
  const items = await Promise.all(cart.items.map(async (item) => {
    const product = await fetchProductByIdOrSlug(String(item.product_id));
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

// Middleware for JWT customer auth
function authWebCustomer(req: Request, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Yêu cầu đăng nhập tài khoản WebShop.' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ.' });
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
shopRouter.get('/admin/products', async (req: ShopTenantRequest, res: Response) => {
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

shopRouter.post('/admin/products', async (req: Request, res: Response) => {
  try {
    const newProd = await createProduct(req.body || {});
    return res.json({ ok: true, data: newProd, message: 'Thêm mới sản phẩm thành công!' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.put('/admin/products/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const updated = await updateProduct(id, req.body || {});
    return res.json({ ok: true, data: updated, message: 'Cập nhật sản phẩm thành công!' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.delete('/admin/products/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await deleteProduct(id);
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
        settings: (req as any).tenantSettings || {},
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

// ================= 2. SHOPPING CART ENDPOINTS =================

shopRouter.get('/cart', async (req: ShopTenantRequest, res: Response) => {
  const sessionKey = (req.query.session_key as string) || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;
  let cart = await fetchCart(tenantKey, req.companyId);
  if (!cart) {
    cart = { id: 0, session_key: tenantKey, items: [], status: 'active' };
  }
  return res.json({ ok: true, data: await serializeCart(cart) });
});

shopRouter.post('/cart/items', async (req: ShopTenantRequest, res: Response) => {
  const { session_key, product_id, quantity } = req.body || {};
  const sessionKey = session_key || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;
  const qty = Number(quantity || 1);

  let cart = await fetchCart(tenantKey, req.companyId);
  if (!cart) {
    cart = { id: 0, session_key: tenantKey, items: [], status: 'active' };
  }

  const p = await fetchProductByIdOrSlug(String(product_id), req.companyId);
  const unitPrice = p ? p.salePrice : 100000;

  const existing = cart.items.find((item) => item.product_id === Number(product_id));
  if (existing) {
    existing.quantity += qty;
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
  return res.json({ ok: true, data: await serializeCart(savedCart), message: 'Đã thêm sản phẩm vào giỏ hàng.' });
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
  return res.json({ ok: true, data: await serializeCart(savedCart) });
});

shopRouter.delete('/cart/items/:id', async (req: ShopTenantRequest, res: Response) => {
  const itemId = Number(req.params.id);
  const sessionKey = (req.query.session_key as string) || 'guest_session';
  const tenantKey = `${req.tenantSlug || 'default'}_${sessionKey}`;

  const cart = await fetchCart(tenantKey, req.companyId);
  if (cart) {
    await deleteCartItem(cart.id, itemId);
    const refreshed = await fetchCart(tenantKey, req.companyId);
    return res.json({ ok: true, data: refreshed ? await serializeCart(refreshed) : null, message: 'Đã xóa sản phẩm khỏi giỏ hàng.' });
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
  const promo = await fetchPromotionByCode(code || '');
  if (!promo) {
    return res.status(400).json({ ok: false, message: 'Mã giảm giá không tồn tại hoặc đã hết hạn.' });
  }
  return res.json({ ok: true, data: promo, message: `Áp dụng thành công mã ${promo.code}` });
});

// ================= 3. CUSTOMER AUTHENTICATION (SEPARATED FROM ERP USER) =================

shopRouter.post('/auth/login', async (req: ShopTenantRequest, res: Response) => {
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
    const token = jwt.sign({ sub: String(cust.id), role: 'web_customer' }, JWT_SECRET, { expiresIn: '7d' });
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
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/auth/google', async (req: ShopTenantRequest, res: Response) => {
  const { google_profile } = req.body || {};
  if (!google_profile?.email) {
    return res.status(400).json({ ok: false, message: 'Thiếu thông tin email từ Google.' });
  }

  try {
    const email = String(google_profile.email).trim().toLowerCase();
    const fullName = google_profile.name || google_profile.given_name || email.split('@')[0];
    const phone = google_profile.phone || '0901234567';

    let customerResult = await query(
      `SELECT id, username, email, password_hash, full_name, phone FROM web_customers WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    );

    let customer;
    if (customerResult.rows.length > 0) {
      customer = customerResult.rows[0];
    } else {
      const passwordHash = '$2a$10$wT0C2c2E1v6cE8Xg8A3A8uQ4P0O6N9M8L7K6J5H4G3F2E1D0C';
      customer = await query(
        `INSERT INTO web_customers (company_id, username, email, password_hash, full_name, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         RETURNING id, full_name, email, phone`,
        [req.companyId || 1, email, email, passwordHash, fullName, phone]
      ).then(r => r.rows[0]);
    }

    const token = jwt.sign({ sub: String(customer.id), role: 'web_customer' }, JWT_SECRET, { expiresIn: '7d' });

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
          phone: customer.phone || '0901234567',
          customer_id: 100 + Number(customer.id),
        },
      },
    });
  } catch (err: any) {
    console.error('[Google Auth Error]', err);
    return res.status(500).json({ ok: false, message: 'Lỗi xử lý đăng nhập Google: ' + err.message });
  }
});

shopRouter.get('/auth/me', authWebCustomer, async (req: ShopTenantRequest, res: Response) => {
  const user = (req as any).user;
  const customers = await fetchAllWebCustomers(req.companyId);
  const found = customers.find((c) => String(c.id) === String(user.sub));
  if (!found) {
    return res.json({
      ok: true,
      data: {
        id: user.sub,
        name: 'Khách Hàng Online',
        email: 'customer@gmail.com',
        phone: '0901234567',
        customer_id: 101,
      },
    });
  }
  return res.json({ ok: true, data: found });
});

// ================= 4. ORDERS & CHECKOUT ENDPOINTS =================

shopRouter.get('/orders', authWebCustomer, async (req: ShopTenantRequest, res: Response) => {
  try {
    const webCustId = Number((req as any).user.sub);
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

shopRouter.get('/orders/track/:token', async (req: Request, res: Response) => {
  try {
    const order = await fetchOrderByCodeOrToken(req.params.token);
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
shopRouter.post('/orders/:code/erp-status', async (req: ShopTenantRequest, res: Response) => {
  try {
    const order = await fetchOrderByCodeOrToken(req.params.code, req.companyId);
    if (!order) return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    const status = String(req.body?.erpStatus || '').toLowerCase();
    const dbStatus = status.includes('hủy') ? 'HUY' : status.includes('giao') ? 'DANG_GIAO' : 'DA_XAC_NHAN';
    await updateOrderStatus(order.id, dbStatus);
    return res.json({ ok: true, message: 'Đã đồng bộ trạng thái ERP/PXK.' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ================= 5. ADMIN WEBSHOP MANAGEMENT =================

shopRouter.get('/admin/customers', async (req: ShopTenantRequest, res: Response) => {
  try {
    const items = await fetchAllWebCustomers(req.companyId);
    return res.json({ ok: true, data: { items } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.post('/admin/customers', async (req: ShopTenantRequest, res: Response) => {
  try {
    const cust = await saveOrUpdateWebCustomer(req.body || {}, req.companyId);
    return res.json({ ok: true, data: cust, message: 'Đã lưu tài khoản khách hàng WebShop.' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.put('/admin/customers/:id/password', async (req: ShopTenantRequest, res: Response) => {
  try {
    const targetId = Number(req.params.id);
    const { password, email } = req.body || {};
    const updated = await resetWebCustomerPassword(targetId, email, password);
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy tài khoản khách hàng.' });
    }
    return res.json({ ok: true, message: `Đã cấp lại mật khẩu WebShop cho ${updated.name}: ${password}`, data: updated });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.get('/admin/orders', async (req: ShopTenantRequest, res: Response) => {
  try {
    const orders = await fetchOrders(undefined, req.companyId);
    return res.json({ ok: true, data: { items: orders } });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

shopRouter.put('/admin/orders/:id/status', async (req: ShopTenantRequest, res: Response) => {
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
    const updated = await updateOrderStatus(orderId, dbStatus);
    if (!updated) {
      return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng.' });
    }
    return res.json({ ok: true, data: updated, message: 'Cập nhật trạng thái đơn hàng thành công.' });
  } catch (err: any) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});
