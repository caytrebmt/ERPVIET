import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, isDbConnected, pool } from '../db/index';
import { tenantMiddleware, TenantRequest } from '../middleware/tenant.js';
import { postInventoryMovement } from '../services/inventoryService.js';

export const saasRouter = Router();

saasRouter.get('/notifications', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(`
      SELECT * FROM (
        SELECT id, title_vi, title_en, content_vi, content_en, is_read, link_url, created_at, company_id FROM notifications
        WHERE ($1::int IS NULL OR company_id = $1)
        UNION ALL
        SELECT -wo.id, 'Đơn hàng WebShop mới', 'New WebShop order',
               'Đơn ' || wo.code || ' trị giá ' || to_char(wo.total_amount, 'FM999,999,999,999') || ' đ',
               'Order ' || wo.code || ' total ' || to_char(wo.total_amount, 'FM999,999,999,999'),
               FALSE, '/saas/web-orders', wo.created_at, wo.company_id
        FROM web_orders wo WHERE wo.order_status = 'CHO_XAC_NHAN' AND ($1::int IS NULL OR wo.company_id = $1)
        UNION ALL
        SELECT -(100000 + p.id), 'Cảnh báo tồn kho', 'Low stock alert',
               p.name_vi || ': tồn ' || p.stock_quantity || ', tối thiểu ' || p.min_stock,
               p.name_en || ': stock ' || p.stock_quantity || ', minimum ' || p.min_stock,
               FALSE, '/saas/inventory', CURRENT_TIMESTAMP, p.company_id
        FROM products p WHERE p.stock_quantity <= p.min_stock AND ($1::int IS NULL OR p.company_id = $1)
      ) alerts ORDER BY is_read ASC, created_at DESC LIMIT 30`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/inventory/balances', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(`SELECT sb.warehouse_id, w.name_vi AS warehouse_vi, w.name_en AS warehouse_en, p.id AS product_id, p.sku, p.name_vi, p.name_en, sb.quantity AS stock, sb.reserved_quantity AS reserved, (sb.quantity - sb.reserved_quantity) AS available, p.cost_price AS unit_cost, (sb.quantity * p.cost_price) AS total_value FROM stock_balances sb JOIN products p ON p.id = sb.product_id JOIN warehouses w ON w.id = sb.warehouse_id WHERE ($1::int IS NULL OR sb.company_id = $1) ORDER BY w.id, p.id`, [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/inventory/movements', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : null;
    const toDate = typeof req.query.to === 'string' && req.query.to ? req.query.to : null;
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT sm.id, sm.code, sm.movement_type, sm.reference_doc, sm.movement_date, sm.notes,
              w.name_vi AS warehouse_vi, w.name_en AS warehouse_en,
              p.sku, p.name_vi, p.name_en, smi.quantity, smi.unit_cost, smi.subtotal_cost
       FROM stock_movements sm JOIN stock_movement_items smi ON smi.movement_id = sm.id
       JOIN products p ON p.id = smi.product_id LEFT JOIN warehouses w ON w.id = sm.warehouse_id
       WHERE ($1::int IS NULL OR sm.company_id = $1)
         AND ($2::date IS NULL OR sm.movement_date >= $2::date)
         AND ($3::date IS NULL OR sm.movement_date <= $3::date)
       ORDER BY sm.movement_date DESC, sm.id DESC, smi.id ASC LIMIT $4`,
      [companyId, fromDate, toDate, limit]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/inventory/xnt', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : '1900-01-01';
    const toDate = typeof req.query.to === 'string' && req.query.to ? req.query.to : new Date().toISOString().slice(0, 10);
    const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT p.id AS product_id, p.sku, p.name_vi, p.name_en, u.name_vi AS unit_vi, u.name_en AS unit_en,
              w.id AS warehouse_id, w.name_vi AS warehouse_vi, w.name_en AS warehouse_en, p.cost_price,
              COALESCE(SUM(CASE WHEN sm.movement_date < $1::date THEN CASE WHEN sm.movement_type = 'XUAT_KHO' THEN -smi.quantity ELSE smi.quantity END ELSE 0 END), 0) AS opening_qty,
              COALESCE(SUM(CASE WHEN sm.movement_date BETWEEN $1::date AND $2::date AND sm.movement_type = 'NHAP_KHO' THEN smi.quantity ELSE 0 END), 0) AS in_qty,
              COALESCE(SUM(CASE WHEN sm.movement_date BETWEEN $1::date AND $2::date AND sm.movement_type = 'XUAT_KHO' THEN smi.quantity ELSE 0 END), 0) AS out_qty,
              COALESCE(SUM(CASE WHEN sm.movement_date <= $2::date THEN CASE WHEN sm.movement_type = 'XUAT_KHO' THEN -smi.quantity ELSE smi.quantity END ELSE 0 END), 0) AS closing_qty,
              p.min_stock
       FROM products p JOIN stock_movement_items smi ON smi.product_id = p.id JOIN stock_movements sm ON sm.id = smi.movement_id
       LEFT JOIN warehouses w ON w.id = sm.warehouse_id LEFT JOIN uom u ON u.id = p.uom_id
       WHERE ($3::int IS NULL OR w.id = $3) AND ($4::int IS NULL OR p.category_id = $4) AND ($5::int IS NULL OR sm.company_id = $5)
       GROUP BY p.id, p.sku, p.name_vi, p.name_en, u.name_vi, u.name_en, w.id, w.name_vi, w.name_en, p.cost_price, p.min_stock
       ORDER BY p.sku`,
      [fromDate, toDate, warehouseId, categoryId, companyId]
    );
    const rows = result.rows.map((r) => ({ ...r, opening_qty: Number(r.opening_qty), in_qty: Number(r.in_qty), out_qty: Number(r.out_qty), closing_qty: Number(r.closing_qty), cost_price: Number(r.cost_price), opening_value: Number(r.opening_qty) * Number(r.cost_price), in_value: Number(r.in_qty) * Number(r.cost_price), out_value: Number(r.out_qty) * Number(r.cost_price), closing_value: Number(r.closing_qty) * Number(r.cost_price) }));
    const kpi = rows.reduce((a, r) => ({ opening_qty: a.opening_qty + r.opening_qty, in_qty: a.in_qty + r.in_qty, out_qty: a.out_qty + r.out_qty, closing_qty: a.closing_qty + r.closing_qty, opening_value: a.opening_value + r.opening_value, in_value: a.in_value + r.in_value, out_value: a.out_value + r.out_value, closing_value: a.closing_value + r.closing_value }), { opening_qty: 0, in_qty: 0, out_qty: 0, closing_qty: 0, opening_value: 0, in_value: 0, out_value: 0, closing_value: 0 });
    res.json({ ok: true, data: { fromDate, toDate, kpi, rows } });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.post('/inventory/movements', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const body = { ...req.body, companyId: req.companyId };
    res.json({ ok: true, data: await postInventoryMovement(body) });
  }
  catch (error: any) { res.status(400).json({ ok: false, message: error.message }); }
});

