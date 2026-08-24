import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('security regression guards', () => {
  it('không còn backdoor demo-password trong saasRouter (login ERP)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).not.toMatch(/demoPasswords/);
    expect(src).not.toContain("'admin123'");
  });

  it('không còn backdoor demo-password trong shopCustomerService (login WebShop)', () => {
    const src = readSource('src/services/shopCustomerService.ts');
    expect(src).not.toMatch(/demoPasswords/);
    expect(src).not.toContain("'web12345'");
  });

  it('không còn JWT secret mặc định hardcode', () => {
    const files = [
      'src/middleware/tenant.ts',
      'src/middleware/shopTenant.ts',
      'src/api/saasRouter.ts',
      'src/api/shopRouter.ts',
      'src/services/shopCustomerService.ts',
      'src/pages/saas/SaaSSettingsPage.tsx',
    ];
    for (const f of files) {
      expect(readSource(f), `${f} vẫn còn secret mặc định`).not.toContain('jwt-secret-webshop-2026');
    }
  });

  it('không có secret mặc định nào trong toàn bộ src/', () => {
    const knownSecrets = ['jwt-secret-webshop-2026', 'erpacc-super-secret-jwt-key-2026'];
    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(ts|tsx|js|mjs|cjs|json)$/.test(entry.name)) out.push(full);
      }
      return out;
    };
    for (const f of walk('src')) {
      const content = fs.readFileSync(f, 'utf8');
      for (const secret of knownSecrets) {
        expect(content, `${f} vẫn còn secret mặc định ${secret}`).not.toContain(secret);
      }
    }
  });

  it('route quản lý tenant được bảo vệ bởi requireSuperAdmin', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toContain('requireSuperAdmin');
    // 5 endpoint toàn cục: list, get, patch, pause, upgrade
    expect(src.match(/requireSuperAdmin/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('tenantMiddleware không fallback company_id = 1', () => {
    const src = readSource('src/middleware/tenant.ts');
    expect(src).not.toMatch(/companyId\s*=\s*1/);
  });

  it('endpoint dịch thuật dùng chung chỉ super admin được ghi (không còn unauthenticated)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toContain("saasRouter.post('/translations', tenantMiddleware, requireSuperAdmin");
    expect(src).toContain("saasRouter.delete('/translations/:key', tenantMiddleware, requireSuperAdmin");
    expect(src).toContain("saasRouter.put('/translations/json', tenantMiddleware, requireSuperAdmin");
    expect(src).toContain("saasRouter.post('/translations/json/bulk', tenantMiddleware, requireSuperAdmin");
    expect(src).toContain("saasRouter.post('/translations/json/publish', tenantMiddleware, requireSuperAdmin");
  });

  it('nhật ký an ninh + menu DB toàn hệ thống chỉ super admin (API, route, sidebar)', () => {
    const router = readSource('src/api/saasRouter.ts');
    expect(router).toContain("saasRouter.get('/audit-logs', tenantMiddleware, requireSuperAdmin");
    expect(router).toContain("saasRouter.get('/menus', tenantMiddleware, requireSuperAdmin");
    const app = readSource('src/App.tsx');
    const auditRoute = app.match(/path="\/saas\/audit-logs"[\s\S]{0,200}?SaaSProtectedRoute([^>]*)/);
    expect(auditRoute, 'route /saas/audit-logs phải có superAdminOnly').toBeTruthy();
    expect(auditRoute?.[1]).toContain('superAdminOnly');
    const sidebar = readSource('src/components/SaaSSidebar.tsx');
    expect(sidebar).toContain("path === '/saas/tenants' || path === '/saas/audit-logs'");
  });

  it('nâng quyền is_super_admin chỉ áp cho company nền tảng (id = 1)', () => {
    const db = readSource('src/db/index.ts');
    const schema = readSource('schema.sql');
    for (const src of [db, schema]) {
      // Không được có câu UPDATE không lọc company_id (từng nâng nhầm admin
      // của mọi tenant thành super admin nền tảng).
      expect(src).not.toMatch(/UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin'\s*;/);
      expect(src).toContain("UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin' AND company_id = 1");
    }
  });

  it('tenant admin không nhìn thấy 4 tab nền tảng trong Cài Đặt Hệ Thống', () => {
    const src = readSource('src/pages/saas/SaaSSettingsPage.tsx');
    expect(src).toContain("const SUPER_ADMIN_ONLY_TABS: SettingsTabId[] = ['translations', 'translations_json', 'menu', 'api'];");
    expect(src).toContain('const isSuperAdmin = !!erpUser?.is_super_admin;');
    // Nội dung tab phải render qua effectiveTab (đã lọc quyền)
    expect(src).toContain("{effectiveTab === 'translations' && <SaaSTranslationsTab />}");
    expect(src).toContain("{effectiveTab === 'translations_json' && <SaaSTranslationsJsonTab />}");
    expect(src).toContain("{effectiveTab === 'menu' && (");
    expect(src).toContain("{effectiveTab === 'api' && (");
  });

  it('tenant không ghi đè được cấu hình "Kết nối API Backend" (settings.api)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toContain('if (!req.isSuperAdmin && settingsToWrite.api !== undefined)');
    expect(src).toContain('settingsToWrite = { ...settingsToWrite, api: currentSettings.api };');
  });

  // ---------------------------------------------------------------
  // MULTI-TENANT ISOLATION — webshop storefront & quản lý ngường dùng
  // ---------------------------------------------------------------

  it('tạo user ERP: super admin BẮT BUỘC chọn tenant, tenant admin bị khóa scope vào tenant của mình', () => {
    const src = readSource('src/api/saasRouter.ts');
    // Phân scope qua helper tập trung (unit-tested trong tests/userScope.test.ts)
    expect(src).toContain('resolveNewUserCompanyId(');
    // Handler POST /users không còn rơi ngầm vào company của super admin
    expect(src).not.toContain('const companyId = req.isSuperAdmin ? Number(body.company_id || req.companyId) : req.companyId;');
    // Gói dịch vụ giới hạn số tài khoản mỗi tenant
    expect(src).toContain("code: 'MAX_USERS_REACHED'");
    // Quy tắc scope nằm trong helper thuần
    const scope = readSource('src/utils/userScope.ts');
    expect(scope).toContain("code: 'TENANT_REQUIRED'");
    expect(scope).toContain('companyId: sessionCompanyId');
  });

  it('danh sách user ERP trả kèm tên doanh nghiệp + hỗ trợ lọc theo tenant (super admin)', () => {
    const src = readSource('src/api/saasRouter.ts');
    expect(src).toContain('c.name_vi as company_name');
    expect(src).toContain('LEFT JOIN companies c ON c.id = u.company_id');
    expect(src).toContain('req.query.company_id');
  });

  it('storefront không còn suy ra tenant từ localStorage (chống rò rỉ chéo tenant)', () => {
    const clientSrc = readSource('src/api/client.ts');
    // Header x-tenant-slug chỉ đến từ URL hiện tại (/shop/:slug hoặc ?tenant=)
    expect(clientSrc).not.toContain("localStorage.getItem('shop_tenant')");
    const ctx = readSource('src/contexts/ShopTenantContext.tsx');
    expect(ctx).not.toContain("localStorage.setItem('shop_tenant'");
  });

  it('menu ERP "Xem WebShop" trỏ đúng webshop của tenant (không còn root //)', () => {
    const sidebar = readSource('src/components/SaaSSidebar.tsx');
    expect(sidebar).not.toContain("path: '//'");
    expect(sidebar).toContain('webshop?.url');
  });

  it('trang Quản lý Doanh nghiệp không còn hardcode URL localhost:3000', () => {
    const page = readSource('src/pages/saas/SaaSTenantsPage.tsx');
    expect(page).not.toContain('localhost:3000');
    expect(page).toContain('webshop_slug');
  });
});
