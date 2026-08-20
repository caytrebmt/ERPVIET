/**
 * E2E AUDIT SCRIPT — ERPVIET
 * Chạy: node scripts/e2e-audit.mjs  (server phải đang chạy ở localhost:3000)
 * Mục đích: kiểm tra tự động các luồng nghiệp vụ chính, ghi nhận endpoint nào chạy được / lỗi / thiếu.
 */
const BASE = process.env.AUDIT_BASE || 'http://localhost:3000';
const results = [];

async function call(method, path, { body, token, headers = {} } = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text.slice(0, 120); }
    return { status: res.status, data, ms: Date.now() - t0 };
  } catch (e) {
    return { status: 0, data: e.message, ms: Date.now() - t0 };
  }
}

function record(group, name, r, expect = 200) {
  const expects = Array.isArray(expect) ? expect : [expect];
  const ok = expects.includes(r.status);
  results.push({ group, name, ok, status: r.status, expect, ms: r.ms, note: ok ? '' : (typeof r.data === 'string' ? r.data : (r.data?.message || JSON.stringify(r.data).slice(0, 140))) });
  console.log(`${ok ? '✅' : '❌'} [${group}] ${name} → ${r.status}${ok ? '' : ` (kỳ vọng ${expect}) ${results[results.length - 1].note}`}`);
  return r;
}

// ---------- 1. SaaS ERP ----------
async function testSaas() {
  const login = await call('POST', '/api/saas/auth/login', { body: { username: 'admin', password: 'admin123' } });
  record('SaaS Auth', 'POST /auth/login (admin/admin123)', login);
  const token = login.data?.token || login.data?.data?.token;

  const badLogin = await call('POST', '/api/saas/auth/login', { body: { username: 'admin', password: 'sai-roi' } });
  record('SaaS Auth', 'POST /auth/login sai mật khẩu (kỳ vọng 401)', badLogin, 401);

  if (token) {
    for (const p of ['/api/saas/auth/me', '/api/saas/users', '/api/saas/departments', '/api/saas/products',
      '/api/saas/categories', '/api/saas/uom', '/api/saas/customers', '/api/saas/suppliers',
      '/api/saas/quotations', '/api/saas/orders', '/api/saas/crm/leads', '/api/saas/crm/opportunities',
      '/api/saas/purchasing/orders', '/api/saas/purchasing/requests', '/api/saas/assets', '/api/saas/audit-logs',
      '/api/saas/settings', '/api/saas/menus', '/api/saas/roles', '/api/saas/notifications',
      '/api/saas/tenants/me', '/api/saas/tenants/list', '/api/saas/inventory/balances',
      '/api/saas/inventory/movements?limit=5', '/api/saas/inventory/xnt?from=2026-01-01&to=2026-12-31']) {
      const r = await call('GET', p, { token });
      record('SaaS GET', `GET ${p.replace('/api/saas', '')}`, r);
    }

    // Nghiệp vụ ghi: nhập kho
    const prod = await call('GET', '/api/saas/products', { token });
    const prodData = prod.data?.data;
    const firstProduct = Array.isArray(prodData) ? prodData[0] : (prodData?.items?.[0] || prod.data?.items?.[0]);
    console.log(`   [info] sản phẩm test tồn kho: id=${firstProduct?.id}`);
    if (firstProduct) {
      const bal1 = await call('GET', '/api/saas/inventory/balances', { token });
      const balData1 = Array.isArray(bal1.data?.data) ? bal1.data.data : bal1.data?.data?.items;
      const rowBefore = (balData1 || []).find((r) => Number(r.product_id) === Number(firstProduct.id));
      const before = rowBefore?.stock;
      const mv = await call('POST', '/api/saas/inventory/movements', {
        token,
        body: { type: 'NHAP_KHO', warehouseId: 1, referenceDoc: 'E2E-AUDIT', notes: 'E2E audit test nhập kho', items: [{ productId: firstProduct.id, quantity: 7, unitCost: Number(firstProduct.cost_price) || 1000 }] },
      });
      record('SaaS Write', 'POST /inventory/movements (nhập kho +7)', mv, [200, 201]);
      const bal2 = await call('GET', '/api/saas/inventory/balances', { token });
      const balData2 = Array.isArray(bal2.data?.data) ? bal2.data.data : bal2.data?.data?.items;
      const rowAfter = (balData2 || []).find((r) => Number(r.product_id) === Number(firstProduct.id));
      const after = rowAfter?.stock;
      const changed = after !== before;
      results.push({ group: 'SaaS Write', name: 'Tồn kho thay đổi sau nhập (+7)', ok: changed, status: bal2.status, expect: 200, ms: bal2.ms, note: `before=${before} after=${after}` });
      console.log(`${changed ? '✅' : '❌'} [SaaS Write] Tồn kho thay đổi sau nhập: before=${before} after=${after}`);
    }

    // Endpoint THIẾU mà UI đang gọi
    for (const [m, p, name] of [
      ['POST', '/api/saas/products', 'POST /products (tạo SP ERP)'],
      ['PUT', '/api/saas/products/1', 'PUT /products/1 (sửa SP ERP)'],
      ['POST', '/api/saas/quotations', 'POST /quotations (tạo báo giá)'],
      ['PUT', '/api/saas/quotations/1', 'PUT /quotations/1'],
      ['POST', '/api/saas/purchasing/orders', 'POST /purchasing/orders (tạo PO)'],
      ['POST', '/api/saas/suppliers', 'POST /suppliers'],
      ['POST', '/api/saas/warehouses', 'POST /warehouses'],
      ['POST', '/api/saas/crm/leads', 'POST /crm/leads'],
      ['POST', '/api/saas/assets', 'POST /assets (TSCD)'],
      ['POST', '/api/saas/vat/invoices', 'POST /vat/invoices (hóa đơn)'],
      ['POST', '/api/saas/accounting/vouchers', 'POST /accounting/vouchers (phần kế toán)'],
      ['POST', '/api/saas/debts/payments', 'POST /debts/payments (thanh toán công nợ)'],
      ['POST', '/api/saas/stocktaking', 'POST /stocktaking (kiểm kê)'],
    ]) {
      const r = await call(m, p, { token, body: {} });
      results.push({ group: 'SaaS Missing', name: `${name}`, ok: r.status === 404, status: r.status, expect: 404, ms: r.ms, note: r.status === 404 ? 'KHÔNG TỒN TẠI — UI không gọi được' : `trả về ${r.status}?!` });
      console.log(`${r.status === 404 ? '⚠️ ' : '❓'} [SaaS Missing] ${name} → ${r.status}`);
    }
  }
}