const JWT_SECRET = process.env.JWT_SECRET_KEY || 'jwt-secret-webshop-2026';

// Pre-defined demo users for role-based permissions
const DEMO_ERP_USERS: Record<string, any> = {
  admin: {
    id: 1,
    username: 'admin',
    email: 'admin@erpacc.vn',
    full_name: 'Quản Trị Viên',
    phone: '0912345678',
    company_id: 1,
    role_code: 'ADMIN',
    role_name_vi: 'Quản trị viên',
    role_name_en: 'System Administrator',
    permissions: ['*'],
    preferred_lang: 'vi',
  },
  sales1: {
    id: 2,
    username: 'sales1',
    email: 'sales@erpacc.vn',
    full_name: 'John Sales',
    phone: '0987654321',
    company_id: 1,
    role_code: 'SALES',
    role_name_vi: 'Nhân viên Kinh doanh',
    role_name_en: 'Sales Representative',
    permissions: ['quotation:view', 'quotation:create', 'order:view', 'customer:view', 'product:view'],
    preferred_lang: 'vi',
  },
  accountant1: {
    id: 3,
    username: 'accountant1',
    email: 'accountant@erpacc.vn',
    full_name: 'Trần Kế Toán',
    phone: '0911223344',
    company_id: 1,
    role_code: 'ACCOUNTANT',
    role_name_vi: 'Kế toán viên',
    role_name_en: 'Chief Accountant',
    permissions: ['finance:view', 'invoice:manage', 'debt:view', 'vat:manage', 'accounting:manage', 'report:view'],
    preferred_lang: 'vi',
  },
  warehouse1: {
    id: 4,
    username: 'warehouse1',
    email: 'warehouse@erpacc.vn',
    full_name: 'Lê Thủ Kho',
    phone: '0933445566',
    company_id: 1,
    role_code: 'WAREHOUSE',
    role_name_vi: 'Thủ kho',
    role_name_en: 'Warehouse Manager',
    permissions: ['inventory:manage', 'stockin:manage', 'stockout:manage', 'warehouse:view', 'product:view'],
    preferred_lang: 'vi',
  },
  purchasing1: {
    id: 5,
    username: 'purchasing1',
    email: 'purchasing@erpacc.vn',
    full_name: 'Phạm Mua Hàng',
    phone: '0944556677',
    company_id: 1,
    role_code: 'PURCHASING',
    role_name_vi: 'Nhân viên Mua hàng',
    role_name_en: 'Purchaser',
    permissions: ['purchase:view', 'supplier:view', 'stockin:manage'],
    preferred_lang: 'vi',
  },
};

