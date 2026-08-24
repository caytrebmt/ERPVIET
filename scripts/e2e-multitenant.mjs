/**
 * E2E kiểm chứng MULTI-TENANT trên PostgreSQL THẬT (embedded, không cần cài
 * PostgreSQL hệ thống / không cần quyền root).
 *
 * Bao phủ đúng 2 nhóm lỗi đã vá:
 *   1. WebShop mỗi tenant: đăng ký 2 tenant, sản phẩm/danh mục/giỏ hàng/khách
 *      hàng không lẫn giữa /shop/<slug-A>, /shop/<slug-B> và shop mặc định.
 *   2. User ERP tách theo tenant: tenant admin không chèn user sang tenant
 *      khác; super admin bắt buộc chọn tenant (TENANT_REQUIRED); lọc
 *      ?company_id=; giới hạn max_users; phòng ban cross-tenant bị từ chối.
 *
 * CÁCH CHẠY (không hook vào `npm test` để tránh tải binary Postgres trong CI):
 *   npm i --no-save embedded-postgres
 *   node scripts/e2e-multitenant.mjs
 *
 * Kết thúc in "N PASS, M FAIL" và exit code != 0 nếu có FAIL.
 */

import { createRequire } from 'module';
import { execSync, spawn } from 'child_process';
import fs from 'fs';

import path from 'path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const EmbeddedPostgres = require('embedded-postgres');
const PG = EmbeddedPostgres.default || EmbeddedPostgres;
const pgPkg = require('pg');

const PG_PORT = 55432;
const DB_NAME = 'erpacc_db';
const APP_PORT = 3100;
const BASE = `http://127.0.0.1:${APP_PORT}`;

let passed = 0, failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name} ${detail}`); }
}

async function api(path, { method = 'GET', token, tenant, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenant) headers['x-tenant-slug'] = tenant;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, json };
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/api/shop/tenant/info`);
      if (res.status !== 0) return true;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ---------- 1. Embedded PostgreSQL ----------
try { execSync('rm -rf /tmp/epg-data'); } catch {}
const epg = new PG({ databaseDir: '/tmp/epg-data', user: 'postgres', password: 'postgres', port: PG_PORT, persistent: true });
await epg.initialise();
await epg.start();
console.log('== Embedded PostgreSQL started ==');

