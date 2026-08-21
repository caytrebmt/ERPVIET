import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { query, isDbConnected, pool } from '../db/index';
import { tenantMiddleware, requireSuperAdmin, TenantRequest } from '../middleware/tenant.js';
import { JWT_SECRET } from '../config.js';
import { postInventoryMovement } from '../services/inventoryService.js';
import { getProcurementList, saveProcurementList, PROCUREMENT_LIST_TYPES } from '../services/procurementService.js';

import viLocales from '../../public/locales/vi.json';
import enLocales from '../../public/locales/en.json';

const BCRYPT_ROUNDS = 10;

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

// Lấy danh sách permission thực tế của user từ sys_role_permissions.
async function getPermissionsForUser(userId: number, roleCode: string): Promise<string[]> {
  if (roleCode === 'ADMIN') return ['*'];
  const res = await query(
    `SELECT COALESCE(array_agg(DISTINCT srp.permission_code), '{}') AS perms
       FROM sys_users u
       LEFT JOIN sys_roles r ON r.id = u.role_id
       LEFT JOIN sys_role_permissions srp ON srp.role_id = r.id
      WHERE u.id = $1`,
    [userId]
  );
  return res.rows[0]?.perms || [];
}

// ==========================================
// ERP AUTHENTICATION ENDPOINTS
// ==========================================
// Giới hạn số lần thử đăng nhập để chống brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // tối đa 10 lần thử / IP
  message: { ok: false, message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
  standardHeaders: true,
  legacyHeaders: false,
});