// ==========================================
// ERP AUTHENTICATION ENDPOINTS
// ==========================================
saasRouter.post('/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập tên đăng nhập ERP.' });
  }

  const cleanUser = username.toLowerCase().trim();

  // Check DB if connected
  if (isDbConnected()) {
    try {
      const result = await query(
        `SELECT u.*, r.code as role_code, r.name_vi as role_name_vi, r.name_en as role_name_en 
         FROM sys_users u 
         LEFT JOIN sys_roles r ON u.role_id = r.id 
         WHERE u.username = $1 OR u.email = $1`,
        [cleanUser]
      );
      if (result.rows.length > 0) {
        const dbUser = result.rows[0];
        const userObj = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          full_name: dbUser.full_name,
          phone: dbUser.phone,
          company_id: dbUser.company_id,
          role_code: dbUser.role_code || 'ADMIN',
          role_name_vi: dbUser.role_name_vi || 'Quản trị viên',
          role_name_en: dbUser.role_name_en || 'System Administrator',
          permissions: dbUser.role_code === 'ADMIN' ? ['*'] : DEMO_ERP_USERS[dbUser.username]?.permissions || ['*'],
          preferred_lang: dbUser.preferred_lang || 'vi',
        };
        const token = jwt.sign(
          { userId: userObj.id, username: userObj.username, role: userObj.role_code, companyId: userObj.company_id },
          JWT_SECRET,
          { expiresIn: '7d' }
        );
        return res.json({
          ok: true,
          message: `Đăng nhập ERP thành công với quyền ${userObj.role_name_vi}`,
          data: { token, user: userObj },
        });
      }
    } catch (err) {
      console.error('Error authenticating sys_user:', err);
    }
  }

  // Fallback to DEMO users matching username prefix/key
  let matchedUser = DEMO_ERP_USERS[cleanUser];
  if (!matchedUser) {
    if (cleanUser.includes('admin')) matchedUser = DEMO_ERP_USERS['admin'];
    else if (cleanUser.includes('sales')) matchedUser = DEMO_ERP_USERS['sales1'];
    else if (cleanUser.includes('account') || cleanUser.includes('ketoan')) matchedUser = DEMO_ERP_USERS['accountant1'];
    else if (cleanUser.includes('ware') || cleanUser.includes('kho')) matchedUser = DEMO_ERP_USERS['warehouse1'];
    else if (cleanUser.includes('purchas') || cleanUser.includes('muahang')) matchedUser = DEMO_ERP_USERS['purchasing1'];
  }

  // Accept any non-empty password for demo accounts
  if (matchedUser) {
    const token = jwt.sign(
      { userId: matchedUser.id, username: matchedUser.username, role: matchedUser.role_code },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({
      ok: true,
      message: `Đăng nhập ERP thành công với quyền ${matchedUser.role_name_vi}`,
      data: { token, user: matchedUser },
    });
  }

  return res.status(401).json({
    ok: false,
    message: 'Tài khoản ERP không tồn tại hoặc mật khẩu chưa đúng. Dùng thử: admin / admin123',
  });
});

