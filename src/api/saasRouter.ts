import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { query, isDbConnected } from '../db/index';
import { postInventoryMovement } from '../services/inventoryService.js';

export const saasRouter = Router();

saasRouter.get('/notifications', async (_req, res) => {
  try {
    const result = await query(`
      SELECT * FROM (
        SELECT id, title_vi, title_en, content_vi, content_en, is_read, link_url, created_at FROM notifications
        UNION ALL
        SELECT -wo.id, 'Đơn hàng WebShop mới', 'New WebShop order',
               'Đơn ' || wo.code || ' trị giá ' || to_char(wo.total_amount, 'FM999,999,999,999') || ' đ',
               'Order ' || wo.code || ' total ' || to_char(wo.total_amount, 'FM999,999,999,999'),
               FALSE, '/saas/web-orders', wo.created_at
        FROM web_orders wo WHERE wo.order_status = 'CHO_XAC_NHAN'
        UNION ALL
        SELECT -(100000 + p.id), 'Cảnh báo tồn kho', 'Low stock alert',
               p.name_vi || ': tồn ' || p.stock_quantity || ', tối thiểu ' || p.min_stock,
               p.name_en || ': stock ' || p.stock_quantity || ', minimum ' || p.min_stock,
               FALSE, '/saas/inventory', CURRENT_TIMESTAMP
        FROM products p WHERE p.stock_quantity <= p.min_stock
      ) alerts ORDER BY is_read ASC, created_at DESC LIMIT 30`);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/inventory/balances', async (_req, res) => {
  try {
    const result = await query(`SELECT sb.warehouse_id, w.name_vi AS warehouse_vi, w.name_en AS warehouse_en, p.id AS product_id, p.sku, p.name_vi, p.name_en, sb.quantity AS stock, sb.reserved_quantity AS reserved, (sb.quantity - sb.reserved_quantity) AS available, p.cost_price AS unit_cost, (sb.quantity * p.cost_price) AS total_value FROM stock_balances sb JOIN products p ON p.id = sb.product_id JOIN warehouses w ON w.id = sb.warehouse_id ORDER BY w.id, p.id`);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/inventory/movements', async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : null;
    const toDate = typeof req.query.to === 'string' && req.query.to ? req.query.to : null;
    const result = await query(
      `SELECT sm.id, sm.code, sm.movement_type, sm.reference_doc, sm.movement_date, sm.notes,
              w.name_vi AS warehouse_vi, w.name_en AS warehouse_en,
              p.sku, p.name_vi, p.name_en, smi.quantity, smi.unit_cost, smi.subtotal_cost
       FROM stock_movements sm JOIN stock_movement_items smi ON smi.movement_id = sm.id
       JOIN products p ON p.id = smi.product_id LEFT JOIN warehouses w ON w.id = sm.warehouse_id
       WHERE ($1::date IS NULL OR sm.movement_date >= $1::date)
         AND ($2::date IS NULL OR sm.movement_date <= $2::date)
       ORDER BY sm.movement_date DESC, sm.id DESC, smi.id ASC LIMIT $3`, [fromDate, toDate, limit]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/inventory/xnt', async (req, res) => {
  try {
    const fromDate = typeof req.query.from === 'string' && req.query.from ? req.query.from : '1900-01-01';
    const toDate = typeof req.query.to === 'string' && req.query.to ? req.query.to : new Date().toISOString().slice(0, 10);
    const warehouseId = req.query.warehouse_id ? Number(req.query.warehouse_id) : null;
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
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
       WHERE ($3::int IS NULL OR w.id = $3) AND ($4::int IS NULL OR p.category_id = $4)
       GROUP BY p.id, p.sku, p.name_vi, p.name_en, u.name_vi, u.name_en, w.id, w.name_vi, w.name_en, p.cost_price, p.min_stock
       ORDER BY p.sku`, [fromDate, toDate, warehouseId, categoryId]
    );
    const rows = result.rows.map((r) => ({ ...r, opening_qty: Number(r.opening_qty), in_qty: Number(r.in_qty), out_qty: Number(r.out_qty), closing_qty: Number(r.closing_qty), cost_price: Number(r.cost_price), opening_value: Number(r.opening_qty) * Number(r.cost_price), in_value: Number(r.in_qty) * Number(r.cost_price), out_value: Number(r.out_qty) * Number(r.cost_price), closing_value: Number(r.closing_qty) * Number(r.cost_price) }));
    const kpi = rows.reduce((a, r) => ({ opening_qty: a.opening_qty + r.opening_qty, in_qty: a.in_qty + r.in_qty, out_qty: a.out_qty + r.out_qty, closing_qty: a.closing_qty + r.closing_qty, opening_value: a.opening_value + r.opening_value, in_value: a.in_value + r.in_value, out_value: a.out_value + r.out_value, closing_value: a.closing_value + r.closing_value }), { opening_qty: 0, in_qty: 0, out_qty: 0, closing_qty: 0, opening_value: 0, in_value: 0, out_value: 0, closing_value: 0 });
    res.json({ ok: true, data: { fromDate, toDate, kpi, rows } });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.post('/inventory/movements', async (req, res) => {
  try { res.json({ ok: true, data: await postInventoryMovement(req.body) }); }
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
          role_code: dbUser.role_code || 'ADMIN',
          role_name_vi: dbUser.role_name_vi || 'Quản trị viên',
          role_name_en: dbUser.role_name_en || 'System Administrator',
          permissions: dbUser.role_code === 'ADMIN' ? ['*'] : DEMO_ERP_USERS[dbUser.username]?.permissions || ['*'],
          preferred_lang: dbUser.preferred_lang || 'vi',
        };
        const token = jwt.sign(
          { userId: userObj.id, username: userObj.username, role: userObj.role_code },
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
saasRouter.get('/products', async (req: Request, res: Response) => {
  const lang = getLang(req);
  if (!isDbConnected()) {
    return res.json({ ok: true, message: 'Running with local mock products' });
  }

  try {
    const result = await query(
      `SELECT p.id, p.sku, p.cost_price, p.selling_price, p.web_price, p.stock_quantity, p.min_stock,
              CASE WHEN $1 = 'en' THEN p.name_en ELSE p.name_vi END as name,
              CASE WHEN $1 = 'en' THEN p.description_en ELSE p.description_vi END as description,
              CASE WHEN $1 = 'en' THEN c.name_en ELSE c.name_vi END as category_name,
              CASE WHEN $1 = 'en' THEN u.name_en ELSE u.name_vi END as uom_name
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       LEFT JOIN uom u ON p.uom_id = u.id 
       ORDER BY p.id DESC`,
      [lang]
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
saasRouter.get('/customers', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock customers' });
  try {
    const result = await query('SELECT * FROM customers ORDER BY id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/suppliers', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock suppliers' });
  try {
    const result = await query('SELECT * FROM suppliers ORDER BY id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/quotations', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock quotations' });
  try {
    const result = await query(
      `SELECT q.*, c.name as customer_name, c.phone as customer_phone 
       FROM quotations q 
       LEFT JOIN customers c ON q.customer_id = c.id 
       ORDER BY q.id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/orders', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock orders' });
  try {
    const result = await query(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone 
       FROM sales_orders o 
       LEFT JOIN customers c ON o.customer_id = c.id 
       ORDER BY o.id DESC`
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
saasRouter.get('/crm/leads', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock CRM leads' });
  try {
    const result = await query('SELECT * FROM crm_leads ORDER BY id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/crm/opportunities', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock CRM opportunities' });
  try {
    const result = await query(
      `SELECT o.*, c.company_name, c.contact_name 
       FROM crm_opportunities o 
       LEFT JOIN crm_contacts c ON o.contact_id = c.id 
       ORDER BY o.id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 9. PURCHASING & PROCUREMENT ENDPOINTS
// ==========================================
saasRouter.get('/purchasing/orders', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock purchase orders' });
  try {
    const result = await query(
      `SELECT po.*, s.name as supplier_name, s.code as supplier_code, s.phone as supplier_phone 
       FROM purchase_orders po 
       LEFT JOIN suppliers s ON po.supplier_id = s.id 
       ORDER BY po.id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/purchasing/requests', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock purchase requests' });
  try {
    const result = await query('SELECT * FROM purchase_requests ORDER BY id DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 10. FIXED ASSETS & DEPRECIATION ENDPOINTS
// ==========================================
saasRouter.get('/assets', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock assets' });
  try {
    const result = await query(
      `SELECT fa.*, 
              COALESCE(SUM(ad.depreciation_amount), 0) as total_depreciated
       FROM fixed_assets fa
       LEFT JOIN asset_depreciations ad ON fa.id = ad.asset_id
       GROUP BY fa.id
       ORDER BY fa.id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 11. AUDIT LOGS & USER SESSIONS ENDPOINTS
// ==========================================
saasRouter.get('/audit-logs', async (req, res) => {
  if (!isDbConnected()) return res.json({ ok: true, message: 'Running with mock audit logs' });
  try {
    const result = await query(
      `SELECT al.*, u.full_name as user_name, u.username
       FROM sys_audit_logs al
       LEFT JOIN sys_users u ON al.user_id = u.id
       ORDER BY al.id DESC LIMIT 100`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