saasRouter.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập tên đăng nhập ERP.' });
  }

  const cleanUser = username.toLowerCase().trim();
  const cleanPass = (password || '').trim();

  try {
    const result = await query(
      `SELECT u.*, r.code as role_code, r.name_vi as role_name_vi, r.name_en as role_name_en 
       FROM sys_users u 
       LEFT JOIN sys_roles r ON u.role_id = r.id 
       WHERE LOWER(u.username) = $1 OR LOWER(u.email) = $1
       ORDER BY u.id ASC
       LIMIT 1`,
      [cleanUser]
    );

    if (result.rows.length > 0) {
      const dbUser = result.rows[0];
      const storedHash = dbUser.password_hash || '';
      let isMatch = false;

      // Check bcrypt hash first
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        isMatch = await bcrypt.compare(cleanPass, storedHash);
      } else if (process.env.NODE_ENV !== 'production') {
        // Fallback plaintext chỉ dùng cho dữ liệu legacy trong môi trường dev.
        isMatch = storedHash === cleanPass || storedHash === cleanPass.toLowerCase();
      }

      if (!isMatch) {
        return res.status(401).json({
          ok: false,
          message: 'Tài khoản ERP không tồn tại hoặc mật khẩu chưa đúng.',
        });
      }

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
        is_super_admin: !!dbUser.is_super_admin,
        permissions: await getPermissionsForUser(dbUser.id, dbUser.role_code || 'ADMIN'),
        preferred_lang: dbUser.preferred_lang || 'vi',
      };
      const token = jwt.sign(
        {
          userId: userObj.id,
          username: userObj.username,
          role: userObj.role_code,
          companyId: userObj.company_id,
          isSuperAdmin: !!dbUser.is_super_admin,
        },
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

  return res.status(401).json({
    ok: false,
    message: 'Tài khoản ERP không tồn tại hoặc mật khẩu chưa đúng.',
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
    const userId = decoded.userId;
    const result = await query(
      `SELECT u.*, r.code as role_code, r.name_vi as role_name_vi, r.name_en as role_name_en 
       FROM sys_users u 
       LEFT JOIN sys_roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [userId]
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
        is_super_admin: !!dbUser.is_super_admin,
        permissions: await getPermissionsForUser(dbUser.id, dbUser.role_code || 'ADMIN'),
        preferred_lang: dbUser.preferred_lang || 'vi',
      };
      return res.json({ ok: true, data: userObj });
    }
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Phiên đăng nhập ERP đã hết hạn' });
  }
  return res.status(404).json({ ok: false, message: 'Không tìm thấy người dùng' });
});

// ==========================================
// ERP USER CRUD ENDPOINTS
// ==========================================

saasRouter.get('/users', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT u.*, r.code as role_code, r.name_vi as role_name_vi, r.name_en as role_name_en, r.id as role_id,
              d.id as dept_id, d.code as dept_code, d.name_vi as dept_name_vi, d.name_en as dept_name_en
       FROM sys_users u 
       LEFT JOIN sys_roles r ON u.role_id = r.id 
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE ($1::int IS NULL OR u.company_id = $1)
       ORDER BY u.id ASC`,
      [companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/departments', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, code, name_vi, name_en, is_active FROM departments WHERE is_active = TRUE ORDER BY id ASC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/users', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const { username, password, full_name, email, phone, role_id, department_id, status = 'active', preferred_lang = 'vi' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, message: 'Thiếu tên đăng nhập hoặc mật khẩu' });
  }

  try {
    const companyId = req.isSuperAdmin ? (req.body.company_id || 1) : req.companyId;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await query(
      `INSERT INTO sys_users (company_id, username, email, password_hash, full_name, phone, role_id, department_id, status, preferred_lang)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, username, email, full_name, phone, company_id, role_id, department_id, status, preferred_lang`,
      [companyId, username, email || username, passwordHash, full_name || username, phone || '', role_id || 5, department_id || null, status, preferred_lang]
    );
    const newUser = result.rows[0];
    res.json({ ok: true, data: newUser, message: 'Đã tạo tài khoản người dùng mới' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.put('/users/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const userId = Number(req.params.id);
  const { username, password, full_name, email, phone, role_id, department_id, status, preferred_lang } = req.body;

  try {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (username !== undefined) { sets.push(`username = $${idx++}`); params.push(username); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); params.push(email); }
    if (password !== undefined) { sets.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(password, BCRYPT_ROUNDS)); }
    if (full_name !== undefined) { sets.push(`full_name = $${idx++}`); params.push(full_name); }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(phone); }
    if (role_id !== undefined) { sets.push(`role_id = $${idx++}`); params.push(role_id); }
    if (department_id !== undefined) { sets.push(`department_id = $${idx++}`); params.push(department_id || null); }
    if (status !== undefined) { sets.push(`status = $${idx++}`); params.push(status); }
    if (preferred_lang !== undefined) { sets.push(`preferred_lang = $${idx++}`); params.push(preferred_lang); }

    if (sets.length === 0) return res.status(400).json({ ok: false, message: 'Không có dữ liệu cập nhật' });

    params.push(userId);
    const result = await query(`UPDATE sys_users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, username, email, full_name, phone, company_id, role_id, department_id, status, preferred_lang`, params);
    res.json({ ok: true, data: result.rows[0], message: 'Đã cập nhật thông tin người dùng' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.delete('/users/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const userId = Number(req.params.id);
  try {
    await query('DELETE FROM sys_users WHERE id = $1', [userId]);
    res.json({ ok: true, message: 'Đã xóa người dùng khỏi hệ thống' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
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

saasRouter.get('/locales/:lang', async (req: Request, res: Response) => {
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

saasRouter.get('/locales/:lang/db', async (req: Request, res: Response) => {
  const { lang } = req.params;
  if (!['vi', 'en'].includes(lang)) {
    return res.status(400).json({ ok: false, error: 'Invalid language code' });
  }

  try {
    const viField = 'vi_text';
    const enField = 'en_text';
    const sql = lang === 'vi'
      ? `SELECT key_name as key, vi_text as value FROM sys_translations WHERE vi_text IS NOT NULL ORDER BY key_name ASC`
      : `SELECT key_name as key, en_text as value FROM sys_translations WHERE en_text IS NOT NULL ORDER BY key_name ASC`;

    const result = await query(sql);
    const flat: Record<string, string> = {};
    (result.rows || []).forEach((row: any) => {
      if (!String(row.key).startsWith('_')) {
        flat[row.key] = row.value;
      }
    });

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(flat));
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/languages', async (req, res) => {
  try {
    const result = await query('SELECT * FROM sys_languages WHERE is_active = TRUE ORDER BY is_default DESC');
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/translations/all', async (req: Request, res: Response) => {
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
  try {
    await query('DELETE FROM sys_translations WHERE key_name = $1', [key]);
    res.json({ ok: true, message: 'Translation key deleted' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/translations/json', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    let viContent: Record<string, any> = {};
    let enContent: Record<string, any> = {};

    try {
      const fs = await import('fs');
      const path = await import('path');
      const viPath = path.join(process.cwd(), 'public', 'locales', 'vi.json');
      const enPath = path.join(process.cwd(), 'public', 'locales', 'en.json');

      try { viContent = JSON.parse(fs.readFileSync(viPath, 'utf8')); } catch { }
      try { enContent = JSON.parse(fs.readFileSync(enPath, 'utf8')); } catch { }
    } catch { }

    if (Object.keys(viContent).length === 0) {
      viContent = (viLocales as any).default || viLocales;
    }
    if (Object.keys(enContent).length === 0) {
      enContent = (enLocales as any).default || enLocales;
    }

    res.json({
      ok: true,
      data: {
        vi: viContent,
        en: enContent,
        groups: viContent._groups || {}
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.put('/translations/json', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const { key, lang, value } = req.body;
  if (!key || !lang || value === undefined) {
    return res.status(400).json({ ok: false, error: 'Key, lang, and value are required' });
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const targetPath = path.join(process.cwd(), 'public', 'locales', lang === 'en' ? 'en.json' : 'vi.json');

    let content: Record<string, any> = {};
    try { content = JSON.parse(fs.readFileSync(targetPath, 'utf8')); } catch { }

    if (Object.keys(content).length === 0 && lang === 'vi') {
      content = { ...((viLocales as any).default || viLocales) };
    }
    if (Object.keys(content).length === 0 && lang === 'en') {
      content = { ...((enLocales as any).default || enLocales) };
    }

    content[key] = value;

    try {
      fs.writeFileSync(targetPath, JSON.stringify(content, null, 2) + '\n');
    } catch (writeErr: any) {
      return res.status(500).json({ ok: false, error: 'Cannot write to locale file (filesystem read-only). Use Publish from DB instead.', detail: writeErr.message });
    }

    res.json({ ok: true, message: 'Translation updated in JSON file' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/translations/json/bulk', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const { translations } = req.body;
  if (!translations || typeof translations !== 'object') {
    return res.status(400).json({ ok: false, error: 'translations object is required' });
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const viPath = path.join(process.cwd(), 'public', 'locales', 'vi.json');
    const enPath = path.join(process.cwd(), 'public', 'locales', 'en.json');

    let viContent: Record<string, any> = {};
    let enContent: Record<string, any> = {};

    try { viContent = JSON.parse(fs.readFileSync(viPath, 'utf8')); } catch { }
    try { enContent = JSON.parse(fs.readFileSync(enPath, 'utf8')); } catch { }

    if (Object.keys(viContent).length === 0) {
      viContent = { ...((viLocales as any).default || viLocales) };
    }
    if (Object.keys(enContent).length === 0) {
      enContent = { ...((enLocales as any).default || enLocales) };
    }

    const isObj = (v: any) => v && typeof v === 'object' && !Array.isArray(v);

    for (const [key, val] of Object.entries(translations)) {
      if (isObj(val)) {
        const pair = val as any;
        if (pair.vi !== undefined) viContent[key] = pair.vi;
        if (pair.en !== undefined) enContent[key] = pair.en;
        if (pair.vi !== undefined && pair.en === undefined) enContent[key] = viContent[key];
      } else {
        const strVal = String(val || '');
        viContent[key] = strVal;
        enContent[key] = strVal;
      }
    }

    fs.writeFileSync(viPath, JSON.stringify(viContent, null, 2) + '\n');
    fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2) + '\n');

    res.json({ ok: true, message: `Saved ${Object.keys(translations).length} translations to JSON locale files.` });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/translations/json/publish', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const fs = await import('fs');
    const path = await import('path');

    const viPath = path.join(process.cwd(), 'public', 'locales', 'vi.json');
    const enPath = path.join(process.cwd(), 'public', 'locales', 'en.json');

    let viContent: Record<string, any> = {};
    let enContent: Record<string, any> = {};

    try { viContent = JSON.parse(fs.readFileSync(viPath, 'utf8')); } catch { }
    try { enContent = JSON.parse(fs.readFileSync(enPath, 'utf8')); } catch { }

    if (Object.keys(viContent).length === 0) {
      viContent = { ...((viLocales as any).default || viLocales) };
    }
    if (Object.keys(enContent).length === 0) {
      enContent = { ...((enLocales as any).default || enLocales) };
    }

    const result = await query(
      `SELECT key_name as key, category, vi_text as vi, en_text as en
       FROM sys_translations ORDER BY key_name ASC`
    );

    const dbTranslations = result.rows || [];

    for (const row of dbTranslations) {
      const key = String(row.key);
      if (key.startsWith('_')) continue;

      if (row.vi) viContent[key] = row.vi;
      if (row.en) enContent[key] = row.en;
      if (row.vi && !row.en) enContent[key] = row.vi;
      if (row.en && !row.vi) viContent[key] = row.en;

      if (row.category && row.category !== 'common') {
        if (!viContent._groups) viContent._groups = {};
        if (!Array.isArray(viContent._groups[row.category])) viContent._groups[row.category] = [];
        if (!viContent._groups[row.category].includes(key)) viContent._groups[row.category].push(key);
      }
    }

    fs.writeFileSync(viPath, JSON.stringify(viContent, null, 2) + '\n');
    fs.writeFileSync(enPath, JSON.stringify(enContent, null, 2) + '\n');

    res.json({ ok: true, data: { viKeys: Object.keys(viContent).length, enKeys: Object.keys(enContent).length, published: dbTranslations.length }, message: `Published ${dbTranslations.length} translations from DB to JSON files.` });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 2. SYSTEM SETTINGS & CONFIGURATION
// ==========================================
saasRouter.get('/settings', async (req: Request, res: Response) => {
  const lang = getLang(req);
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
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM customers WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/suppliers', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM suppliers WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/quotations', tenantMiddleware, async (req: TenantRequest, res) => {
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

  res.json({ ok: true, message: 'Saved translation key successfully' });
});

saasRouter.delete('/translations/:key', async (req, res) => {
  const { key } = req.params;
  try {
    await query(`DELETE FROM sys_translations WHERE translation_key = $1`, [key]);
  } catch (error: any) {
    console.error('[Translation DB Delete Error]', error);
  }
  res.json({ ok: true, message: 'Deleted translation key successfully' });
});

// ==========================================
// 8. CRM & SALES PIPELINE ENDPOINTS
// ==========================================
saasRouter.get('/crm/leads', tenantMiddleware, async (req: TenantRequest, res) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM crm_leads WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/crm/opportunities', tenantMiddleware, async (req: TenantRequest, res) => {
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
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query('SELECT * FROM purchase_requests WHERE ($1::int IS NULL OR company_id = $1) ORDER BY id DESC', [companyId]);
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// PROCUREMENT (PR / RFQ / PO) — DB-backed (thay thế localStorage)
// ==========================================
// Mỗi tenant lưu danh sách PR / RFQ / PO trong bảng procurement_lists (JSONB),
// giúp dữ liệu mua hàng sống sót qua đổi thiết bị/trình duyệt và dùng chung
// giữa các người dùng trong cùng doanh nghiệp.

function parseProcurementType(type: string): string | null {
  return (PROCUREMENT_LIST_TYPES as string[]).includes(type) ? type : null;
}

saasRouter.get('/purchasing/procurement/:type', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const type = parseProcurementType(req.params.type);
  if (!type) {
    return res.status(400).json({ ok: false, message: 'Loại dữ liệu không hợp lệ (prs | rfqs | pos)' });
  }
  if (!req.companyId) {
    return res.status(403).json({ ok: false, message: 'Không xác định được tenant' });
  }
  try {
    const data = await getProcurementList(req.companyId, type as any);
    res.json({ ok: true, data });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.put('/purchasing/procurement/:type', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const type = parseProcurementType(req.params.type);
  if (!type) {
    return res.status(400).json({ ok: false, message: 'Loại dữ liệu không hợp lệ (prs | rfqs | pos)' });
  }
  if (!req.companyId) {
    return res.status(403).json({ ok: false, message: 'Không xác định được tenant' });
  }
  const payload = req.body?.data;
  if (!Array.isArray(payload)) {
    return res.status(400).json({ ok: false, message: 'Dữ liệu phải là mảng' });
  }
  try {
    await saveProcurementList(req.companyId, type as any, payload);
    res.json({ ok: true, message: 'Đã lưu dữ liệu mua hàng' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ==========================================
// 10. FIXED ASSETS & DEPRECIATION ENDPOINTS
// ==========================================
saasRouter.get('/assets', tenantMiddleware, async (req: TenantRequest, res) => {
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

saasRouter.get('/tenants/list', tenantMiddleware, requireSuperAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, code, name_vi, name_en, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_paused, is_active, created_at FROM companies ORDER BY id DESC`
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/tenants/:id', tenantMiddleware, requireSuperAdmin, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
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
  const normalizedPlanType = ['free', 'starter', 'professional', 'enterprise'].includes(plan_type) ? plan_type : 'free';

  if (!name_vi || !tax_code || !owner_email || !owner_password) {
    return res.status(400).json({ ok: false, message: 'Thiếu thông tin bắt buộc: tên công ty, mã số thuế, email quản lý, mật khẩu' });
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
      [code, name_vi, name_en || null, tax_code, email || null, phone || null, address || null, slug, slug, normalizedPlanType]
    );
    const companyId = companyResult.rows[0].id;

    const roleResult = await client.query("SELECT id FROM sys_roles WHERE code = 'ADMIN' LIMIT 1");
    const roleId = roleResult.rows[0]?.id || 1;

    // BẮT BUỘC hash mật khẩu trước khi lưu (không lưu plaintext).
    const passwordHash = await bcrypt.hash(owner_password, BCRYPT_ROUNDS);

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
      data: { token, company: { id: companyId, code, name_vi, slug, plan_type: normalizedPlanType, subscription_status: 'trial' } },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('[Tenant Register Error]', error);
    res.status(500).json({ ok: false, message: 'Đăng ký thất bại: ' + error.message });
  } finally {
    client.release();
  }
});

saasRouter.post('/auth/google/callback', async (req: Request, res: Response) => {
  try {
    const { google_profile, company_info, plan_type = 'trial' } = req.body || {};
    const normalizedPlanType = ['free', 'starter', 'professional', 'enterprise'].includes(plan_type) ? plan_type : 'free';
    if (!google_profile?.email) {
      return res.status(400).json({ ok: false, message: 'Thiếu thông tin email từ Google.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const email = String(google_profile.email).trim().toLowerCase();
      const fullName = google_profile.name || google_profile.given_name || email.split('@')[0];
      const givenName = google_profile.given_name || fullName;
      const familyName = google_profile.family_name || '';
      const picture = google_profile.picture || '';
      const googleId = google_profile.sub || google_profile.id || email;

      let userResult = await client.query(`SELECT u.*, c.id as company_id, c.name_vi as company_name FROM sys_users u LEFT JOIN companies c ON c.owner_user_id = u.id WHERE LOWER(u.email) = $1 LIMIT 1`, [email]);

      let userId: number;
      let companyId: number | null = null;

      if (userResult.rows.length > 0) {
        userId = userResult.rows[0].id;
        companyId = userResult.rows[0].company_id || null;

        if (!companyId && company_info?.name_vi) {
          const slug = company_info.name_vi.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40) + '-' + Date.now().toString(36);
          const code = 'TENANT-' + Date.now().toString(36).toUpperCase();
          const companyResult = await client.query(
            `INSERT INTO companies (code, name_vi, name_en, tax_code, email, phone, address, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_active, onboarding_completed, owner_user_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'trial', NOW() + INTERVAL '14 days', 5, 3, TRUE, FALSE, $11)
             RETURNING id`,
             [code, company_info.name_vi, company_info.name_en || null, company_info.tax_code || null, company_info.email || email, company_info.phone || null, company_info.address || null, slug, slug, normalizedPlanType, userId]
          );
          companyId = companyResult.rows[0].id;
          await client.query('UPDATE sys_users SET company_id = $1 WHERE id = $2', [companyId, userId]);

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
        }
      } else {
        if (!company_info?.name_vi || !company_info?.tax_code) {
          await client.query('ROLLBACK');
          return res.status(400).json({ ok: false, message: 'Thiếu thông tin công ty để đăng ký.' });
        }

        const slug = company_info.name_vi.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40) + '-' + Date.now().toString(36);
        const code = 'TENANT-' + Date.now().toString(36).toUpperCase();
        const roleResult = await client.query("SELECT id FROM sys_roles WHERE code = 'ADMIN' LIMIT 1");
        const roleId = roleResult.rows[0]?.id || 1;
        // Không đặt mật khẩu dùng chung cho user Google: dùng hash ngẫu nhiên.
        const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);

        const companyResult = await client.query(
          `INSERT INTO companies (code, name_vi, name_en, tax_code, email, phone, address, slug, subdomain, plan_type, subscription_status, trial_ends_at, max_users, max_warehouses, is_active, onboarding_completed)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'trial', NOW() + INTERVAL '14 days', 5, 3, TRUE, FALSE)
           RETURNING id`,
           [code, company_info.name_vi, company_info.name_en || null, company_info.tax_code, company_info.email || email, company_info.phone || null, company_info.address || null, slug, slug, normalizedPlanType]
        );
        companyId = companyResult.rows[0].id;

        const userResultInsert = await client.query(
          `INSERT INTO sys_users (company_id, username, email, password_hash, full_name, phone, role_id, status, preferred_lang)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'vi')
           RETURNING id`,
          [companyId, email, email, passwordHash, fullName, company_info.phone || null, roleId]
        );
        userId = userResultInsert.rows[0].id;
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
      }

      await client.query('COMMIT');

      const token = jwt.sign(
        { userId, username: email, role: 'ADMIN', companyId: companyId || undefined },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        ok: true,
        message: companyId ? 'Đăng nhập Google thành công!' : 'Đăng ký từ Google thành công!',
        data: {
          token,
          user: { id: userId, email, full_name: fullName, picture, role: 'ADMIN' },
          company: companyId ? { id: companyId } : null,
          is_new: !companyId,
        },
      });
    } catch (dbError: any) {
      await client.query('ROLLBACK');
      console.error('[Google Auth DB Error]', dbError);
      res.status(500).json({ ok: false, message: 'Lỗi xử lý đăng nhập Google: ' + dbError.message });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('[Google Auth Error]', error);
    res.status(500).json({ ok: false, message: 'Lỗi máy chủ đăng nhập Google.' });
  }
});

saasRouter.patch('/tenants/:id', tenantMiddleware, requireSuperAdmin, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  const { name_vi, name_en, plan_type, subscription_status, trial_ends_at, settings, max_users, max_warehouses, is_paused, onboarding_completed } = req.body;

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

saasRouter.post('/tenants/:id/pause', tenantMiddleware, requireSuperAdmin, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  const { paused } = req.body;

  try {
    const result = await query('UPDATE companies SET is_paused = $1 WHERE id = $2 RETURNING id, name_vi, is_paused', [!!paused, tenantId]);
    res.json({ ok: true, data: result.rows[0], message: paused ? 'Tenant đã bị tạm dừng' : 'Tenant đã được kích hoạt lại' });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/tenants/:id/upgrade', tenantMiddleware, requireSuperAdmin, async (req: TenantRequest, res: Response) => {
  const tenantId = parseInt(req.params.id);
  const { plan_type } = req.body;

  if (!['free', 'starter', 'professional', 'enterprise'].includes(plan_type)) {
    return res.status(400).json({ ok: false, message: 'Gói không hợp lệ' });
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