let server;
try {
  const pgClient = new pgPkg.Client({ host: '127.0.0.1', port: PG_PORT, user: 'postgres', password: 'postgres', database: 'postgres' });
  await pgClient.connect();
  await pgClient.query(`CREATE DATABASE ${DB_NAME}`);
  await pgClient.end();

  const schema = fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
  const dbClient = new pgPkg.Client({ host: '127.0.0.1', port: PG_PORT, user: 'postgres', password: 'postgres', database: DB_NAME });
  await dbClient.connect();
  await dbClient.query(schema);
  await dbClient.end();
  console.log('== schema.sql applied ==');

  // ---------- 2. Start the real API server against this DB ----------
  server = spawn('npx', ['tsx', 'server.ts'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/${DB_NAME}`,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.on('data', (d) => process.stderr.write(`[srv] ${d}`));
  if (!(await waitForServer())) throw new Error('Server did not start in time');
  // give runMigrations a moment, then poll until default shop resolves
  let tenantInfo = null;
  for (let i = 0; i < 30; i++) {
    const r = await api('/api/shop/tenant/info');
    if (r.json?.ok) { tenantInfo = r.json.data; break; }
    await new Promise((r2) => setTimeout(r2, 1000));
  }
  if (!tenantInfo) throw new Error('Default tenant did not resolve');
  console.log(`== Server up. Default shop: ${tenantInfo.name} (company ${tenantInfo.companyId}) ==\n`);

  // ---------- 3. Register two tenants ----------
  console.log('--- Đăng ký 2 tenant ---');
  const regA = await api('/api/saas/tenants/register', {
    method: 'POST',
    body: { name_vi: 'Công ty Alpha', tax_code: '0300000001', owner_name: 'Anh Alpha', owner_email: 'alpha@example.com', owner_password: 'alpha123' },
  });
  check('Đăng ký tenant A OK', regA.json?.ok === true, JSON.stringify(regA.json));
  const tokenA = regA.json?.data?.token;
  const slugA = regA.json?.data?.webshop?.slug;

  const regB = await api('/api/saas/tenants/register', {
    method: 'POST',
    body: { name_vi: 'Công ty Beta', tax_code: '0300000002', owner_name: 'Anh Beta', owner_email: 'beta@example.com', owner_password: 'beta1234' },
  });
  check('Đăng ký tenant B OK', regB.json?.ok === true, JSON.stringify(regB.json));
  const tokenB = regB.json?.data?.token;
  const slugB = regB.json?.data?.webshop?.slug;
  check('2 tenant có webshop_slug khác nhau', !!slugA && !!slugB && slugA !== slugB, `${slugA} vs ${slugB}`);

  const companyIdA = regA.json?.data?.company?.id;
  const companyIdB = regB.json?.data?.company?.id;

  // ---------- 4. Product isolation across storefronts ----------
  console.log('\n--- Tách sản phẩm theo tenant ---');
  const mkProd = await api('/api/shop/admin/products', {
    method: 'POST', token: tokenA, tenant: slugA,
    body: { sku: 'ALPHA-001', name: 'Sản phẩm riêng của Alpha', salePrice: 123000, costPrice: 100000, stock: 10, unit: 'Cái', category: 'Hàng hóa' },
  });
  check('Tenant A tạo sản phẩm trong shop A', mkProd.json?.ok === true, JSON.stringify(mkProd.json).slice(0, 200));

  const catA = await api('/api/shop/catalog', { tenant: slugA });
  check('Shop A hiển thị sản phẩm của A', (catA.json?.data?.products || []).some((p) => p.sku === 'ALPHA-001'));

  const catB = await api('/api/shop/catalog', { tenant: slugB });
  check('Shop B KHÔNG thấy sản phẩm của A', !(catB.json?.data?.products || []).some((p) => p.sku === 'ALPHA-001'));

  const catDefault = await api('/api/shop/catalog');
  check('Shop mặc định KHÔNG thấy sản phẩm của A', !(catDefault.json?.data?.products || []).some((p) => p.sku === 'ALPHA-001'));

  const prodByIdWrongTenant = await api('/api/shop/products/1', { tenant: slugB });
  check('Slug/id sản phẩm của tenant khác trả 404/đúng sp', prodByIdWrongTenant.status === 404 || !(JSON.stringify(prodByIdWrongTenant.json).includes('ALPHA-001')));

  const ghost = await api('/api/shop/catalog', { tenant: 'tenant-khong-ton-tai' });
  check('Storefront slug không tồn tại → 404', ghost.status === 404, `status=${ghost.status}`);

  // ---------- 5. Cart isolation ----------
  console.log('\n--- Giỏ hàng tách tenant ---');
  const alphaProductId = (catA.json?.data?.products || []).find((p) => p.sku === 'ALPHA-001')?.id;
  const cartAddA = await api('/api/shop/cart/items', { method: 'POST', tenant: slugA, body: { product_id: alphaProductId, quantity: 2 } });
  check('Thêm sản phẩm A vào giỏ ở shop A', cartAddA.json?.ok === true, JSON.stringify(cartAddA.json).slice(0, 150));
  const cartAddAinB = await api('/api/shop/cart/items', { method: 'POST', tenant: slugB, body: { product_id: alphaProductId, quantity: 1 } });
  check('Cùng product_id thêm ở shop B bị từ chối (404)', cartAddAinB.status === 404, `status=${cartAddAinB.status} ${JSON.stringify(cartAddAinB.json).slice(0, 120)}`);

  // ---------- 6. Web customer isolation ----------
  console.log('\n--- Khách hàng WebShop tách tenant ---');
  const regCustA = await api('/api/shop/auth/register', { method: 'POST', tenant: slugA, body: { name: 'Khách A', email: 'khach@example.com', phone: '0900000001', password: 'khach123' } });
  check('Đăng ký khách ở shop A', regCustA.json?.ok === true, JSON.stringify(regCustA.json).slice(0, 150));
  const loginCustInB = await api('/api/shop/auth/login', { method: 'POST', tenant: slugB, body: { email: 'khach@example.com', password: 'khach123' } });
  check('Tài khoản khách của shop A KHÔNG login được ở shop B', loginCustInB.status === 401, `status=${loginCustInB.status}`);
  const regCustSameEmailB = await api('/api/shop/auth/register', { method: 'POST', tenant: slugB, body: { name: 'Khách B', email: 'khach@example.com', phone: '0900000002', password: 'khach123' } });
  check('Cùng email vẫn đăng ký được ở shop B (khác tenant)', regCustSameEmailB.json?.ok === true, JSON.stringify(regCustSameEmailB.json).slice(0, 150));
  const dupEmailA = await api('/api/shop/auth/register', { method: 'POST', tenant: slugA, body: { name: 'Khách A2', email: 'khach@example.com', phone: '0900000003', password: 'khach123' } });
  check('Trùng email trong CÙNG shop A bị chặn (409)', dupEmailA.status === 409, `status=${dupEmailA.status}`);

  // ---------- 7. ERP user scoping ----------
  console.log('\n--- Tách user ERP theo tenant ---');
  const usersA = await api('/api/saas/users', { token: tokenA });
  check('Tenant A chỉ thấy user của A', usersA.json?.ok && usersA.json.data.length >= 1 && usersA.json.data.every((u) => u.company_id === companyIdA),
        `got companies: ${(usersA.json?.data || []).map((u) => u.company_id).join(',')}`);

  // Tenant admin A cố tạo user cho tenant B → phải bị ép về A
  const crossCreate = await api('/api/saas/users', {
    method: 'POST', token: tokenA,
    body: { username: 'nhanvien.a@alpha.com', email: 'nhanvien.a@alpha.com', password: 'nv123456', full_name: 'Nhân viên A', company_id: companyIdB },
  });
  check('Tenant admin A tạo user KHÔNG chèn được sang tenant B', crossCreate.json?.ok && crossCreate.json.data.company_id === companyIdA,
        `status=${crossCreate.status} company=${crossCreate.json?.data?.company_id}`);

  // Super admin login (seeded admin/admin123 của company 1)
  const saLogin = await api('/api/saas/auth/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } });
  check('Super admin login', saLogin.json?.ok === true, JSON.stringify(saLogin.json).slice(0, 120));
  const tokenSA = saLogin.json?.data?.token;

  const saNoTenant = await api('/api/saas/users', {
    method: 'POST', token: tokenSA,
    body: { username: 'user.notenant', email: 'user.notenant@x.com', password: 'nv123456', full_name: 'No Tenant User' },
  });
  check('Super admin tạo user THIẾU company_id → 400 TENANT_REQUIRED', saNoTenant.status === 400 && saNoTenant.json?.code === 'TENANT_REQUIRED',
        `status=${saNoTenant.status} ${JSON.stringify(saNoTenant.json)}`);

  const saToB = await api('/api/saas/users', {
    method: 'POST', token: tokenSA,
    body: { username: 'nv.beta@beta.com', email: 'nv.beta@beta.com', password: 'nv123456', full_name: 'Nhân viên Beta', company_id: companyIdB },
  });
  check('Super admin tạo user ĐÚNG tenant B', saToB.status === 201 && saToB.json?.data?.company_id === companyIdB,
        `status=${saToB.status}`);

  const usersAll = await api('/api/saas/users', { token: tokenSA });
  const namesOk = (usersAll.json?.data || []).every((u) => typeof u.company_name === 'string');
  check('Super admin xem tất cả user kèm company_name', usersAll.json?.ok && namesOk);
  const usersBOnly = await api(`/api/saas/users?company_id=${companyIdB}`, { token: tokenSA });
  check('Super admin lọc user theo tenant B', usersBOnly.json?.ok && usersBOnly.json.data.every((u) => u.company_id === companyIdB));
  const usersBadFilter = await api('/api/saas/users?company_id=abc', { token: tokenSA });
  check('Filter company_id không hợp lệ → 400', usersBadFilter.status === 400);

  // ---------- 8. Max users per tenant plan ----------
  console.log('\n--- Giới hạn max_users theo gói ---');
  const deptA = await api('/api/saas/departments', { token: tokenA });
  const deptIdA = deptA.json?.data?.[0]?.id;
  let maxHit = null;
  // tenant A: owner + 1 nhân viên đã tạo = 2; max_users mặc định 5 → tạo thêm đến khi chạm trần
  for (let i = 1; i <= 6; i++) {
    const r = await api('/api/saas/users', {
      method: 'POST', token: tokenA,
      body: { username: `bulk${i}.a`, email: `bulk${i}.a@alpha.com`, password: 'nv123456', full_name: `Bulk ${i}`, department_id: deptIdA },
    });
    if (r.status === 403 && r.json?.code === 'MAX_USERS_REACHED') { maxHit = i; break; }
    if (r.status === 400) { console.log('  (dept check error?)', JSON.stringify(r.json)); }
  }
  check('Tạo user vượt max_users của tenant → MAX_USERS_REACHED', maxHit !== null, `hit at iteration ${maxHit}`);

  // ---------- 9. Cross-tenant department rejected ----------
  console.log('\n--- Phòng ban cross-tenant ---');
  const deptB = await api(`/api/saas/departments?company_id=${companyIdB}`, { token: tokenSA });
  const deptIdB = deptB.json?.data?.[0]?.id;
  const crossDept = await api('/api/saas/users', {
    method: 'POST', token: tokenSA,
    body: { username: 'crossdept.x', email: 'crossdept.x@beta.com', password: 'nv123456', full_name: 'Cross Dept', company_id: companyIdB, department_id: deptIdA },
  });
  check('Gán phòng ban tenant A cho user tenant B → 400', crossDept.status === 400, `status=${crossDept.status} ${JSON.stringify(crossDept.json).slice(0, 120)}`);

  // ---------- 10. User list page of tenant B does not leak ----------
  console.log('\n--- Kiểm tra cuối ---');
  const loginB = await api('/api/saas/auth/login', { method: 'POST', body: { username: 'beta@example.com', password: 'beta1234' } });
  const tokenB2 = loginB.json?.data?.token;
  const usersBView = await api('/api/saas/users', { token: tokenB2 });
  check('Tenant B (login qua email) chỉ thấy user tenant B', usersBView.json?.ok && usersBView.json.data.every((u) => u.company_id === companyIdB));

  console.log(`\n===== KẾT QUẢ: ${passed} PASS, ${failed} FAIL =====`);
  process.exitCode = failed ? 1 : 0;
} catch (err) {
  console.error('E2E ERROR:', err);
  process.exitCode = 1;
} finally {
  try { server?.kill('SIGTERM'); } catch {}
  try { await epg.stop(); } catch {}
}
