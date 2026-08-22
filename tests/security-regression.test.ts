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
});
