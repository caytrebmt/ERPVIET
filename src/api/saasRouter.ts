import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import rateLimit from 'express-rate-limit';
import { query, pool } from '../db/index.js';
import { tenantMiddleware, requireSuperAdmin, requireTenantAdmin, TenantRequest } from '../middleware/tenant.js';
import { JWT_SECRET } from '../config.js';
import { isUniqueViolation, isValidEmail, normalizeEmail, normalizeSlug, normalizeTaxCode, uniqueViolationConstraint } from '../utils/identifiers.js';
import { postInventoryMovement } from '../services/inventoryService.js';
import { getProcurementList, saveProcurementList, PROCUREMENT_LIST_TYPES } from '../services/procurementService.js';
import {
  parseTranslationsListQuery,
  buildTranslationsSqlFilters,
  buildTranslationsOrderBy,
  SQL_META_KEY_FILTER,
} from '../services/translationsService';

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
              p.id AS product_id, p.sku, p.name_vi, p.name_en, smi.quantity, smi.unit_cost, smi.subtotal_cost
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

// Dashboard KPI summary — one round trip for the 4 headline cards. Previously
// the UI hardcoded mock values ("0 đ", "+18.4%", "10 danh mục", "8 khách hàng")
// and never fetched real numbers. All figures are computed from the actual
// books: sales_orders (revenue), stock_balances x products (inventory value),
// and sales_orders/purchase_orders net of receipts_payments vouchers
// (THU/CHI) for customer/supplier debt. Month boundaries are passed as
// parameters (computed in JS) so no DB-specific date functions are needed.
saasRouter.get('/dashboard/summary', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [revenueRes, inventoryRes, customerOwedRes, supplierOwedRes, customerPaidRes, supplierPaidRes] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(CASE WHEN o.order_date >= $2::date AND o.order_date < $3::date THEN o.total_amount ELSE 0 END), 0) AS this_month,
           COALESCE(SUM(CASE WHEN o.order_date >= $4::date AND o.order_date < $2::date THEN o.total_amount ELSE 0 END), 0) AS last_month
         FROM sales_orders o
         WHERE o.status <> 'HUY' AND ($1::int IS NULL OR o.company_id = $1)`,
        [companyId, iso(thisMonthStart), iso(nextMonthStart), iso(lastMonthStart)],
      ),
      query(
        `SELECT COALESCE(SUM(sb.quantity * p.cost_price), 0) AS total_value,
                COUNT(DISTINCT p.category_id) AS categories_with_stock
         FROM stock_balances sb
         JOIN products p ON p.id = sb.product_id AND p.company_id = sb.company_id
         WHERE sb.quantity > 0 AND ($1::int IS NULL OR sb.company_id = $1)`,
        [companyId],
      ),
      // Order totals per customer (non-cancelled) and per supplier...
      query(
        `SELECT o.customer_id AS partner_id, SUM(o.total_amount) AS owed
         FROM sales_orders o
         WHERE o.status <> 'HUY' AND o.customer_id IS NOT NULL
           AND ($1::int IS NULL OR o.company_id = $1)
         GROUP BY o.customer_id`,
        [companyId],
      ),
      query(
        `SELECT po.supplier_id AS partner_id, SUM(po.total_amount) AS owed
         FROM purchase_orders po
         WHERE po.status <> 'HUY' AND po.supplier_id IS NOT NULL
           AND ($1::int IS NULL OR po.company_id = $1)
         GROUP BY po.supplier_id`,
        [companyId],
      ),
      // ...net of THU/CHI cash vouchers; balances are combined in JS to stay
      // portable across engines (no LEFT JOIN over aggregate subqueries).
      query(
        `SELECT partner_id, SUM(amount) AS paid
         FROM receipts_payments
         WHERE voucher_type = 'THU' AND partner_type = 'KHACH_HANG'
           AND ($1::int IS NULL OR company_id = $1)
         GROUP BY partner_id`,
        [companyId],
      ),
      query(
        `SELECT partner_id, SUM(amount) AS paid
         FROM receipts_payments
         WHERE voucher_type = 'CHI' AND partner_type = 'NHA_CUNG_CAP'
         GROUP BY partner_id`,
      ),
    ]);

    const debtBy = (owedRows: any[], paidRows: any[]): { total: number; partners: number } => {
      const paidByPartner = new Map<number, number>();
      (paidRows || []).forEach((r) => paidByPartner.set(Number(r.partner_id), Number(r.paid) || 0));
      let total = 0;
      let partners = 0;
      (owedRows || []).forEach((r) => {
        const owed = Number(r.owed) || 0;
        const balance = owed - (paidByPartner.get(Number(r.partner_id)) || 0);
        if (balance > 0) {
          total += balance;
          partners += 1;
        }
      });
      return { total, partners };
    };

    const receivables = debtBy(customerOwedRes.rows, customerPaidRes.rows);
    const payables = debtBy(supplierOwedRes.rows, supplierPaidRes.rows);

    const thisMonth = Number(revenueRes.rows[0]?.this_month) || 0;
    const lastMonth = Number(revenueRes.rows[0]?.last_month) || 0;
    const growthPct = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 1000) / 10 : null;

    res.json({
      ok: true,
      data: {
        revenue: { thisMonth, lastMonth, growthPct },
        inventory: {
          totalValue: Number(inventoryRes.rows[0]?.total_value) || 0,
          categoriesWithStock: Number(inventoryRes.rows[0]?.categories_with_stock) || 0,
        },
        receivables: { total: receivables.total, debtors: receivables.partners },
        payables: { total: payables.total, suppliers: payables.partners },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Báo cáo dùng chung cho các màn hình tài chính/kho. Tất cả số liệu đều
// truy vấn từ các bảng nghiệp vụ của tenant, không có dữ liệu mẫu ở frontend.
saasRouter.get('/reports/summary', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const from = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from)
      ? req.query.from
      : '1900-01-01';
    const to = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to)
      ? req.query.to
      : new Date().toISOString().slice(0, 10);
    const [incomeRes, customerRes, supplierRes, stockRes, balanceRes, journalRes] = await Promise.all([
      query(
        `SELECT COUNT(DISTINCT o.id)::int AS order_count,
                COALESCE(SUM(o.total_amount), 0) AS revenue,
                COALESCE(SUM(oi.quantity * p.cost_price), 0) AS cogs,
                COALESCE(SUM(o.tax_amount), 0) AS output_vat
           FROM sales_orders o
           LEFT JOIN sales_order_items oi ON oi.sales_order_id = o.id
           LEFT JOIN products p ON p.id = oi.product_id AND p.company_id = o.company_id
          WHERE ($1::int IS NULL OR o.company_id = $1)
            AND o.status NOT IN ('HUY', 'Hủy')
            AND o.order_date BETWEEN $2::date AND $3::date`,
        [companyId, from, to],
      ),
      query(
        `SELECT c.id, COALESCE(c.name, 'Khách lẻ') AS customer_name,
                COUNT(DISTINCT o.id)::int AS order_count,
                COALESCE(SUM(o.total_amount), 0) AS total_revenue,
                COALESCE(MAX(paid.paid_amount), 0) AS paid_amount
           FROM sales_orders o
           LEFT JOIN customers c ON c.id = o.customer_id AND c.company_id = o.company_id
           LEFT JOIN (
             SELECT partner_id, company_id, SUM(amount) AS paid_amount
               FROM receipts_payments
              WHERE voucher_type = 'THU' AND partner_type = 'KHACH_HANG'
              GROUP BY partner_id, company_id
           ) paid ON paid.partner_id = o.customer_id AND paid.company_id = o.company_id
          WHERE ($1::int IS NULL OR o.company_id = $1)
            AND o.status NOT IN ('HUY', 'Hủy')
            AND o.order_date BETWEEN $2::date AND $3::date
          GROUP BY c.id, c.name, paid.paid_amount
          ORDER BY total_revenue DESC`,
        [companyId, from, to],
      ),
      query(
        `SELECT s.id, COALESCE(s.name, 'Nhà cung cấp') AS supplier_name,
                COUNT(DISTINCT po.id)::int AS stock_in_count,
                COALESCE(SUM(po.total_amount), 0) AS total_purchase,
                COALESCE(MAX(paid.paid_amount), 0) AS paid_amount
           FROM purchase_orders po
           LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.company_id = po.company_id
           LEFT JOIN (
             SELECT partner_id, company_id, SUM(amount) AS paid_amount
               FROM receipts_payments
              WHERE voucher_type = 'CHI' AND partner_type = 'NHA_CUNG_CAP'
              GROUP BY partner_id, company_id
           ) paid ON paid.partner_id = po.supplier_id AND paid.company_id = po.company_id
          WHERE ($1::int IS NULL OR po.company_id = $1)
            AND po.status NOT IN ('HUY', 'Hủy')
            AND po.order_date BETWEEN $2::date AND $3::date
          GROUP BY s.id, s.name, paid.paid_amount
          ORDER BY total_purchase DESC`,
        [companyId, from, to],
      ),
      query(
        `SELECT p.id AS product_id, p.sku, p.name_vi, u.name_vi AS unit_vi,
                p.cost_price,
                COALESCE(SUM(CASE WHEN sm.movement_type = 'NHAP_KHO' AND sm.movement_date < $2::date THEN smi.quantity ELSE 0 END), 0) AS opening_qty,
                COALESCE(SUM(CASE WHEN sm.movement_type = 'NHAP_KHO' AND sm.movement_date BETWEEN $2::date AND $3::date THEN smi.quantity ELSE 0 END), 0) AS in_qty,
                COALESCE(SUM(CASE WHEN sm.movement_type = 'XUAT_KHO' AND sm.movement_date BETWEEN $2::date AND $3::date THEN smi.quantity ELSE 0 END), 0) AS out_qty,
                COALESCE(SUM(CASE WHEN sm.movement_type = 'NHAP_KHO' AND sm.movement_date <= $3::date THEN smi.quantity WHEN sm.movement_type = 'XUAT_KHO' AND sm.movement_date <= $3::date THEN -smi.quantity ELSE 0 END), 0) AS closing_qty,
                p.min_stock
           FROM products p
           LEFT JOIN uom u ON u.id = p.uom_id
           LEFT JOIN stock_movement_items smi ON smi.product_id = p.id AND smi.company_id = p.company_id
           LEFT JOIN stock_movements sm ON sm.id = smi.movement_id AND sm.company_id = p.company_id
          WHERE ($1::int IS NULL OR p.company_id = $1)
          GROUP BY p.id, p.sku, p.name_vi, u.name_vi, p.cost_price, p.min_stock
          ORDER BY p.sku`,
        [companyId, from, to],
      ),
      query(
        `SELECT
           COALESCE((SELECT SUM(sb.quantity * p.cost_price)
                       FROM stock_balances sb JOIN products p ON p.id = sb.product_id AND p.company_id = sb.company_id
                      WHERE ($1::int IS NULL OR sb.company_id = $1)), 0) AS inventory_value,
           COALESCE((SELECT SUM(CASE WHEN voucher_type = 'THU' THEN amount ELSE -amount END)
                       FROM receipts_payments
                      WHERE ($1::int IS NULL OR company_id = $1)), 0) AS cash_flow,
           COALESCE((SELECT SUM(i.total_amount) FROM invoices i
                      WHERE ($1::int IS NULL OR i.company_id = $1) AND i.status <> 'Đã hủy'), 0) AS invoiced,
           COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po
                      WHERE ($1::int IS NULL OR po.company_id = $1) AND po.status NOT IN ('HUY', 'Hủy')), 0) AS purchased`,
        [companyId],
      ),
      query(
        `SELECT COALESCE(SUM(jel.debit_amount), 0) AS debit_total,
                COALESCE(SUM(jel.credit_amount), 0) AS credit_total,
                COUNT(DISTINCT je.id)::int AS journal_count
           FROM journal_entries je
           LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id AND jel.company_id = je.company_id
          WHERE ($1::int IS NULL OR je.company_id = $1)
            AND je.entry_date BETWEEN $2::date AND $3::date`,
        [companyId, from, to],
      ),
    ]);

    const income = incomeRes.rows[0] || {};
    const customers = (customerRes.rows || []).map((row) => {
      const revenue = Number(row.total_revenue) || 0;
      const paid = Number(row.paid_amount) || 0;
      return {
        id: row.id == null ? 0 : Number(row.id),
        customerName: row.customer_name,
        orderCount: Number(row.order_count) || 0,
        totalRevenue: revenue,
        paidAmount: paid,
        debtAmount: Math.max(0, revenue - paid),
      };
    });
    const suppliers = (supplierRes.rows || []).map((row) => {
      const total = Number(row.total_purchase) || 0;
      const paid = Number(row.paid_amount) || 0;
      return {
        id: row.id == null ? 0 : Number(row.id),
        supplierName: row.supplier_name,
        stockInCount: Number(row.stock_in_count) || 0,
        totalPurchase: total,
        paidAmount: paid,
        debtAmount: Math.max(0, total - paid),
      };
    });
    const stock = (stockRes.rows || []).map((row) => {
      const cost = Number(row.cost_price) || 0;
      const closing = Number(row.closing_qty) || 0;
      return {
        id: Number(row.product_id),
        sku: row.sku,
        productName: row.name_vi,
        unit: row.unit_vi || '',
        openingStock: Number(row.opening_qty) || 0,
        stockIn: Number(row.in_qty) || 0,
        stockOut: Number(row.out_qty) || 0,
        closingStock: closing,
        closingValue: closing * cost,
      };
    });
    const revenue = Number(income.revenue) || 0;
    const cogs = Number(income.cogs) || 0;
    const receivable = customers.reduce((sum, row) => sum + row.debtAmount, 0);
    const payable = suppliers.reduce((sum, row) => sum + row.debtAmount, 0);
    const balance = balanceRes.rows[0] || {};
    const journal = journalRes.rows[0] || {};
    const debitTotal = Number(journal.debit_total) || 0;
    const creditTotal = Number(journal.credit_total) || 0;

    res.json({
      ok: true,
      data: {
        period: { from, to },
        income: {
          revenue,
          cogs,
          grossProfit: revenue - cogs,
          expenses: 0,
          netProfit: revenue - cogs,
          orderCount: Number(income.order_count) || 0,
          outputVat: Number(income.output_vat) || 0,
        },
        balance: {
          cash: Number(balance.cash_flow) || 0,
          receivables: receivable,
          inventory: Number(balance.inventory_value) || 0,
          assets: (Number(balance.cash_flow) || 0) + receivable + (Number(balance.inventory_value) || 0),
          payables: payable,
          liabilities: payable,
          equity: (Number(balance.cash_flow) || 0) + receivable + (Number(balance.inventory_value) || 0) - payable,
        },
        customers,
        suppliers,
        stockMovements: stock,
        accounting: { debitTotal, creditTotal, journalCount: Number(journal.journal_count) || 0, balanced: Math.abs(debitTotal - creditTotal) < 0.01 },
        vat: {
          outputVat: Number(income.output_vat) || 0,
          inputVat: 0,
          netVatPayable: Number(income.output_vat) || 0,
          records: [],
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.get('/accounting/summary', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const [accountsRes, entriesRes, trialRes] = await Promise.all([
      query(
        `SELECT coa.account_code AS code, coa.account_name_vi AS name,
                coa.account_type, coa.is_active,
                COALESCE(SUM(jel.debit_amount), 0) AS debit_total,
                COALESCE(SUM(jel.credit_amount), 0) AS credit_total,
                COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) AS current_balance
           FROM chart_of_accounts coa
           LEFT JOIN journal_entry_lines jel ON jel.account_code = coa.account_code
                                             AND ($1::int IS NULL OR jel.company_id = $1)
          WHERE ($1::int IS NULL OR coa.company_id = $1)
          GROUP BY coa.account_code, coa.account_name_vi, coa.account_type, coa.is_active
          ORDER BY coa.account_code`,
        [companyId],
      ),
      query(
        `SELECT je.id, je.code AS entry_no, je.entry_date AS date, je.description,
                COALESCE(SUM(jel.debit_amount), 0) AS amount,
                COALESCE(json_agg(json_build_object(
                  'account_code', jel.account_code,
                  'debit_amount', jel.debit_amount,
                  'credit_amount', jel.credit_amount
                ) ORDER BY jel.id) FILTER (WHERE jel.id IS NOT NULL), '[]'::json) AS lines
           FROM journal_entries je
           LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
          WHERE ($1::int IS NULL OR je.company_id = $1)
          GROUP BY je.id
          ORDER BY je.entry_date DESC, je.id DESC
          LIMIT 500`,
        [companyId],
      ),
      query(
        `SELECT coa.account_code AS code, coa.account_name_vi AS name,
                COALESCE(SUM(jel.debit_amount), 0) AS period_debit,
                COALESCE(SUM(jel.credit_amount), 0) AS period_credit
           FROM chart_of_accounts coa
           LEFT JOIN journal_entry_lines jel ON jel.account_code = coa.account_code
                                             AND ($1::int IS NULL OR jel.company_id = $1)
          WHERE ($1::int IS NULL OR coa.company_id = $1)
          GROUP BY coa.account_code, coa.account_name_vi
          ORDER BY coa.account_code`,
        [companyId],
      ),
    ]);
    const accountType: Record<string, string> = { TAI_SAN: 'Tài sản', NO_PHA_TRA: 'Nợ phải trả', VON_CHU_SO_HUU: 'Vốn CSH', DOANH_THU: 'Doanh thu', CHI_PHI: 'Chi phí' };
    const accounts = accountsRes.rows.map((row) => ({
      code: row.code,
      name: row.name,
      type: accountType[row.account_type] || row.account_type,
      balanceType: ['NO_PHA_TRA', 'VON_CHU_SO_HUU', 'DOANH_THU'].includes(row.account_type) ? 'Có' : 'Nợ',
      currentBalance: Number(row.current_balance) || 0,
      debitTotal: Number(row.debit_total) || 0,
      creditTotal: Number(row.credit_total) || 0,
    }));
    const entries = entriesRes.rows.map((row) => {
      const lines = Array.isArray(row.lines) ? row.lines : [];
      const debit = lines.find((line: any) => Number(line.debit_amount) > 0);
      const credit = lines.find((line: any) => Number(line.credit_amount) > 0);
      return { ...row, amount: Number(row.amount) || 0, debit_account: debit?.account_code || '', credit_account: credit?.account_code || '' };
    });
    const trialBalances = trialRes.rows.map((row) => {
      const debit = Number(row.period_debit) || 0;
      const credit = Number(row.period_credit) || 0;
      return { code: row.code, name: row.name, openingDebit: 0, openingCredit: 0, periodDebit: debit, periodCredit: credit, closingDebit: Math.max(0, debit - credit), closingCredit: Math.max(0, credit - debit) };
    });
    const debitTotal = accounts.reduce((sum, row) => sum + row.debitTotal, 0);
    const creditTotal = accounts.reduce((sum, row) => sum + row.creditTotal, 0);
    res.json({ ok: true, data: { accounts, entries, trialBalances, health: { debitTotal, creditTotal, balanced: Math.abs(debitTotal - creditTotal) < 0.01 } } });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.get('/vat/summary', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  const month = Math.min(12, Math.max(1, Number(req.query.month) || new Date().getMonth() + 1));
  const year = Math.max(2000, Math.min(2200, Number(req.query.year) || new Date().getFullYear()));
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(Date.UTC(year, month, 1));
  const to = toDate.toISOString().slice(0, 10);
  try {
    const result = await query(
      `SELECT i.code, i.invoice_date AS date, COALESCE(c.name, 'Khách lẻ') AS partner_name,
              c.tax_code, 'Hóa đơn bán ra' AS description, 10::numeric AS vat_rate,
              i.subtotal AS taxable_amount, i.tax_amount AS vat_amount,
              i.total_amount, 'output' AS vat_type
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id AND c.company_id = i.company_id
        WHERE ($1::int IS NULL OR i.company_id = $1)
          AND i.invoice_date >= $2::date AND i.invoice_date < $3::date
          AND i.status <> 'Đã hủy'
       UNION ALL
       SELECT po.code, po.order_date AS date, COALESCE(s.name, 'Nhà cung cấp') AS partner_name,
              s.tax_code, 'Hóa đơn mua hàng' AS description, 10::numeric AS vat_rate,
              po.subtotal AS taxable_amount, po.tax_amount AS vat_amount,
              po.total_amount, 'input' AS vat_type
         FROM purchase_orders po
         LEFT JOIN suppliers s ON s.id = po.supplier_id AND s.company_id = po.company_id
        WHERE ($1::int IS NULL OR po.company_id = $1)
          AND po.order_date >= $2::date AND po.order_date < $3::date
          AND po.status NOT IN ('HUY', 'Hủy')
        ORDER BY date DESC, code DESC`,
      [companyId, from, to],
    );
    const records = result.rows.map((row) => ({ ...row, taxableAmount: Number(row.taxable_amount) || 0, vatAmount: Number(row.vat_amount) || 0, totalAmount: Number(row.total_amount) || 0, vatRate: Number(row.vat_rate) || 0 }));
    const outputVat = records.filter((row) => row.vat_type === 'output').reduce((sum, row) => sum + row.vatAmount, 0);
    const inputVat = records.filter((row) => row.vat_type === 'input').reduce((sum, row) => sum + row.vatAmount, 0);
    res.json({ ok: true, data: { month, year, records, outputVat, inputVat, netVatPayable: outputVat - inputVat } });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
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
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE (LOWER(BTRIM(u.username)) = $1 OR LOWER(BTRIM(u.email)) = $1)
         AND u.status = 'active'
         AND (u.is_super_admin = TRUE OR (c.is_active = TRUE AND c.is_paused = FALSE))
       ORDER BY u.id ASC
       LIMIT 1`,
      [cleanUser]
    );

    if (result.rows.length > 0) {
      const dbUser = result.rows[0];
      const storedHash = dbUser.password_hash || '';
      let isMatch = false;

      // Passwords must always be bcrypt hashes. Plaintext and demo-password
      // fallbacks are intentionally not supported.
      if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$')) {
        isMatch = await bcrypt.compare(cleanPass, storedHash);
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
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1
         AND u.status = 'active'
         AND (u.is_super_admin = TRUE OR (c.is_active = TRUE AND c.is_paused = FALSE))`,
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
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.get('/departments', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT d.id, d.code, d.name_vi, d.name_en, d.is_active
         FROM departments d
         LEFT JOIN branches b ON b.id = d.branch_id
        WHERE d.is_active = TRUE AND ($1::int IS NULL OR b.company_id = $1)
        ORDER BY d.id ASC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/users', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const body = req.body || {};
  const username = String(body.username || '').trim().toLowerCase();
  const email = normalizeEmail(body.email || body.username);
  const password = String(body.password || '');
  const fullName = String(body.full_name || username).trim();
  const companyId = req.isSuperAdmin ? Number(body.company_id || req.companyId) : req.companyId;

  if (!username || !password || !fullName || !companyId) {
    return res.status(400).json({ ok: false, message: 'Thiếu tên đăng nhập, mật khẩu hoặc tenant.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Email người dùng không hợp lệ.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await query(
      `INSERT INTO sys_users (
         company_id, username, email, password_hash, full_name, phone,
         role_id, department_id, status, preferred_lang, is_super_admin
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE)
       RETURNING id, username, email, full_name, phone, company_id, role_id,
                 department_id, status, preferred_lang, is_super_admin`,
      [
        companyId,
        username,
        email,
        passwordHash,
        fullName,
        String(body.phone || '').trim() || null,
        Number(body.role_id) || 5,
        body.department_id ? Number(body.department_id) : null,
        body.status || 'active',
        body.preferred_lang || 'vi',
      ],
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Đã tạo tài khoản người dùng mới' });
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      const constraint = uniqueViolationConstraint(error);
      const field = constraint.includes('email') ? 'email' : constraint.includes('username') ? 'username' : 'identifier';
      return res.status(409).json({
        ok: false,
        code: 'DUPLICATE_IDENTIFIER',
        field,
        message: field === 'email' ? 'Email người dùng đã tồn tại.' : field === 'username' ? 'Tên đăng nhập đã tồn tại.' : 'Thông tin người dùng đã tồn tại.',
      });
    }
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.put('/users/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, message: 'ID người dùng không hợp lệ.' });
  }
  const body = req.body || {};

  try {
    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (body.username !== undefined) { sets.push(`username = $${idx++}`); params.push(String(body.username).trim().toLowerCase()); }
    if (body.email !== undefined) {
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) return res.status(400).json({ ok: false, message: 'Email người dùng không hợp lệ.' });
      sets.push(`email = $${idx++}`); params.push(email);
    }
    if (body.password !== undefined) {
      const password = String(body.password);
      if (password.length < 6) return res.status(400).json({ ok: false, message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
      sets.push(`password_hash = $${idx++}`); params.push(await bcrypt.hash(password, BCRYPT_ROUNDS));
    }
    if (body.full_name !== undefined) { sets.push(`full_name = $${idx++}`); params.push(String(body.full_name).trim()); }
    if (body.phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(String(body.phone).trim() || null); }
    if (body.role_id !== undefined) { sets.push(`role_id = $${idx++}`); params.push(Number(body.role_id)); }
    if (body.department_id !== undefined) { sets.push(`department_id = $${idx++}`); params.push(body.department_id ? Number(body.department_id) : null); }
    if (body.status !== undefined) { sets.push(`status = $${idx++}`); params.push(body.status); }
    if (body.preferred_lang !== undefined) { sets.push(`preferred_lang = $${idx++}`); params.push(body.preferred_lang); }

    if (sets.length === 0) return res.status(400).json({ ok: false, message: 'Không có dữ liệu cập nhật' });

    params.push(userId);
    const scope = req.isSuperAdmin ? '' : ` AND company_id = $${idx + 1}`;
    if (!req.isSuperAdmin) params.push(req.companyId);
    const result = await query(
      `UPDATE sys_users
          SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${idx}${scope}
        RETURNING id, username, email, full_name, phone, company_id, role_id,
                  department_id, status, preferred_lang, is_super_admin`,
      params,
    );
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy người dùng trong tenant.' });
    // is_super_admin is deliberately not included in the writable fields.
    res.json({ ok: true, data: result.rows[0], message: 'Đã cập nhật thông tin người dùng' });
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      const constraint = uniqueViolationConstraint(error);
      const field = constraint.includes('email') ? 'email' : constraint.includes('username') ? 'username' : 'identifier';
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field, message: field === 'email' ? 'Email người dùng đã tồn tại.' : 'Tên đăng nhập đã tồn tại.' });
    }
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.delete('/users/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ ok: false, message: 'ID người dùng không hợp lệ.' });
  }
  try {
    const params: any[] = [userId];
    const scope = req.isSuperAdmin ? '' : ' AND company_id = $2';
    if (!req.isSuperAdmin) params.push(req.companyId);
    const selfGuard = req.userId ? ` AND id <> $${params.length + 1}` : '';
    if (req.userId) params.push(req.userId);
    const result = await query(`DELETE FROM sys_users WHERE id = $1${scope}${selfGuard} RETURNING id`, params);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy người dùng trong tenant hoặc không thể tự xóa.' });
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
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
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
    res.setHeader('Cache-Control', 'private, max-age=60');
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

// Paginated + filtered dictionary list. The admin UI must not pull the whole
// sys_translations table: clients send ?search=&category=&status=&sort=&order=
// &page=&pageSize= and receive only one page plus global category facets and
// completion stats. Falls back on the client to the bundled i18n dictionary
// when unavailable.
//
// Column sorting is server-side on purpose: ORDER BY runs BEFORE LIMIT/OFFSET,
// so the whole dictionary is ordered, not just the current page.
let cachedViCollation: string | null | undefined;
/** Resolve a Vietnamese ICU collation (e.g. "vi-x-icu") once per process so
 *  sorting vi_text follows the real Vietnamese alphabet. Returns null on
 *  databases without ICU collations — sorting then uses the DB default locale. */
const resolveViCollation = async (): Promise<string | null> => {
  if (cachedViCollation !== undefined) return cachedViCollation;
  try {
    const res = await query(
      `SELECT collname FROM pg_collation
       WHERE collname IN ('vi-x-icu', 'vi-VN-x-icu')
          OR (collprovider = 'i' AND collcollate IN ('vi-VN', 'vi'))
       LIMIT 1`,
    );
    const name = res.rows?.[0]?.collname;
    cachedViCollation = typeof name === 'string' && /^[A-Za-z0-9-]+$/.test(name) ? name : null;
  } catch {
    cachedViCollation = null;
  }
  return cachedViCollation;
};

saasRouter.get('/translations', async (req: Request, res: Response) => {
  const listQuery = parseTranslationsListQuery(req.query);
  try {
    const { whereSql, params } = buildTranslationsSqlFilters(listQuery);
    const orderBy = buildTranslationsOrderBy(listQuery, await resolveViCollation());
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const offset = (listQuery.page - 1) * listQuery.pageSize;

    const [rowsRes, countRes, facetsRes, statsRes] = await Promise.all([
      query(
        `SELECT key_name as key,
                COALESCE(NULLIF(TRIM(category), ''), 'common') as category,
                vi_text as vi,
                en_text as en
         FROM sys_translations ${whereSql}
         ${orderBy}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        [...params, listQuery.pageSize, offset],
      ),
      query(
        `SELECT COUNT(*)::int as total FROM sys_translations ${whereSql}`,
        params,
      ),
      query(
        `SELECT COALESCE(NULLIF(TRIM(category), ''), 'common') as id, COUNT(*)::int as count
         FROM sys_translations WHERE ${SQL_META_KEY_FILTER}
         GROUP BY COALESCE(NULLIF(TRIM(category), ''), 'common')
         ORDER BY count DESC, id ASC`,
      ),
      query(
        `SELECT COUNT(*)::int as total,
                SUM(CASE WHEN COALESCE(TRIM(vi_text), '') <> '' THEN 1 ELSE 0 END)::int as "viCompleted",
                SUM(CASE WHEN COALESCE(TRIM(en_text), '') <> '' THEN 1 ELSE 0 END)::int as "enCompleted"
         FROM sys_translations WHERE ${SQL_META_KEY_FILTER}`,
      ),
    ]);

    const rows = rowsRes.rows || [];
    const total = Number(countRes.rows?.[0]?.total) || 0;
    const stats = statsRes.rows?.[0] || { total: 0, viCompleted: 0, enCompleted: 0 };

    res.json({
      ok: true,
      data: {
        items: rows,
        page: listQuery.page,
        pageSize: listQuery.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / listQuery.pageSize)),
        categories: facetsRes.rows || [],
        stats: {
          total: Number(stats.total) || 0,
          viCompleted: Number(stats.viCompleted) || 0,
          enCompleted: Number(stats.enCompleted) || 0,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Full dump — kept for export/backup flows; the UI list uses GET /translations.
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
saasRouter.get('/menus', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const lang = getLang(req);
  try {
    const result = await query(
      `SELECT id, code, path_url AS path, icon_name AS icon, parent_id, sort_order,
              CASE WHEN $1 = 'en' THEN title_en ELSE title_vi END AS title
         FROM sys_menus
        WHERE is_active = TRUE
        ORDER BY sort_order ASC`,
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
saasRouter.get('/roles', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const lang = getLang(req);
  try {
    const result = await query(
      `SELECT r.id, r.code,
              CASE WHEN $1 = 'en' THEN r.name_en ELSE r.name_vi END AS name,
              r.description AS description,
              r.is_system,
              COALESCE(array_agg(DISTINCT srp.permission_code) FILTER (WHERE srp.permission_code IS NOT NULL), '{}') AS permissions
         FROM sys_roles r
         LEFT JOIN sys_role_permissions srp ON srp.role_id = r.id
        GROUP BY r.id
        ORDER BY r.id ASC`,
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
       LEFT JOIN categories c ON p.category_id = c.id AND c.company_id = p.company_id
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
saasRouter.get('/categories', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const lang = getLang(req);
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT c.id, c.code, c.parent_id, c.is_active, c.name_vi, c.name_en,
              COUNT(p.id)::int as product_count,
              CASE WHEN $1 = 'en' THEN c.name_en ELSE c.name_vi END as name,
              ''::text as description
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.company_id = c.company_id
       WHERE ($2::int IS NULL OR c.company_id = $2)
       GROUP BY c.id, c.code, c.parent_id, c.is_active, c.name_vi, c.name_en
       ORDER BY c.id ASC`,
      [lang, companyId]
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});


saasRouter.post('/categories', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const code = String(body.code || '').trim().toUpperCase();
  const nameVi = String(body.name_vi || body.name || '').trim();
  if (!companyId || !code || !nameVi) return res.status(400).json({ ok: false, message: 'Mã và tên danh mục là bắt buộc.' });
  try {
    const result = await query(
      `INSERT INTO categories (company_id, code, name_vi, name_en, sort_order, is_active)
       VALUES ($1, $2, $3, $4, 0, TRUE) RETURNING *`,
      [companyId, code, nameVi, String(body.name_en || nameVi).trim()],
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Đã tạo danh mục.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, message: 'Mã danh mục đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.put('/categories/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  const body = req.body || {};
  const values: any[] = [];
  const sets: string[] = [];
  if (body.code !== undefined) { values.push(String(body.code).trim().toUpperCase()); sets.push(`code = $${values.length}`); }
  if (body.name_vi !== undefined || body.name !== undefined) { values.push(String(body.name_vi || body.name).trim()); sets.push(`name_vi = $${values.length}`); }
  if (body.name_en !== undefined) { values.push(String(body.name_en).trim()); sets.push(`name_en = $${values.length}`); }
  if (body.is_active !== undefined) { values.push(Boolean(body.is_active)); sets.push(`is_active = $${values.length}`); }
  if (!sets.length) return res.status(400).json({ ok: false, message: 'Không có dữ liệu cập nhật.' });
  values.push(Number(req.params.id));
  const idParam = values.length;
  let scope = '';
  if (companyId != null) { values.push(companyId); scope = ` AND company_id = $${values.length}`; }
  try {
    const result = await query(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${idParam}${scope} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy danh mục trong tenant.' });
    res.json({ ok: true, data: result.rows[0], message: 'Đã cập nhật danh mục.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, message: 'Mã danh mục đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.delete('/categories/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  try {
    const result = await query(`DELETE FROM categories WHERE id = $1${companyId == null ? '' : ' AND company_id = $2'} RETURNING id`, companyId == null ? [Number(req.params.id)] : [Number(req.params.id), companyId]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy danh mục trong tenant.' });
    res.json({ ok: true, message: 'Đã xóa danh mục.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
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
    const result = await query(
      `SELECT s.*,
              GREATEST(0, COALESCE((SELECT SUM(po.total_amount) FROM purchase_orders po WHERE po.supplier_id = s.id AND po.company_id = s.company_id AND po.status NOT IN ('HUY', 'Hủy')), 0) -
                           COALESCE((SELECT SUM(rp.amount) FROM receipts_payments rp WHERE rp.partner_id = s.id AND rp.company_id = s.company_id AND rp.partner_type = 'NHA_CUNG_CAP' AND rp.voucher_type = 'CHI'), 0)) AS payable_debt
         FROM suppliers s
        WHERE ($1::int IS NULL OR s.company_id = $1)
        ORDER BY s.id DESC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});


saasRouter.post('/suppliers', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  if (!companyId || !name) return res.status(400).json({ ok: false, message: 'Tên nhà cung cấp là bắt buộc.' });
  try {
    const result = await query(
      `INSERT INTO suppliers (company_id, code, name, tax_code, phone, email, address, bank_account, bank_name, payment_terms, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
       RETURNING *`,
      [companyId, String(body.code || `NCC-${randomBytes(4).toString('hex').toUpperCase()}`).trim().toUpperCase(), name, normalizeTaxCode(body.tax_code) || null, String(body.phone || '').trim() || null, body.email ? normalizeEmail(body.email) : null, String(body.address || '').trim() || null, body.bank_account || null, body.bank_name || null, body.payment_terms || null],
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Đã tạo nhà cung cấp.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', message: 'Mã, email hoặc mã số thuế nhà cung cấp đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.put('/suppliers/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  const id = Number(req.params.id);
  const body = req.body || {};
  const values: any[] = [];
  const sets: string[] = [];
  const fields: Array<[string, string, (value: any) => any]> = [
    ['name', 'name', (value) => String(value).trim()],
    ['phone', 'phone', (value) => String(value).trim() || null],
    ['email', 'email', (value) => normalizeEmail(value) || null],
    ['address', 'address', (value) => String(value).trim() || null],
    ['tax_code', 'tax_code', (value) => normalizeTaxCode(value) || null],
    ['bank_account', 'bank_account', (value) => String(value).trim() || null],
    ['bank_name', 'bank_name', (value) => String(value).trim() || null],
  ];
  for (const [input, column, transform] of fields) if (body[input] !== undefined) { values.push(transform(body[input])); sets.push(`${column} = $${values.length}`); }
  if (!sets.length) return res.status(400).json({ ok: false, message: 'Không có dữ liệu cập nhật.' });
  values.push(id);
  const idParam = values.length;
  let scope = '';
  if (companyId != null) { values.push(companyId); scope = ` AND company_id = $${values.length}`; }
  try {
    const result = await query(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = $${idParam}${scope} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy nhà cung cấp trong tenant.' });
    res.json({ ok: true, data: result.rows[0], message: 'Đã cập nhật nhà cung cấp.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, message: 'Email hoặc mã số thuế nhà cung cấp đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.delete('/suppliers/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  try {
    const result = await query(`DELETE FROM suppliers WHERE id = $1${companyId == null ? '' : ' AND company_id = $2'} RETURNING id`, companyId == null ? [Number(req.params.id)] : [Number(req.params.id), companyId]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy nhà cung cấp trong tenant.' });
    res.json({ ok: true, message: 'Đã xóa nhà cung cấp.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/quotations', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT q.id, q.code, q.quote_date AS date, q.expiry_date AS valid_until,
              q.customer_id, c.name AS customer_name, c.phone AS customer_phone,
              c.address AS customer_address, q.subtotal AS amount,
              q.tax_amount AS vat_amount, q.total_amount,
              q.status, q.created_at,
              COALESCE(json_agg(json_build_object(
                'id', qi.id, 'product_id', qi.product_id, 'product_name', p.name_vi,
                'sku', p.sku, 'unit', COALESCE(u.name_vi, ''), 'quantity', qi.quantity,
                'unit_price', qi.unit_price
              ) ORDER BY qi.id) FILTER (WHERE qi.id IS NOT NULL), '[]'::json) AS items
         FROM quotations q
         LEFT JOIN customers c ON c.id = q.customer_id AND c.company_id = q.company_id
         LEFT JOIN quotation_items qi ON qi.quotation_id = q.id AND qi.company_id = q.company_id
         LEFT JOIN products p ON p.id = qi.product_id AND p.company_id = q.company_id
         LEFT JOIN uom u ON u.id = p.uom_id
        WHERE ($1::int IS NULL OR q.company_id = $1)
        GROUP BY q.id, c.name, c.phone, c.address
        ORDER BY q.id DESC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.post('/quotations', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const customerId = Number(body.customer_id);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!companyId || !Number.isInteger(customerId) || customerId <= 0 || items.length === 0) return res.status(400).json({ ok: false, message: 'Báo giá phải có khách hàng và sản phẩm.' });
  try {
    const customer = await query('SELECT id FROM customers WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [customerId, companyId]);
    if (!customer.rows[0]) return res.status(404).json({ ok: false, message: 'Khách hàng không thuộc tenant hiện tại.' });
    const validated: Array<{ productId: number; quantity: number; unitPrice: number }> = [];
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unit_price);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) return res.status(400).json({ ok: false, message: 'Dòng báo giá không hợp lệ.' });
      const product = await query('SELECT id FROM products WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [productId, companyId]);
      if (!product.rows[0]) return res.status(404).json({ ok: false, message: 'Sản phẩm không thuộc tenant hiện tại.' });
      validated.push({ productId, quantity, unitPrice });
    }
    const subtotal = validated.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vatRate = Number(body.vat_rate) || 0;
    const taxAmount = Math.round(subtotal * vatRate / 100);
    const result = await query(
      `INSERT INTO quotations (company_id, code, customer_id, quote_date, expiry_date, subtotal, tax_amount, total_amount, status, created_by)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), COALESCE($5::date, CURRENT_DATE + 15), $6, $7, $8, $9, $10)
       RETURNING id, code`,
      [companyId, String(body.code || `BG-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`), customerId, body.date || null, body.valid_until || null, subtotal, taxAmount, subtotal + taxAmount, body.status || 'DA_GUI', req.userId || null],
    );
    const quotationId = Number(result.rows[0].id);
    for (const item of validated) await query('INSERT INTO quotation_items (company_id, quotation_id, product_id, quantity, unit_price, vat_rate, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)', [companyId, quotationId, item.productId, item.quantity, item.unitPrice, vatRate, item.quantity * item.unitPrice]);
    res.status(201).json({ ok: true, data: { id: quotationId, code: result.rows[0].code }, message: 'Đã lưu báo giá.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

// 7. SYSTEM TRANSLATION MANAGEMENT
// ==========================================
// NOTE: translation CRUD routes (GET /translations paginated, GET
// /translations/all, POST /translations, DELETE /translations/:key) are
// registered earlier in this file against the real sys_translations schema
// (key_name / category / vi_text / en_text per schema.sql). A second,
// unreachable copy used to live here — built for a different schema
// (lang_code / translation_key / translation_value) — and was removed:
// Express only ever invokes the first matching route, so re-registering
// duplicate paths is dead code that invites schema drift.

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



saasRouter.put('/quotations/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  const id = Number(req.params.id);
  const body = req.body || {};
  const targetCompanyId = companyId ?? Number(body.company_id || req.companyId);
  const customerId = Number(body.customer_id);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!Number.isInteger(id) || !Number.isInteger(customerId) || customerId <= 0 || !items.length) return res.status(400).json({ ok: false, message: 'Báo giá không hợp lệ.' });
  try {
    const existing = await query(`SELECT id FROM quotations WHERE id = $1${companyId == null ? '' : ' AND company_id = $2'} LIMIT 1`, companyId == null ? [id] : [id, companyId]);
    if (!existing.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy báo giá trong tenant.' });
    if (!targetCompanyId) return res.status(400).json({ ok: false, message: 'Thiếu tenant đích cho báo giá.' });
    const customer = await query('SELECT id FROM customers WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [customerId, targetCompanyId]);
    if (!customer.rows[0]) return res.status(404).json({ ok: false, message: 'Khách hàng không thuộc tenant hiện tại.' });
    const validated = items.map((item: any) => ({ productId: Number(item.product_id), quantity: Number(item.quantity), unitPrice: Number(item.unit_price) }));
    if (validated.some((item) => !Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0)) return res.status(400).json({ ok: false, message: 'Dòng báo giá không hợp lệ.' });
    for (const item of validated) {
      const product = await query('SELECT id FROM products WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [item.productId, targetCompanyId]);
      if (!product.rows[0]) return res.status(404).json({ ok: false, message: 'Sản phẩm không thuộc tenant hiện tại.' });
    }
    const subtotal = validated.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const vatRate = Number(body.vat_rate) || 0;
    const taxAmount = Math.round(subtotal * vatRate / 100);
    const update = await query(`UPDATE quotations SET customer_id = $1, quote_date = COALESCE($2::date, quote_date), expiry_date = COALESCE($3::date, expiry_date), subtotal = $4, tax_amount = $5, total_amount = $6, status = $7 WHERE id = $8${companyId == null ? '' : ' AND company_id = $9'} RETURNING id`, companyId == null ? [customerId, body.date || null, body.valid_until || null, subtotal, taxAmount, subtotal + taxAmount, body.status || 'DA_GUI', id] : [customerId, body.date || null, body.valid_until || null, subtotal, taxAmount, subtotal + taxAmount, body.status || 'DA_GUI', id, companyId]);
    await query(`DELETE FROM quotation_items WHERE quotation_id = $1${companyId == null ? '' : ' AND company_id = $2'}`, companyId == null ? [id] : [id, companyId]);
    for (const item of validated) await query('INSERT INTO quotation_items (company_id, quotation_id, product_id, quantity, unit_price, vat_rate, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)', [targetCompanyId, id, item.productId, item.quantity, item.unitPrice, vatRate, item.quantity * item.unitPrice]);
    res.json({ ok: true, data: { id: Number(update.rows[0].id) }, message: 'Đã cập nhật báo giá.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.delete('/quotations/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  try {
    const result = await query(`DELETE FROM quotations WHERE id = $1${companyId == null ? '' : ' AND company_id = $2'} RETURNING id`, companyId == null ? [Number(req.params.id)] : [Number(req.params.id), companyId]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy báo giá trong tenant.' });
    res.json({ ok: true, message: 'Đã xóa báo giá.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.post('/crm/leads', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const contactName = String(body.contact_name || '').trim();
  const companyName = String(body.company_name || '').trim();
  const phone = String(body.phone || '').trim();
  if (!companyId || !contactName || !phone) return res.status(400).json({ ok: false, message: 'Tên người liên hệ và số điện thoại là bắt buộc.' });
  const statusMap: Record<string, string> = { NEW: 'MOI', CONTACTED: 'LIEN_HE', QUALIFIED: 'TIEM_NANG', PROPOSAL: 'TIEM_NANG', WON: 'CHUYEN_DOI', LOST: 'HUY' };
  const sourceMap: Record<string, string> = { Website: 'WEBSITE', Event: 'EVENT', Referral: 'REFERRAL', Call: 'CALL' };
  try {
    const result = await query(
      `INSERT INTO crm_leads (company_id, code, company_name, contact_name, phone, email, source, estimated_revenue, status, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [companyId, `LEAD-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`, companyName || contactName, contactName, phone, String(body.email || '').trim() || null, sourceMap[body.source] || 'WEBSITE', Number(body.estimated_revenue || body.estimated_value) || 0, statusMap[body.status] || 'MOI', req.userId || null],
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Đã tạo Lead CRM.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
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
saasRouter.get('/warehouses', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT w.id, w.code, w.name_vi, w.name_en, w.address, w.manager_name,
              w.phone, w.capacity, w.is_active,
              COUNT(DISTINCT sb.product_id)::int AS stock_count
         FROM warehouses w
         LEFT JOIN stock_balances sb ON sb.warehouse_id = w.id AND sb.company_id = w.company_id AND sb.quantity > 0
        WHERE ($1::int IS NULL OR w.company_id = $1)
        GROUP BY w.id
        ORDER BY w.id ASC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.post('/warehouses', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const code = String(body.code || '').trim().toUpperCase();
  const name = String(body.name || body.name_vi || '').trim();
  if (!companyId || !code || !name) return res.status(400).json({ ok: false, message: 'Mã và tên kho là bắt buộc.' });
  try {
    const result = await query(
      `INSERT INTO warehouses (company_id, code, name_vi, name_en, address, manager_name, phone, capacity, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING *`,
      [companyId, code, name, String(body.name_en || name), String(body.address || body.location || '').trim() || null, String(body.manager_name || body.manager || '').trim() || null, String(body.phone || '').trim() || null, String(body.capacity || '').trim() || null],
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Đã tạo kho.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field: 'code', message: 'Mã kho đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.put('/warehouses/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const id = Number(req.params.id);
  const companyId = req.isSuperAdmin ? null : req.companyId;
  const body = req.body || {};
  const sets: string[] = [];
  const values: any[] = [];
  const fields: Array<[string, string, (value: any) => any]> = [
    ['code', 'code', (value) => String(value).trim().toUpperCase()],
    ['name', 'name_vi', (value) => String(value).trim()],
    ['name_vi', 'name_vi', (value) => String(value).trim()],
    ['name_en', 'name_en', (value) => String(value).trim()],
    ['address', 'address', (value) => String(value).trim() || null],
    ['location', 'address', (value) => String(value).trim() || null],
    ['manager', 'manager_name', (value) => String(value).trim() || null],
    ['manager_name', 'manager_name', (value) => String(value).trim() || null],
    ['phone', 'phone', (value) => String(value).trim() || null],
    ['capacity', 'capacity', (value) => String(value).trim() || null],
    ['is_active', 'is_active', (value) => Boolean(value)],
  ];
  const updatedColumns = new Set<string>();
  for (const [input, column, transform] of fields) {
    if (body[input] !== undefined && !updatedColumns.has(column)) {
      updatedColumns.add(column);
      values.push(transform(body[input]));
      sets.push(`${column} = $${values.length}`);
    }
  }
  if (!sets.length || !Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false, message: 'Dữ liệu kho không hợp lệ.' });
  const idParam = values.length + 1;
  values.push(id);
  let scope = '';
  if (companyId != null) { values.push(companyId); scope = ` AND company_id = $${values.length}`; }
  try {
    const result = await query(`UPDATE warehouses SET ${sets.join(', ')} WHERE id = $${idParam}${scope} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy kho trong tenant.' });
    res.json({ ok: true, data: result.rows[0], message: 'Đã cập nhật kho.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, message: 'Mã kho đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.delete('/warehouses/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const id = Number(req.params.id);
  const companyId = req.isSuperAdmin ? null : req.companyId;
  try {
    const result = await query(`DELETE FROM warehouses WHERE id = $1${companyId == null ? '' : ' AND company_id = $2'} RETURNING id`, companyId == null ? [id] : [id, companyId]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy kho trong tenant.' });
    res.json({ ok: true, message: 'Đã xóa kho.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/warehouses/opening-stock', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT sb.id, p.sku, p.name_vi AS product_name, w.id AS warehouse_id,
              w.name_vi AS warehouse_name, sb.quantity AS opening_quantity,
              sb.quantity * p.cost_price AS opening_value,
              u.name_vi AS unit
         FROM stock_balances sb
         JOIN products p ON p.id = sb.product_id AND p.company_id = sb.company_id
         JOIN warehouses w ON w.id = sb.warehouse_id AND w.company_id = sb.company_id
         LEFT JOIN uom u ON u.id = p.uom_id
        WHERE ($1::int IS NULL OR sb.company_id = $1)
        ORDER BY sb.id DESC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.delete('/warehouses/opening-stock/:id', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  try {
    const result = await query(`DELETE FROM stock_balances WHERE id = $1${companyId == null ? '' : ' AND company_id = $2'} RETURNING product_id`, companyId == null ? [Number(req.params.id)] : [Number(req.params.id), companyId]);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy số dư tồn đầu kỳ.' });
    if (companyId != null) await query('UPDATE products SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = $1 AND company_id = $2), 0) WHERE id = $1 AND company_id = $2', [result.rows[0].product_id, companyId]);
    res.json({ ok: true, message: 'Đã xóa tồn đầu kỳ.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.post('/warehouses/opening-stock', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const warehouseId = Number(body.warehouse_id);
  const sku = String(body.sku || '').trim();
  const quantity = Number(body.opening_quantity ?? body.openingQuantity);
  const value = Number(body.opening_value ?? body.openingValue) || 0;
  if (!companyId || !Number.isInteger(warehouseId) || warehouseId <= 0 || !sku || !Number.isFinite(quantity) || quantity < 0) return res.status(400).json({ ok: false, message: 'Thông tin tồn đầu kỳ không hợp lệ.' });
  try {
    const product = await query('SELECT id, cost_price FROM products WHERE company_id = $1 AND (sku = $2 OR code = $2) LIMIT 1', [companyId, sku]);
    const warehouse = await query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 LIMIT 1', [warehouseId, companyId]);
    if (!product.rows[0] || !warehouse.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy sản phẩm hoặc kho trong tenant.' });
    const productId = Number(product.rows[0].id);
    const cost = value > 0 && quantity > 0 ? value / quantity : Number(product.rows[0].cost_price) || 0;
    const existing = await query('SELECT id FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2 AND batch_id IS NULL AND company_id = $3 LIMIT 1', [warehouseId, productId, companyId]);
    if (existing.rows[0]) await query('UPDATE stock_balances SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3', [quantity, existing.rows[0].id, companyId]);
    else await query('INSERT INTO stock_balances (warehouse_id, product_id, batch_id, quantity, company_id) VALUES ($1, $2, NULL, $3, $4)', [warehouseId, productId, quantity, companyId]);
    await query('UPDATE products SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = $1 AND company_id = $2), 0), cost_price = CASE WHEN $3 > 0 THEN $3 ELSE cost_price END WHERE id = $1 AND company_id = $2', [productId, companyId, cost]);
    res.status(201).json({ ok: true, message: 'Đã cập nhật tồn đầu kỳ.' });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/stocktaking', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT ss.id, ss.code, ss.stocktake_date AS date,
              w.name_vi AS warehouse_name, COALESCE(u.full_name, 'Hệ thống') AS creator,
              COUNT(si.id)::int AS total_products,
              COALESCE(SUM(si.discrepancy), 0) AS total_diff_qty,
              COALESCE(SUM(si.discrepancy * p.cost_price), 0) AS total_diff_value,
              ss.status, ss.notes AS note
         FROM stocktaking_sessions ss
         JOIN warehouses w ON w.id = ss.warehouse_id AND w.company_id = ss.company_id
         LEFT JOIN sys_users u ON u.id = ss.created_by
         LEFT JOIN stocktaking_items si ON si.session_id = ss.id AND si.company_id = ss.company_id
         LEFT JOIN products p ON p.id = si.product_id AND p.company_id = ss.company_id
        WHERE ($1::int IS NULL OR ss.company_id = $1)
        GROUP BY ss.id, w.name_vi, u.full_name
        ORDER BY ss.id DESC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.get('/stocktaking/products', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.query.company_id || req.companyId) : req.companyId;
  const warehouseId = Number(req.query.warehouse_id);
  if (!companyId || !Number.isInteger(warehouseId)) return res.status(400).json({ ok: false, message: 'Kho kiểm kê không hợp lệ.' });
  try {
    const result = await query(
      `SELECT p.id AS product_id, p.sku, p.name_vi AS product_name,
              COALESCE(u.name_vi, '') AS unit, COALESCE(sb.quantity, 0) AS book_qty,
              COALESCE(sb.quantity, 0) AS actual_qty, p.cost_price AS unit_price
         FROM products p
         LEFT JOIN uom u ON u.id = p.uom_id
         LEFT JOIN stock_balances sb ON sb.product_id = p.id AND sb.warehouse_id = $2 AND sb.company_id = $1 AND sb.batch_id IS NULL
        WHERE p.company_id = $1 AND p.is_active = TRUE
        ORDER BY p.sku`,
      [companyId, warehouseId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) { res.status(500).json({ ok: false, message: error.message }); }
});

saasRouter.post('/stocktaking', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const warehouseId = Number(req.body?.warehouse_id);
  const inputItems = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!companyId || !Number.isInteger(warehouseId) || inputItems.length === 0) return res.status(400).json({ ok: false, message: 'Phiếu kiểm kê phải có kho và ít nhất một sản phẩm.' });
  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const warehouse = await dbClient.query('SELECT id FROM warehouses WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1', [warehouseId, companyId]);
    if (!warehouse.rows[0]) throw new Error('Kho không thuộc tenant hiện tại.');
    const code = `KK-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const session = await dbClient.query(
      `INSERT INTO stocktaking_sessions (company_id, code, warehouse_id, stocktake_date, created_by, status, notes)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, 'HOAN_THANH', $5)
       RETURNING id`,
      [companyId, code, req.userId || null, String(req.body?.notes || '').trim() || null],
    );
    const sessionId = Number(session.rows[0].id);
    for (const item of inputItems) {
      const productId = Number(item.product_id);
      const actual = Number(item.actual_quantity ?? item.actualQty);
      if (!Number.isInteger(productId) || !Number.isFinite(actual) || actual < 0) throw new Error('Sản phẩm kiểm kê không hợp lệ.');
      const balance = await dbClient.query(
        `SELECT sb.id, sb.quantity, p.cost_price
           FROM products p
           LEFT JOIN stock_balances sb ON sb.product_id = p.id AND sb.warehouse_id = $2 AND sb.company_id = $1 AND sb.batch_id IS NULL
          WHERE p.id = $3 AND p.company_id = $1
          LIMIT 1`,
        [companyId, warehouseId, productId],
      );
      if (!balance.rows[0]) throw new Error('Sản phẩm không thuộc tenant hiện tại.');
      const book = Number(balance.rows[0].quantity) || 0;
      await dbClient.query(
        `INSERT INTO stocktaking_items (company_id, session_id, product_id, book_quantity, actual_quantity, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [companyId, sessionId, productId, book, actual, String(item.reason || '').trim() || null],
      );
      if (balance.rows[0].id) await dbClient.query('UPDATE stock_balances SET quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND company_id = $3', [actual, balance.rows[0].id, companyId]);
      else await dbClient.query('INSERT INTO stock_balances (company_id, warehouse_id, product_id, batch_id, quantity) VALUES ($1, $2, $3, NULL, $4)', [companyId, warehouseId, productId, actual]);
      await dbClient.query('UPDATE products SET stock_quantity = COALESCE((SELECT SUM(quantity) FROM stock_balances WHERE product_id = $1 AND company_id = $2), 0) WHERE id = $1 AND company_id = $2', [productId, companyId]);
    }
    await dbClient.query('COMMIT');
    res.status(201).json({ ok: true, data: { id: sessionId, code }, message: 'Đã lưu phiếu kiểm kê và cập nhật tồn kho.' });
  } catch (error: any) {
    await dbClient.query('ROLLBACK').catch(() => undefined);
    res.status(400).json({ ok: false, message: error.message });
  } finally { dbClient.release(); }
});

saasRouter.post('/receipts-payments', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const body = req.body || {};
  const amount = Number(body.amount);
  const partnerId = Number(body.partner_id);
  const isCustomer = body.partner_type === 'KHACH_HANG';
  const voucherType = isCustomer ? 'THU' : body.partner_type === 'NHA_CUNG_CAP' ? 'CHI' : '';
  if (!companyId || !Number.isInteger(partnerId) || partnerId <= 0 || !Number.isFinite(amount) || amount <= 0 || !voucherType) {
    return res.status(400).json({ ok: false, message: 'Phiếu thu/chi công nợ không hợp lệ.' });
  }
  try {
    const partnerTable = isCustomer ? 'customers' : 'suppliers';
    const partner = await query(`SELECT id FROM ${partnerTable} WHERE id = $1 AND company_id = $2 AND is_active = TRUE LIMIT 1`, [partnerId, companyId]);
    if (!partner.rows[0]) return res.status(404).json({ ok: false, message: 'Đối tác không thuộc tenant hiện tại.' });
    const result = await query(
      `INSERT INTO receipts_payments (company_id, code, voucher_type, partner_type, partner_id, amount, payment_method, payment_date, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, $8, $9)
       RETURNING id, code, amount`,
      [companyId, `${voucherType}-${new Date().getFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`, voucherType, body.partner_type, partnerId, amount, body.payment_method === 'cash' ? 'TIEN_MAT' : 'CHUYEN_KHOAN', String(body.reason || '').trim() || null, req.userId || null],
    );
    res.status(201).json({ ok: true, data: result.rows[0], message: 'Đã ghi nhận phiếu thu/chi công nợ.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.get('/assets', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  try {
    const companyId = req.isSuperAdmin ? null : req.companyId;
    const result = await query(
      `SELECT fa.id, fa.code AS asset_code, fa.name_vi AS asset_name,
              COALESCE(fa.category_code, '') AS category_code,
              fa.original_cost, fa.depreciation_months AS useful_life_months,
              ROUND(fa.original_cost / NULLIF(fa.depreciation_months, 0)) AS monthly_depreciation,
              COALESCE(fa.accumulated_depreciation, 0) AS accumulated_depreciation,
              GREATEST(0, fa.original_cost - COALESCE(fa.accumulated_depreciation, 0)) AS net_book_value,
              CASE WHEN GREATEST(0, fa.original_cost - COALESCE(fa.accumulated_depreciation, 0)) = 0
                   THEN 'FULLY_DEPRECIATED' ELSE 'IN_USE' END AS status,
              fa.purchase_date
         FROM fixed_assets fa
        WHERE ($1::int IS NULL OR fa.company_id = $1)
        ORDER BY fa.id DESC`,
      [companyId],
    );
    res.json({ ok: true, data: result.rows });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/assets', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? Number(req.body?.company_id || req.companyId) : req.companyId;
  const name = String(req.body?.asset_name || req.body?.name_vi || '').trim();
  const category = String(req.body?.category_code || '').trim();
  const originalCost = Number(req.body?.original_cost);
  const usefulLife = Number(req.body?.useful_life_months);
  if (!companyId || !name || !Number.isFinite(originalCost) || originalCost <= 0 || !Number.isInteger(usefulLife) || usefulLife <= 0) {
    return res.status(400).json({ ok: false, message: 'Thông tin tài sản cố định không hợp lệ.' });
  }
  try {
    const code = `TSCD-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`;
    const result = await query(
      `INSERT INTO fixed_assets (
         company_id, code, name_vi, name_en, category_code, original_cost,
         depreciation_months, purchase_date, start_depreciation_date, current_value
       )
       VALUES ($1, $2, $3, $3, $4, $5, $6, CURRENT_DATE, CURRENT_DATE, $5)
       RETURNING id`,
      [companyId, code, name, category, originalCost, usefulLife],
    );
    res.status(201).json({ ok: true, data: { id: Number(result.rows[0].id), asset_code: code }, message: 'Đã ghi nhận tài sản cố định.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.post('/assets/depreciate', tenantMiddleware, async (req: TenantRequest, res: Response) => {
  const companyId = req.isSuperAdmin ? null : req.companyId;
  try {
    const result = await query(
      `UPDATE fixed_assets
          SET accumulated_depreciation = LEAST(original_cost, COALESCE(accumulated_depreciation, 0) + ROUND(original_cost / NULLIF(depreciation_months, 0))),
              current_value = GREATEST(0, original_cost - LEAST(original_cost, COALESCE(accumulated_depreciation, 0) + ROUND(original_cost / NULLIF(depreciation_months, 0))))
        WHERE ($1::int IS NULL OR company_id = $1)
        RETURNING id`,
      [companyId],
    );
    res.json({ ok: true, data: { updated: result.rowCount || 0 }, message: 'Đã chạy khấu hao tài sản theo dữ liệu thực.' });
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
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
      `SELECT c.id, c.code, c.name_vi, c.name_en, c.tax_code, c.email, c.phone,
              c.address, c.slug, c.subdomain, c.plan_type, c.subscription_status,
              c.trial_ends_at, c.settings, c.max_users, c.max_warehouses,
              c.is_paused, c.onboarding_completed, c.created_at,
              tw.workspace_slug, tw.workspace_name_vi, tw.workspace_name_en,
              tw.webshop_slug, tw.webshop_name_vi, tw.webshop_name_en
         FROM companies c
         LEFT JOIN tenant_workspaces tw ON tw.company_id = c.id
        WHERE c.id = $1`,
      [req.companyId],
    );
    const row = result.rows[0];
    res.json({
      ok: true,
      data: row ? {
        ...row,
        workspace: row.workspace_slug ? { slug: row.workspace_slug, name_vi: row.workspace_name_vi, name_en: row.workspace_name_en, url: '/saas/dashboard' } : null,
        webshop: row.webshop_slug ? { slug: row.webshop_slug, name_vi: row.webshop_name_vi, name_en: row.webshop_name_en, url: `/shop/${row.webshop_slug}` } : null,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.patch('/tenants/me', tenantMiddleware, requireTenantAdmin, async (req: TenantRequest, res: Response) => {
  const companyId = req.companyId;
  const body = req.body || {};
  if (!companyId) return res.status(403).json({ ok: false, message: 'Không xác định được tenant.' });
  const values: any[] = [];
  const sets: string[] = [];
  const taxCode = body.tax_code === undefined ? '' : normalizeTaxCode(body.tax_code);
  const companyEmail = body.email === undefined ? '' : normalizeEmail(body.email);
  const fields: Array<[string, string, any]> = [
    ['name_vi', 'name_vi', (value: any) => String(value).trim()],
    ['name_en', 'name_en', (value: any) => String(value).trim() || null],
    ['tax_code', 'tax_code', () => taxCode],
    ['email', 'email', () => companyEmail || null],
    ['phone', 'phone', (value: any) => String(value).trim() || null],
    ['address', 'address', (value: any) => String(value).trim() || null],
    ['website', 'website', (value: any) => String(value).trim() || null],
  ];
  for (const [input, column, transform] of fields) if (body[input] !== undefined) {
    values.push(transform(body[input]));
    sets.push(`${column} = $${values.length}`);
  }
  if (body.settings !== undefined) {
    values.push(JSON.stringify(body.settings || {}));
    sets.push(`settings = $${values.length}::jsonb`);
  }
  if (body.tax_code !== undefined && !taxCode) return res.status(400).json({ ok: false, message: 'Mã số thuế không được để trống.' });
  if (body.email !== undefined && companyEmail && !isValidEmail(companyEmail)) return res.status(400).json({ ok: false, message: 'Email doanh nghiệp không hợp lệ.' });
  if (!sets.length) return res.status(400).json({ ok: false, message: 'Không có dữ liệu cập nhật.' });
  try {
    const duplicate = await query(
      `SELECT conflict_type FROM (
         SELECT 'tax_code' AS conflict_type FROM companies
          WHERE id <> $1 AND $2 <> ''
            AND UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')) = $2
         UNION ALL
         SELECT 'email' AS conflict_type FROM companies
          WHERE id <> $1 AND $3 <> '' AND LOWER(BTRIM(email)) = $3
       ) conflicts LIMIT 1`,
      [companyId, taxCode, companyEmail],
    );
    if (duplicate.rows[0]) return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field: duplicate.rows[0].conflict_type, message: duplicate.rows[0].conflict_type === 'tax_code' ? 'Mã số thuế đã được sử dụng.' : 'Email doanh nghiệp đã được sử dụng.' });
    values.push(companyId);
    const result = await query(`UPDATE companies SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ ok: false, message: 'Không tìm thấy doanh nghiệp.' });
    res.json({ ok: true, data: result.rows[0], message: 'Đã lưu thông tin doanh nghiệp vào PostgreSQL.' });
  } catch (error: any) {
    if (isUniqueViolation(error)) return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', message: 'Email hoặc mã số thuế đã tồn tại.' });
    res.status(500).json({ ok: false, message: error.message });
  }
});

saasRouter.get('/tenants/list', tenantMiddleware, requireSuperAdmin, async (req: TenantRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT c.id, c.code, c.name_vi, c.name_en, c.tax_code, c.email, c.phone,
              c.slug, c.subdomain, c.plan_type, c.subscription_status,
              c.trial_ends_at, c.max_users, c.max_warehouses, c.is_paused,
              c.is_active, c.is_default_shop, c.onboarding_completed, c.created_at,
              c.owner_user_id, u.email AS owner_email, u.full_name AS owner_name,
              tw.workspace_slug, tw.webshop_slug, tw.webshop_name_vi
         FROM companies c
         LEFT JOIN sys_users u ON u.id = c.owner_user_id
         LEFT JOIN tenant_workspaces tw ON tw.company_id = c.id
        ORDER BY c.id DESC`,
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
      `SELECT c.id, c.code, c.name_vi, c.name_en, c.tax_code, c.email, c.phone,
              c.address, c.slug, c.subdomain, c.plan_type, c.subscription_status,
              c.trial_ends_at, c.settings, c.max_users, c.max_warehouses,
              c.is_paused, c.is_active, c.is_default_shop,
              c.onboarding_completed, c.created_at, c.owner_user_id,
              u.email AS owner_email, u.full_name AS owner_name,
              tw.workspace_slug, tw.workspace_name_vi, tw.workspace_name_en,
              tw.webshop_slug, tw.webshop_name_vi, tw.webshop_name_en
         FROM companies c
         LEFT JOIN sys_users u ON u.id = c.owner_user_id
         LEFT JOIN tenant_workspaces tw ON tw.company_id = c.id
        WHERE c.id = $1`,
      [tenantId],
    );
    const row = result.rows[0];
    res.json({
      ok: true,
      data: row ? {
        ...row,
        workspace: row.workspace_slug ? { slug: row.workspace_slug, name_vi: row.workspace_name_vi, name_en: row.workspace_name_en, url: '/saas/dashboard' } : null,
        webshop: row.webshop_slug ? { slug: row.webshop_slug, name_vi: row.webshop_name_vi, name_en: row.webshop_name_en, url: `/shop/${row.webshop_slug}` } : null,
      } : null,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

saasRouter.post('/tenants/register', async (req: Request, res: Response) => {
  const body = req.body || {};
  const nameVi = String(body.name_vi || '').trim();
  const nameEn = String(body.name_en || '').trim();
  const taxCode = normalizeTaxCode(body.tax_code);
  const ownerEmail = normalizeEmail(body.owner_email);
  // If no separate company inbox is supplied, use the owner inbox as the
  // canonical company contact so the email uniqueness rule remains global.
  const companyEmail = normalizeEmail(body.email || ownerEmail);
  const ownerName = String(body.owner_name || ownerEmail).trim();
  const ownerPassword = String(body.owner_password || '');
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();
  const requestedPlan = String(body.plan_type || 'free').toLowerCase();
  const normalizedPlanType = ['free', 'starter', 'professional', 'enterprise'].includes(requestedPlan)
    ? requestedPlan
    : 'free';

  if (!nameVi || !taxCode || !ownerEmail || !ownerPassword || !ownerName) {
    return res.status(400).json({ ok: false, message: 'Thiếu thông tin bắt buộc: tên công ty, mã số thuế, email quản lý, họ tên và mật khẩu' });
  }
  if (!isValidEmail(ownerEmail) || (companyEmail && !isValidEmail(companyEmail))) {
    return res.status(400).json({ ok: false, message: 'Email doanh nghiệp hoặc email quản lý không hợp lệ.' });
  }
  if (ownerEmail.length > 50 || companyEmail.length > 100) {
    return res.status(400).json({ ok: false, message: 'Email đăng ký vượt quá độ dài cho phép.' });
  }
  if (ownerPassword.length < 6) {
    return res.status(400).json({ ok: false, message: 'Mật khẩu quản lý phải có ít nhất 6 ký tự.' });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');

    // Check before INSERT for a useful validation message. The unique indexes
    // added by migration 5 still handle concurrent registrations atomically.
    const duplicate = await dbClient.query(
      `SELECT conflict_type FROM (
         SELECT 'tax_code' AS conflict_type
           FROM companies
          WHERE UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')) = $1
         UNION ALL
         SELECT 'company_email' AS conflict_type
           FROM companies
          WHERE $2 <> '' AND LOWER(BTRIM(email)) = $2
         UNION ALL
         SELECT 'owner_email' AS conflict_type
           FROM sys_users
          WHERE LOWER(BTRIM(email)) = $3
         UNION ALL
         SELECT 'owner_email' AS conflict_type
           FROM companies
          WHERE $3 <> '' AND LOWER(BTRIM(email)) = $3
         UNION ALL
         SELECT 'company_email' AS conflict_type
           FROM sys_users
          WHERE $2 <> '' AND LOWER(BTRIM(email)) = $2
       ) conflicts
       LIMIT 1`,
      [taxCode, companyEmail, ownerEmail],
    );
    if (duplicate.rows[0]) {
      const type = duplicate.rows[0].conflict_type;
      await dbClient.query('ROLLBACK');
      const message = type === 'tax_code'
        ? 'Mã số thuế đã được đăng ký trên hệ thống.'
        : type === 'company_email'
          ? 'Email doanh nghiệp đã được đăng ký trên hệ thống.'
          : 'Email quản lý đã được sử dụng. Vui lòng dùng email khác.';
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field: type, message });
    }

    const slugBase = normalizeSlug(nameVi).slice(0, 40) || 'tenant';
    const uniqueSuffix = randomBytes(5).toString('hex');
    const slug = `${slugBase}-${uniqueSuffix}`.slice(0, 50);
    const code = `TENANT-${randomBytes(6).toString('hex').toUpperCase()}`;
    const workspaceNameVi = `Không gian làm việc ${nameVi}`;
    const workspaceNameEn = `Workspace ${nameEn || nameVi}`;
    const webshopNameVi = `WebShop ${nameVi}`;
    const webshopNameEn = `WebShop ${nameEn || nameVi}`;

    const companyResult = await dbClient.query(
      `INSERT INTO companies (
         code, name_vi, name_en, tax_code, email, phone, address, slug,
         subdomain, plan_type, subscription_status, trial_ends_at,
         max_users, max_warehouses, is_active, is_default_shop,
         onboarding_completed, settings
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'trial', NOW() + INTERVAL '14 days',
               5, 3, TRUE, FALSE, FALSE, $10::jsonb)
       RETURNING id`,
      [
        code,
        nameVi,
        nameEn || null,
        taxCode,
        companyEmail || null,
        phone || null,
        address || null,
        slug,
        normalizedPlanType,
        JSON.stringify({ workspace_slug: slug, webshop_slug: slug }),
      ],
    );
    const companyId = Number(companyResult.rows[0].id);

    const roleResult = await dbClient.query("SELECT id FROM sys_roles WHERE code = 'ADMIN' LIMIT 1");
    const roleId = roleResult.rows[0]?.id;
    if (!roleId) throw new Error('Chưa khởi tạo vai trò quản trị tenant.');

    const passwordHash = await bcrypt.hash(ownerPassword, BCRYPT_ROUNDS);
    const userResult = await dbClient.query(
      `INSERT INTO sys_users (
         company_id, username, email, password_hash, full_name, phone,
         role_id, status, preferred_lang, is_super_admin
       )
       VALUES ($1, $2, $2, $3, $4, $5, $6, 'active', 'vi', FALSE)
       RETURNING id`,
      [companyId, ownerEmail, passwordHash, ownerName, phone || null, roleId],
    );
    const userId = Number(userResult.rows[0].id);

    const branchResult = await dbClient.query(
      `INSERT INTO branches (company_id, code, name_vi, name_en, is_headquarter, is_active)
       VALUES ($1, $2, 'Trụ Sở Chính', 'Headquarters', TRUE, TRUE)
       RETURNING id`,
      [companyId, `HO_${code}`],
    );
    const branchId = Number(branchResult.rows[0].id);
    await dbClient.query(
      `INSERT INTO departments (branch_id, code, name_vi, name_en, is_active)
       VALUES ($1, 'DEPT_BGD', 'Ban Giám Đốc', 'Board of Directors', TRUE)`,
      [branchId],
    );

    // Provision both resources in the same transaction as the tenant and its
    // owner. A successful registration can therefore never lack a workspace
    // or a private WebShop.
    await dbClient.query(
      `INSERT INTO tenant_workspaces (
         company_id, workspace_slug, workspace_name_vi, workspace_name_en,
         webshop_slug, webshop_name_vi, webshop_name_en
       )
       VALUES ($1, $2, $3, $4, $2, $5, $6)`,
      [companyId, slug, workspaceNameVi, workspaceNameEn, webshopNameVi, webshopNameEn],
    );
    await dbClient.query('UPDATE companies SET owner_user_id = $1 WHERE id = $2', [userId, companyId]);

    const token = jwt.sign(
      {
        userId,
        username: ownerEmail,
        role: 'ADMIN',
        companyId,
        isSuperAdmin: false,
      },
      JWT_SECRET,
      { expiresIn: '7d' },
    );

    await dbClient.query('COMMIT');

    res.json({
      ok: true,
      message: 'Đăng ký tenant mới thành công! Dùng thử 14 ngày miễn phí.',
      data: {
        token,
        user: {
          id: userId,
          username: ownerEmail,
          email: ownerEmail,
          full_name: ownerName,
          company_id: companyId,
          role_code: 'ADMIN',
          is_super_admin: false,
          permissions: ['*'],
        },
        company: {
          id: companyId,
          code,
          name_vi: nameVi,
          slug,
          plan_type: normalizedPlanType,
          subscription_status: 'trial',
        },
        workspace: {
          slug,
          name_vi: workspaceNameVi,
          name_en: workspaceNameEn,
          url: '/saas/dashboard',
        },
        webshop: {
          slug,
          name_vi: webshopNameVi,
          name_en: webshopNameEn,
          url: `/shop/${slug}`,
        },
      },
    });
  } catch (error: any) {
    await dbClient.query('ROLLBACK').catch(() => undefined);
    console.error('[Tenant Register Error]', error);
    if (isUniqueViolation(error)) {
      const constraint = uniqueViolationConstraint(error);
      const field = constraint.includes('tax')
        ? 'tax_code'
        : constraint.includes('email')
          ? 'email'
          : 'identifier';
      const message = field === 'tax_code'
        ? 'Mã số thuế đã được đăng ký trên hệ thống.'
        : field === 'email'
          ? 'Email đã được đăng ký trên hệ thống.'
          : 'Thông tin đăng ký đã tồn tại.';
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field, message });
    }
    return res.status(500).json({ ok: false, message: 'Đăng ký thất bại. Vui lòng thử lại sau.' });
  } finally {
    dbClient.release();
  }
});

saasRouter.post('/auth/google/callback', async (req: Request, res: Response) => {
  const body = req.body || {};
  const profile = body.google_profile || {};
  const email = normalizeEmail(profile.email);
  const companyInfo = body.company_info || {};
  const nameVi = String(companyInfo.name_vi || '').trim();
  const nameEn = String(companyInfo.name_en || '').trim();
  const taxCode = normalizeTaxCode(companyInfo.tax_code);
  const companyEmail = companyInfo.email ? normalizeEmail(companyInfo.email) : email;
  const requestedPlan = String(body.plan_type || 'free').toLowerCase();
  const normalizedPlanType = ['free', 'starter', 'professional', 'enterprise'].includes(requestedPlan)
    ? requestedPlan
    : 'free';

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'Email từ Google không hợp lệ.' });
  }

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    const existingResult = await dbClient.query(
      `SELECT u.*, c.id AS joined_company_id, c.name_vi AS company_name
         FROM sys_users u
         LEFT JOIN companies c ON c.id = u.company_id
        WHERE LOWER(BTRIM(u.email)) = $1
        ORDER BY u.id ASC
        LIMIT 1`,
      [email],
    );

    let userId: number;
    let companyId: number | null = existingResult.rows[0]?.joined_company_id
      ? Number(existingResult.rows[0].joined_company_id)
      : null;
    const isExistingUser = existingResult.rows.length > 0;

    if (isExistingUser) {
      userId = Number(existingResult.rows[0].id);
      // An existing owner signs in; company information is not used to create
      // a second workspace for the same account.
      if (!companyId) {
        if (!nameVi || !taxCode) {
          await dbClient.query('ROLLBACK');
          return res.status(400).json({ ok: false, message: 'Thiếu tên công ty và mã số thuế để tạo WebShop.' });
        }
      }
    } else {
      if (!nameVi || !taxCode) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Thiếu tên công ty và mã số thuế để đăng ký.' });
      }
    }

    if (!companyId) {
      const duplicate = await dbClient.query(
        `SELECT conflict_type FROM (
           SELECT 'tax_code' AS conflict_type
             FROM companies
            WHERE UPPER(regexp_replace(BTRIM(tax_code), '[[:space:].-]+', '', 'g')) = $1
           UNION ALL
           SELECT 'company_email' AS conflict_type
             FROM companies
            WHERE LOWER(BTRIM(email)) = $2
         ) conflicts
         LIMIT 1`,
        [taxCode, companyEmail],
      );
      if (duplicate.rows[0]) {
        const type = duplicate.rows[0].conflict_type;
        await dbClient.query('ROLLBACK');
        return res.status(409).json({
          ok: false,
          code: 'DUPLICATE_IDENTIFIER',
          field: type,
          message: type === 'tax_code' ? 'Mã số thuế đã được đăng ký trên hệ thống.' : 'Email doanh nghiệp đã được đăng ký trên hệ thống.',
        });
      }

      const slugBase = normalizeSlug(nameVi).slice(0, 40) || 'tenant';
      const slug = `${slugBase}-${randomBytes(5).toString('hex')}`.slice(0, 50);
      const code = `TENANT-${randomBytes(6).toString('hex').toUpperCase()}`;
      const workspaceNameVi = `Không gian làm việc ${nameVi}`;
      const workspaceNameEn = `Workspace ${nameEn || nameVi}`;
      const webshopNameVi = `WebShop ${nameVi}`;
      const webshopNameEn = `WebShop ${nameEn || nameVi}`;
      const companyResult = await dbClient.query(
        `INSERT INTO companies (
           code, name_vi, name_en, tax_code, email, phone, address, slug,
           subdomain, plan_type, subscription_status, trial_ends_at,
           max_users, max_warehouses, is_active, is_default_shop,
           onboarding_completed, settings
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 'trial', NOW() + INTERVAL '14 days',
                 5, 3, TRUE, FALSE, FALSE, $10::jsonb)
         RETURNING id`,
        [
          code,
          nameVi,
          nameEn || null,
          taxCode,
          companyEmail,
          String(companyInfo.phone || '').trim() || null,
          String(companyInfo.address || '').trim() || null,
          slug,
          normalizedPlanType,
          JSON.stringify({ workspace_slug: slug, webshop_slug: slug, google_account: true }),
        ],
      );
      companyId = Number(companyResult.rows[0].id);

      if (!isExistingUser) {
        const roleResult = await dbClient.query("SELECT id FROM sys_roles WHERE code = 'ADMIN' LIMIT 1");
        const roleId = roleResult.rows[0]?.id;
        if (!roleId) throw new Error('Chưa khởi tạo vai trò quản trị tenant.');
        const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
        const userResult = await dbClient.query(
          `INSERT INTO sys_users (
             company_id, username, email, password_hash, full_name, phone,
             role_id, status, preferred_lang, is_super_admin
           )
           VALUES ($1, $2, $2, $3, $4, $5, $6, 'active', 'vi', FALSE)
           RETURNING id`,
          [companyId, email, passwordHash, String(profile.name || profile.given_name || email.split('@')[0]).trim(), String(companyInfo.phone || '').trim() || null, roleId],
        );
        userId = Number(userResult.rows[0].id);
      } else {
        await dbClient.query('UPDATE sys_users SET company_id = $1 WHERE id = $2', [companyId, userId]);
      }

      const branchResult = await dbClient.query(
        `INSERT INTO branches (company_id, code, name_vi, name_en, is_headquarter, is_active)
         VALUES ($1, $2, 'Trụ Sở Chính', 'Headquarters', TRUE, TRUE)
         RETURNING id`,
        [companyId, `HO_${code}`],
      );
      await dbClient.query(
        `INSERT INTO departments (branch_id, code, name_vi, name_en, is_active)
         VALUES ($1, 'DEPT_BGD', 'Ban Giám Đốc', 'Board of Directors', TRUE)`,
        [Number(branchResult.rows[0].id)],
      );
      await dbClient.query(
        `INSERT INTO tenant_workspaces (
           company_id, workspace_slug, workspace_name_vi, workspace_name_en,
           webshop_slug, webshop_name_vi, webshop_name_en
         )
         VALUES ($1, $2, $3, $4, $2, $5, $6)`,
        [companyId, slug, workspaceNameVi, workspaceNameEn, webshopNameVi, webshopNameEn],
      );
      await dbClient.query('UPDATE companies SET owner_user_id = $1 WHERE id = $2', [userId, companyId]);
    }

    const userResult = await dbClient.query(
      `SELECT u.*, r.code AS role_code, r.name_vi AS role_name_vi, r.name_en AS role_name_en
         FROM sys_users u
         LEFT JOIN sys_roles r ON r.id = u.role_id
        WHERE u.id = $1 AND u.status = 'active'`,
      [userId],
    );
    const dbUser = userResult.rows[0];
    if (!dbUser) throw new Error('Tài khoản Google không còn hoạt động.');
    await dbClient.query('COMMIT');

    const roleCode = dbUser.role_code || 'ADMIN';
    const isSuperAdmin = dbUser.is_super_admin === true;
    const token = jwt.sign(
      { userId, username: email, role: roleCode, companyId: companyId || undefined, isSuperAdmin },
      JWT_SECRET,
      { expiresIn: '7d' },
    );
    const workspace = companyId ? await query(
      `SELECT workspace_slug, workspace_name_vi, workspace_name_en, webshop_slug, webshop_name_vi, webshop_name_en
         FROM tenant_workspaces WHERE company_id = $1`,
      [companyId],
    ) : { rows: [] } as any;
    const ws = workspace.rows[0];

    return res.json({
      ok: true,
      message: companyId && isExistingUser ? 'Đăng nhập Google thành công!' : 'Đăng ký từ Google thành công!',
      data: {
        token,
        user: {
          id: userId,
          username: dbUser.username,
          email: dbUser.email,
          full_name: dbUser.full_name,
          company_id: companyId,
          role_code: roleCode,
          role_name_vi: dbUser.role_name_vi || 'Quản trị viên',
          role_name_en: dbUser.role_name_en || 'System Administrator',
          is_super_admin: isSuperAdmin,
          permissions: await getPermissionsForUser(userId, roleCode),
        },
        company: companyId ? { id: companyId } : null,
        workspace: ws ? { slug: ws.workspace_slug, name_vi: ws.workspace_name_vi, name_en: ws.workspace_name_en, url: '/saas/dashboard' } : null,
        webshop: ws ? { slug: ws.webshop_slug, name_vi: ws.webshop_name_vi, name_en: ws.webshop_name_en, url: `/shop/${ws.webshop_slug}` } : null,
        is_new: !isExistingUser,
      },
    });
  } catch (error: any) {
    await dbClient.query('ROLLBACK').catch(() => undefined);
    console.error('[Google Auth Error]', error);
    if (isUniqueViolation(error)) {
      const constraint = uniqueViolationConstraint(error);
      const field = constraint.includes('tax') ? 'tax_code' : constraint.includes('email') ? 'email' : 'identifier';
      return res.status(409).json({ ok: false, code: 'DUPLICATE_IDENTIFIER', field, message: field === 'tax_code' ? 'Mã số thuế đã được đăng ký trên hệ thống.' : 'Email đã được đăng ký trên hệ thống.' });
    }
    return res.status(500).json({ ok: false, message: 'Lỗi xử lý đăng nhập Google.' });
  } finally {
    dbClient.release();
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