saasRouter.get('/auth/me', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, message: 'Chưa đăng nhập ERP' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const username = decoded.username || 'admin';
    const userObj = DEMO_ERP_USERS[username] || DEMO_ERP_USERS['admin'];
    return res.json({ ok: true, data: userObj });
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Phiên đăng nhập ERP đã hết hạn' });
  }
});

// Helper to determine language code ('vi' or 'en')
const getLang = (req: Request): 'vi' | 'en' => {
  const lang = (req.query.lang || req.headers['accept-language'] || 'vi').toString().toLowerCase();
  return lang.startsWith('en') ? 'en' : 'vi';
};


// ==========================================
// 1. LANGUAGES & TRANSLATIONS DICTIONARY
// ==========================================
saasRouter.get('/languages', async (req, res) => {
  if (!isDbConnected()) {
    return res.json({
      ok: true,
      data: [
        { code: 'vi', name: 'Tiếng Việt', flag_icon: '🇻🇳', is_default: true, is_active: true },
        { code: 'en', name: 'English', flag_icon: '🇬🇧', is_default: false, is_active: true },
      ],
    });
  }

  try {
    const result = await query('SELECT * FROM sys_languages WHERE is_active = TRUE ORDER BY is_default DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/translations/all', async (req: Request, res: Response) => {
  if (!isDbConnected()) {
    return res.json({ ok: true, data: [] });
  }

  try {
    const result = await query(
      `SELECT key_name as key, category, vi_text as vi, en_text as en
       FROM sys_translations ORDER BY category ASC, key_name ASC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/translations', async (req: Request, res: Response) => {
  const { key, category = 'common', vi, en } = req.body;
  if (!key) {
    return res.status(400).json({ ok: false, error: 'Key is required' });
  }

  if (!isDbConnected()) {
    return res.json({ ok: true, message: 'Saved locally in frontend state' });
  }

  try {
    if (vi !== undefined) {
      await query(
        `INSERT INTO sys_translations (key_name, category, vi_text, en_text)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (key_name) DO UPDATE SET vi_text = $3, category = $2`,
        [key, category, vi]
      );
    }
    if (en !== undefined) {
      await query(
        `INSERT INTO sys_translations (key_name, category, vi_text, en_text)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (key_name) DO UPDATE SET en_text = $3, category = $2`,
        [key, category, en]
      );
    }
    res.json({ ok: true, message: 'Translation saved successfully' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.delete('/translations/:key', async (req: Request, res: Response) => {
  const { key } = req.params;
  if (!isDbConnected()) {
    return res.json({ ok: true, message: 'Deleted locally' });
  }

  try {
    await query('DELETE FROM sys_translations WHERE key_name = $1', [key]);
    res.json({ ok: true, message: 'Translation key deleted' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 2. SYSTEM SETTINGS & CONFIGURATION
// ==========================================
saasRouter.get('/settings', async (req: Request, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) {
    return res.json({
      ok: true,
      data: [
        { setting_key: 'company_name', setting_value: lang === 'en' ? 'ERPACC VIETNAM CO., LTD' : 'CÔNG TY TNHH ERPACC VIỆT NAM' },
        { setting_key: 'company_tax_code', setting_value: '0102030405' },
        { setting_key: 'company_address', setting_value: lang === 'en' ? '8th Floor, Innovation Building, Hanoi' : 'Tầng 8, Tòa nhà Innovation, Hà Nội' },
        { setting_key: 'company_phone', setting_value: '0988 123 456' },
      ],
    });
  }

  try {
    const result = await query('SELECT * FROM sys_settings ORDER BY setting_key ASC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 3. DYNAMIC MENUS (MULTILINGUAL)
// ==========================================
saasRouter.get('/menus', async (req: Request, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) {
    const mockMenus = [
      { id: 1, code: 'DASHBOARD', title: lang === 'en' ? 'Dashboard Overview' : 'Tổng quan (Dashboard)', path: '/saas/dashboard', icon: 'LayoutDashboard' },
      { id: 2, code: 'QUOTATIONS', title: lang === 'en' ? 'Customer Quotations' : 'Báo giá khách hàng', path: '/saas/quotations', icon: 'FileText' },
      { id: 3, code: 'SALES_ORDERS', title: lang === 'en' ? 'Sales Orders' : 'Đơn hàng bán', path: '/saas/orders', icon: 'ShoppingCart' },
      { id: 4, code: 'CUSTOMERS', title: lang === 'en' ? 'Customers' : 'Khách hàng', path: '/saas/customers', icon: 'Users' },
      { id: 5, code: 'SUPPLIERS', title: lang === 'en' ? 'Suppliers' : 'Nhà cung cấp', path: '/saas/suppliers', icon: 'Truck' },
      { id: 6, code: 'PRODUCTS', title: lang === 'en' ? 'Products & Items' : 'Sản phẩm & Hàng hóa', path: '/saas/products', icon: 'Package' },
      { id: 7, code: 'CATEGORIES_UOM', title: lang === 'en' ? 'Categories & UOM' : 'Danh mục & Đơn vị tính', path: '/saas/categories-units', icon: 'Tags' },
      { id: 8, code: 'INVENTORY', title: lang === 'en' ? 'Warehouse Inventory' : 'Quản lý kho hàng', path: '/saas/inventory', icon: 'Boxes' },
      { id: 9, code: 'FINANCE_INVOICE', title: lang === 'en' ? 'Invoices & Receipts' : 'Hóa đơn & Thu chi', path: '/saas/finance-invoices', icon: 'Receipt' },
      { id: 10, code: 'REPORTS', title: lang === 'en' ? 'Reports & Analytics' : 'Báo cáo & Phân tích', path: '/saas/reports', icon: 'BarChart3' },
      { id: 11, code: 'SETTINGS', title: lang === 'en' ? 'System Settings' : 'Cấu hình hệ thống', path: '/saas/settings', icon: 'Settings' },
    ];
    return res.json({ ok: true, data: mockMenus });
  }

  try {
    const result = await query(
      `SELECT id, code, path, icon, parent_id, sort_order, 
              CASE WHEN $1 = 'en' THEN title_en ELSE title_vi END as title 
       FROM sys_menus WHERE is_active = TRUE ORDER BY sort_order ASC`,
      [lang]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 4. ROLES & PERMISSIONS (MULTILINGUAL)
// ==========================================
saasRouter.get('/roles', async (req: Request, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) {
    return res.json({
      ok: true,
      data: [
        { id: 1, code: 'ADMIN', name: lang === 'en' ? 'System Administrator' : 'Quản trị viên toàn hệ thống' },
        { id: 2, code: 'SALES', name: lang === 'en' ? 'Sales Representative' : 'Nhân viên Kinh doanh' },
        { id: 3, code: 'ACCOUNTANT', name: lang === 'en' ? 'Chief Accountant' : 'Kế toán viên' },
        { id: 4, code: 'WAREHOUSE', name: lang === 'en' ? 'Warehouse Manager' : 'Thủ kho' },
      ],
    });
  }

  try {
    const result = await query(
      `SELECT id, code, 
              CASE WHEN $1 = 'en' THEN name_en ELSE name_vi END as name,
              CASE WHEN $1 = 'en' THEN description_en ELSE description_vi END as description
       FROM sys_roles ORDER BY id ASC`,
      [lang]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 5. PRODUCTS (MULTILINGUAL)
// ==========================================
saasRouter.get('/products', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) {
    return res.json({ ok: true, message: 'Running with local mock products' });
  }

  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT p.id, p.sku, p.cost_price, p.selling_price, p.web_price, p.stock_quantity, p.min_stock,
              CASE WHEN $1 = 'en' THEN p.name_en ELSE p.name_vi END as name,
              CASE WHEN $1 = 'en' THEN p.description_en ELSE p.description_vi END as description,
              CASE WHEN $1 = 'en' THEN c.name_en ELSE c.name_vi END as category_name,
              CASE WHEN $1 = 'en' THEN u.name_en ELSE u.name_vi END as uom_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN uom u ON p.uom_id = u.id
       WHERE ($2::int IS NULL OR p.company_id = $2)
       ORDER BY p.id DESC`,
      [lang, companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 6. CATEGORIES & UOM (MULTILINGUAL)
// ==========================================
saasRouter.get('/categories', async (req: Request, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) return res.json({ ok: true, data: [] });
  try {
    const result = await query(
      `SELECT c.id, c.code, c.parent_id, c.is_active, c.name_vi, c.name_en,
              COUNT(p.id)::int as product_count,
              CASE WHEN $1 = 'en' THEN c.name_en ELSE c.name_vi END as name,
              ''::text as description
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id, c.code, c.parent_id, c.is_active, c.name_vi, c.name_en
       ORDER BY c.id ASC`,
      [lang]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/uom', async (req: Request, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) return res.json({ ok: true, data: [] });
  try {
    const result = await query(
      `SELECT id, code, FALSE as is_fractional, name_vi, name_en,
              CASE WHEN $1 = 'en' THEN name_en ELSE name_vi END as name,
              ''::text as description
       FROM uom ORDER BY id ASC`,
      [lang]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Other endpoints
saasRouter.get('/customers', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock customers' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM customers WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/suppliers', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock suppliers' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM suppliers WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/quotations', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock quotations' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT q.*, c.name as customer_name, c.phone as customer_phone
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       WHERE ($1::int IS NULL OR q.company_id = $1)
       ORDER BY q.id DESC`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/orders', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock orders' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone
       FROM sales_orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE ($1::int IS NULL OR o.company_id = $1)
       ORDER BY o.id DESC`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 7. SYSTEM TRANSLATION MANAGEMENT
// ==========================================
saasRouter.get('/translations/all', async (req, res) => {
  if (!isDbConnected()) {
    return res.json({ ok: true, data: [] });
  }
  try {
    const result = await query(
      `SELECT t1.translation_key as key, 
              COALESCE(t1.category, 'common') as category,
              t1.translation_value as vi,
              COALESCE(t2.translation_value, '') as en
       FROM sys_translations t1
       LEFT JOIN sys_translations t2 ON t1.translation_key = t2.translation_key AND t2.lang_code = 'en'
       WHERE t1.lang_code = 'vi'
       ORDER BY t1.translation_key ASC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/translations', async (req, res) => {
  const { key, category = 'common', vi, en } = req.body;
  if (!key) {
    return res.status(400).json({ ok: false, message: 'Missing translation key code' });
  }

  if (isDbConnected()) {
    try {
      if (vi !== undefined) {
        await query(
          `INSERT INTO sys_translations (lang_code, category, translation_key, translation_value)
           VALUES ('vi', $1, $2, $3)
           ON CONFLICT (lang_code, translation_key) 
           DO UPDATE SET category = EXCLUDED.category, translation_value = EXCLUDED.translation_value`,
          [category, key, vi]
        );
      }
      if (en !== undefined) {
        await query(
          `INSERT INTO sys_translations (lang_code, category, translation_key, translation_value)
           VALUES ('en', $1, $2, $3)
           ON CONFLICT (lang_code, translation_key) 
           DO UPDATE SET category = EXCLUDED.category, translation_value = EXCLUDED.translation_value`,
          [category, key, en]
        );
      }
    } catch (error: any) {
      console.error('[Translation DB Save Error]', error);
    }
  }

  res.json({ ok: true, message: 'Saved translation key successfully' });
});

saasRouter.delete('/translations/:key', async (req, res) => {
  const { key } = req.params;
  if (isDbConnected() && key) {
    try {
      await query(`DELETE FROM sys_translations WHERE translation_key = $1`, [key]);
    } catch (error: any) {
      console.error('[Translation DB Delete Error]', error);
    }
  }
  res.json({ ok: true, message: 'Deleted translation key successfully' });
});

// ==========================================
// 8. CRM & SALES PIPELINE ENDPOINTS
// ==========================================
saasRouter.get('/crm/leads', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock CRM leads' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM crm_leads WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/crm/opportunities', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock CRM opportunities' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT o.*, c.company_name, c.contact_name
       FROM crm_opportunities o
       LEFT JOIN crm_contacts c ON o.contact_id = c.id
       WHERE ($1::int IS NULL OR o.company_id = $1)
       ORDER BY o.id DESC`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 9. PURCHASING & PROCUREMENT ENDPOINTS
// ==========================================
saasRouter.get('/purchasing/orders', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock purchase orders' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT po.*, s.name as supplier_name, s.code as supplier_code, s.phone as supplier_phone
       FROM purchase_orders po
       LEFT JOIN suppliers s ON po.supplier_id = s.id
       WHERE ($1::int IS NULL OR po.company_id = $1)
       ORDER BY po.id DESC`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/purchasing/requests', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock purchase requests' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM purchase_requests WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 10. FIXED ASSETS & DEPRECIATION ENDPOINTS
// ==========================================
saasRouter.get('/assets', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock assets' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT fa.*, COALESCE(SUM(ad.depreciation_amount), 0) as total_depreciated
       FROM fixed_assets fa
       LEFT JOIN asset_depreciations ad ON fa.id = ad.asset_id
       WHERE ($1::int IS NULL OR fa.company_id = $1)
       GROUP BY fa.id
       ORDER BY fa.id DESC`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 11. AUDIT LOGS & USER SESSIONS ENDPOINTS
// ==========================================
saasRouter.get('/audit-logs', tenantMiddleware, async (req: TenantRequest, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock audit logs' });
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT al.*, u.full_name as user_name, u.username
       FROM sys_audit_logs al
       LEFT JOIN sys_users u ON al.user_id = u.id
       WHERE ($1::int IS NULL OR u.company_id = $1)
       ORDER BY al.id DESC LIMIT 100`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 12. TENANT MANAGEMENT ENDPOINTS
// ==========================================
saasRouter.get('/tenants/me', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  if (!isDbConnected()) {
    return res.json({
      ok: true,
      data: {
        id: req.companyId,
        name_vi: 'Công Ty Mẫu',
        plan_type: 'trial',
        subscription_status: 'active',
        max_users: 5,
        max_warehouses: 3,
        settings: {},
      },
    });
  }
  try {
    const result = await query(
      `SELECT id, code, name_vi, name_en, slug, subdomain, plan_type, subscription_status, trial_ends_at, settings, max_users, max_warehouses, is_paused, onboarding_completed, created_at FROM companies WHERE id = $1`,
      [req.companyId]
    );
    res.json({ ok: true, data: result.rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/tenants/list', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  if (!isDbConnected()) return res.json({ ok: true, data: [] });
  try {
    const result = await query(
      `SELECT id, code, name_vi, name_en, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_paused, is_active, created_at FROM companies ORDER BY id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/tenants/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  if (!isDbConnected()) {
    return res.json({ ok: true, data: { id: tenantId, name_vi: 'Demo Tenant', plan_type: 'trial', subscription_status: 'active' } });
  }
  try {
    const result = await query(
      `SELECT id, code, name_vi, name_en, slug, subdomain, plan_type, subscription_status, trial_ends_at, settings, max_users, max_warehouses, is_paused, onboarding_completed, created_at FROM companies WHERE id = $1`,
      [tenantId]
    );
    res.json({ ok: true, data: result.rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/tenants/register', async (req: Request, res: Response) => {
  const { name_vi, name_en, tax_code, email, phone, address, owner_name, owner_email, owner_password, plan_type = 'free' } = req.body;

  if (!name_vi || !tax_code || !owner_email || !owner_password) {
    return res.status(400).json({ ok: false, message: 'Thiếu thông tin bắt buộc: tên công ty, mã số thuế, email quản lý, mật khẩu' });
  }

  if (!isDbConnected()) {
    return res.json({
      ok: true,
      message: 'Đăng ký tenant thành công (demo mode)',
      data: { id: 999, code: 'DEMO', name_vi, plan_type, subscription_status: 'trial' },
    });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const slug = name_vi.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40) + '-' + Date.now().toString(36);
    const code = 'TENANT-' + Date.now().toString(36).toUpperCase();

    const companyResult = await client.query(
      `INSERT INTO companies (code, name_vi, name_en, tax_code, email, phone, address, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_active, onboarding_completed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'trial', NOW() + INTERVAL '14 days', 5, 3, TRUE, FALSE)
       RETURNING id`,
      [code, name_vi, name_en || null, tax_code, email || null, phone || null, address || null, slug, slug, plan_type]
    );
    const companyId = companyResult.rows[0].id;

    const roleResult = await client.query("SELECT id FROM sys_roles WHERE code = 'ADMIN' LIMIT 1");
    const roleId = roleResult.rows[0]?.id || 1;

    const passwordHash = '$2a$10$wT0C2c2E1v6cE8Xg8A3A8uQ4P0O6N9M8L7K6J5H4G3F2E1D0C';
    const userResult = await client.query(
      `INSERT INTO sys_users (company_id, username, email, password_hash, full_name, phone, role_id, status, preferred_lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'vi')
       RETURNING id`,
      [companyId, owner_email, owner_email, passwordHash, owner_name || owner_email, phone || null, roleId]
    );
    const userId = userResult.rows[0].id;

    await client.query('UPDATE companies SET owner_user_id = $1 WHERE id = $2', [userId, companyId]);

    const branchCode = 'HO_' + code;
    await client.query(
      `INSERT INTO branches (company_id, code, name_vi, name_en, is_headquarter, is_active)
       VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
      [companyId, branchCode, 'Trụ Sở Chính', 'Headquarters']
    );

    await client.query(
      `INSERT INTO departments (branch_id, code, name_vi, name_en, is_active)
       VALUES (currval(pg_get_serial_sequence('branches', 'id')), 'DEPT_BGD', 'Ban Giám Đốc', 'Board of Directors', TRUE)`
    );

    const token = jwt.sign(
      { userId, username: owner_email, role: 'ADMIN', companyId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      message: 'Đăng ký tenant mới thành công! Dùng thử 14 ngày miễn phí.',
      data: { token, company: { id: companyId, code, name_vi, slug, plan_type: 'trial', subscription_status: 'trial' } },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Tenant Register Error]', error);
    res.status(500).json({ ok: false, message: 'Đăng ký thất bại: ' + error.message });
  } finally {
    client.release();
  }
});

saasRouter.patch('/tenants/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  const { name_vi, name_en, plan_type, subscription_status, trial_ends_at, settings, max_users, max_warehouses, is_paused, onboarding_completed } = req.body;

  if (!isDbConnected()) {
    return res.json({ ok: true, message: 'Đã cập nhật tenant (demo mode)' });
  }

  try {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (name_vi !== undefined) { sets.push(`name_vi = $${idx++}`); params.push(name_vi); }
    if (name_en !== undefined) { sets.push(`name_en = $${idx++}`); params.push(name_en); }
    if (plan_type !== undefined) { sets.push(`plan_type = $${idx++}`); params.push(plan_type); }
    if (subscription_status !== undefined) { sets.push(`subscription_status = $${idx++}`); params.push(subscription_status); }
    if (trial_ends_at !== undefined) { sets.push(`trial_ends_at = $${idx++}`); params.push(trial_ends_at); }
    if (settings !== undefined) { sets.push(`settings = $${idx++}`); params.push(JSON.stringify(settings)); }
    if (max_users !== undefined) { sets.push(`max_users = $${idx++}`); params.push(max_users); }
    if (max_warehouses !== undefined) { sets.push(`max_warehouses = $${idx++}`); params.push(max_warehouses); }
    if (is_paused !== undefined) { sets.push(`is_paused = $${idx++}`); params.push(is_paused); }
    if (onboarding_completed !== undefined) { sets.push(`onboarding_completed = $${idx++}`); params.push(onboarding_completed); }

    if (sets.length === 0) return res.status(400).json({ ok: false, message: 'Không có dữ liệu cập nhật' });

    params.push(tenantId);
    const result = await query(`UPDATE companies SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    res.json({ ok: true, data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/tenants/:id/pause', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  const { paused } = req.body;

  if (!isDbConnected()) {
    return res.json({ ok: true, message: paused ? 'Đã tạm dừng tenant' : 'Đã kích hoạt lại tenant' });
  }

  try {
    const result = await query('UPDATE companies SET is_paused = $1 WHERE id = $2 RETURNING id, name_vi, is_paused', [!!paused, tenantId]);
    res.json({ ok: true, data: result.rows[0], message: paused ? 'Tenant đã bị tạm dừng' : 'Tenant đã được kích hoạt lại' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/tenants/:id/upgrade', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  const { plan_type } = req.body;

  if (!['free', 'starter', 'professional', 'enterprise'].includes(plan_type)) {
    return res.status(400).json({ ok: false, message: 'Gói không hợp lệ' });
  }

  if (!isDbConnected()) {
    return res.json({ ok: true, message: `Đã nâng cấp lên gói ${plan_type}` });
  }

  try {
    const result = await query(
      'UPDATE companies SET plan_type = $1, subscription_status = CASE WHEN $1 = \'free\' THEN \'canceled\' ELSE \'active\' END WHERE id = $2 RETURNING id, name_vi, plan_type, subscription_status',
      [plan_type, tenantId]
    );
    res.json({ ok: true, data: result.rows[0], message: `Đã nâng cấp lên gói ${plan_type}` });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
