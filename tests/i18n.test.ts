import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('i18n bootstrap — no flash of translation keys', () => {
  it('i18n.ts bundle locale JSON đồng bộ, không init bằng resources rỗng', () => {
    const src = readSource('src/i18n.ts');
    expect(src).toMatch(/from ["']\.\.\/public\/locales\/vi\.json["']/);
    expect(src).toMatch(/from ["']\.\.\/public\/locales\/en\.json["']/);
    expect(src).toMatch(/initAsync:\s*false/);
    expect(src).not.toMatch(/resources:\s*\{\s*en:\s*\{\s*translation:\s*\{\s*\}/);
    expect(src).not.toContain('cache: "no-store"');
    expect(src).not.toContain("cache: 'no-store'");
  });

  it('LanguageContext không fetch locale trên mọi lần mount', () => {
    const src = readSource('src/contexts/LanguageContext.tsx');
    expect(src).not.toContain('cache: "no-store"');
    expect(src).not.toMatch(/useEffect\(\(\) => \{\s*loadLocaleTranslations\(\)/);
    expect(src).not.toContain('saas_translation_dictionary');
  });

  it('index.html không còn chặn mọi trang bằng Google GSI', () => {
    const html = readSource('index.html');
    expect(html).not.toContain('accounts.google.com/gsi/client');
    expect(html).toContain('i18n-pending');
  });

  it('t() trả về bản dịch, không trả raw key sau khi init', async () => {
    const i18n = (await import('../src/i18n')).default;
    expect(i18n.isInitialized).toBe(true);

    const viHeading = i18n.t('saas_login_heading');
    expect(viHeading).toBeTruthy();
    expect(viHeading).not.toBe('saas_login_heading');

    const viLogin = i18n.t('dang-nhap');
    expect(viLogin).not.toBe('dang-nhap');

    const viCatalog = i18n.t('catalog_all_products');
    expect(viCatalog).not.toBe('catalog_all_products');

    await i18n.changeLanguage('en');
    const enHeading = i18n.t('saas_login_heading');
    expect(enHeading).toBeTruthy();
    expect(enHeading).not.toBe('saas_login_heading');

    await i18n.changeLanguage('vi');
  });

  it('en.json và vi.json có các key trang login / webshop', () => {
    const vi = JSON.parse(readSource('public/locales/vi.json'));
    const en = JSON.parse(readSource('public/locales/en.json'));
    const required = [
      'saas_login_heading',
      'saas_login_button',
      'saas_login_username_label',
      'dang-nhap',
      'dang-nhap-tai-khoan',
      'catalog_all_products',
      'nav_login',
    ];
    for (const key of required) {
      expect(vi[key], `thiếu vi key ${key}`).toBeTruthy();
      expect(typeof vi[key]).toBe('string');
      expect(en[key], `thiếu en key ${key}`).toBeTruthy();
    }
  });
});