// ---------- 2. WebShop ----------
async function testShop() {
  const cat = await call('GET', '/api/shop/categories');
  record('Shop', 'GET /categories', cat);
  const catalog = await call('GET', '/api/shop/catalog?limit=5');
  record('Shop', 'GET /catalog', catalog);
  const first = catalog.data?.data?.items?.[0];
  const cartSid = 'e2e-audit-' + Date.now();

  // Giỏ hàng guest
  if (first) {
    const add = await call('POST', '/api/shop/cart/items', { headers: { 'x-cart-session-id': cartSid }, body: { product_id: first.id, quantity: 2 } });
    record('Shop', 'POST /cart/items (guest)', add, [200, 201]);
    const gcart = await call('GET', '/api/shop/cart', { headers: { 'x-cart-session-id': cartSid } });
    record('Shop', 'GET /cart (guest)', gcart);
  }

  // Đăng ký + đăng nhập khách hàng
  const uname = 'e2e_' + Date.now();
  const email = uname + '@audit.local';
  const reg = await call('POST', '/api/shop/auth/register', { body: { name: 'E2E Auditor', email, password: 'Audit@12345', phone: '0900111222', address: 'Số 1 Đường E2E' } });
  record('Shop', 'POST /auth/register (khách mới)', reg, [200, 201]);
  const login = await call('POST', '/api/shop/auth/login', { body: { email, password: 'Audit@12345' } });
  record('Shop', 'POST /auth/login', login);
  const ctok = login.data?.token || login.data?.data?.token;

  let orderCode = null;
  if (ctok && first) {
    const add = await call('POST', '/api/shop/cart/items', { token: ctok, body: { product_id: first.id, quantity: 1 } });
    record('Shop', 'POST /cart/items (đã login)', add, [200, 201]);
    const co = await call('POST', '/api/shop/orders', { token: ctok, body: { customer_name: 'E2E Auditor', customer_phone: '0900111222', shipping_address: 'Số 1 Đường E2E', payment_method: 'COD', items: [{ product_id: first.id, quantity: 1, price: first.web_price || first.selling_price }] } });
    record('Shop', 'POST /orders (đặt hàng)', co, [200, 201]);
    orderCode = co.data?.data?.order?.order_code || co.data?.data?.order_code || co.data?.order?.order_code;
    const myOrders = await call('GET', '/api/shop/orders', { token: ctok });
    record('Shop', 'GET /orders (lịch sử của tôi)', myOrders);
  }

  // Admin đơn hàng web
  const aLogin = await call('POST', '/api/saas/auth/login', { body: { username: 'admin', password: 'admin123' } });
  const aTok = aLogin.data?.token || aLogin.data?.data?.token;
  if (aTok) {
    const adminOrders = await call('GET', '/api/shop/orders?admin=true&per_page=5', { token: aTok });
    record('Shop Admin', 'GET /orders?admin=true', adminOrders);
    if (orderCode) {
      const st = await call('PUT', `/api/shop/admin/orders/1/status`, { token: aTok, body: { status: 'CONFIRMED' } });
      record('Shop Admin', 'PUT /admin/orders/:id/status', st, [200, 400, 404]);
      const erp = await call('POST', `/api/shop/orders/${orderCode}/erp-status`, { token: aTok, body: { erp_status: 'DA_XU_LY', note: 'E2E audit' } });
      record('Shop Admin', `POST /orders/${orderCode}/erp-status`, erp, [200, 201]);
    }
    // Endpoint UI gọi nhưng backend không có
    const promo = await call('POST', '/api/shop/promotions/validate', { body: { code: 'SALE10' } });
    results.push({ group: 'Shop Missing', name: 'POST /promotions/validate', ok: promo.status === 404, status: promo.status, expect: 404, ms: promo.ms, note: promo.status === 404 ? 'KHÔNG TỒN TẠI — UI đang gọi' : `trả về ${promo.status}` });
    console.log(`${promo.status === 404 ? '⚠️ ' : '❓'} [Shop Missing] POST /promotions/validate → ${promo.status}`);
    const cancel = await call('POST', '/api/shop/orders/1/cancel', { token: ctok });
    results.push({ group: 'Shop Missing', name: 'POST /orders/1/cancel', ok: cancel.status === 404, status: cancel.status, expect: 404, ms: cancel.ms, note: cancel.status === 404 ? 'KHÔNG TỒN TẠI — UI đang gọi' : `trả về ${cancel.status}` });
    console.log(`${cancel.status === 404 ? '⚠️ ' : '❓'} [Shop Missing] POST /orders/1/cancel → ${cancel.status}`);
    const reorder = await call('POST', '/api/shop/orders/1/reorder', { token: ctok });
    results.push({ group: 'Shop Missing', name: 'POST /orders/1/reorder', ok: reorder.status === 404, status: reorder.status, expect: 404, ms: reorder.ms, note: reorder.status === 404 ? 'KHÔNG TỒN TẠI — UI đang gọi' : `trả về ${reorder.status}` });
    console.log(`${reorder.status === 404 ? '⚠️ ' : '❓'} [Shop Missing] POST /orders/1/reorder → ${reorder.status}`);
  }
}

// ---------- MAIN ----------
await testSaas();
await testShop();

const pass = results.filter(r => r.ok).length;
console.log('\n========== TỔNG KẾT ==========');
console.log(`Tổng: ${results.length} | Đạt: ${pass} | Lỗi/Thiếu: ${results.length - pass}`);
import fs from 'fs';
fs.writeFileSync(new URL('../audit-results.json', import.meta.url), JSON.stringify(results, null, 2));
console.log('Chi tiết: audit-results.json');
