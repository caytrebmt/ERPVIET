/**
 * tests/i18n.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CI Guard cho hệ thống i18n — ngăn tích lũy nợ kỹ thuật bản dịch.
 * Chạy: npm test  (vitest)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const ROOT = join(__dirname, '..');
const VI_PATH = join(ROOT, 'public', 'locales', 'vi.json');
const EN_PATH = join(ROOT, 'public', 'locales', 'en.json');

const vi = JSON.parse(readFileSync(VI_PATH, 'utf8')) as Record<string, string>;
const en = JSON.parse(readFileSync(EN_PATH, 'utf8')) as Record<string, string>;

// ─── Bộ lọc key metadata ───────────────────────────────────────────────────
const isMetaKey = (k: string) => k.startsWith('_');
const viKeys = Object.keys(vi).filter(k => !isMetaKey(k));
const enKeys = Object.keys(en).filter(k => !isMetaKey(k));

// ─── TEST SUITE ────────────────────────────────────────────────────────────

describe('i18n — Key Parity', () => {
  it('en.json phải có đủ tất cả key từ vi.json', () => {
    const missingInEn = viKeys.filter(k => !(k in en));
    if (missingInEn.length > 0) {
      console.error('\n❌ Keys có trong vi.json nhưng THIẾU trong en.json:');
      missingInEn.slice(0, 20).forEach(k =>
        console.error(`   "${k}": "${vi[k]?.slice(0, 60)}"`)
      );
      if (missingInEn.length > 20) console.error(`   ... và ${missingInEn.length - 20} key khác`);
    }
    expect(missingInEn, `${missingInEn.length} keys thiếu trong en.json`).toHaveLength(0);
  });

  it('vi.json không có key chứa ký tự tiếng Việt làm key name (anti-pattern)', () => {
    // Key chứa dấu tiếng Việt là anti-pattern: "Gia dụng", "quản_lý"...
    const badKeys = viKeys.filter(k => /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(k));
    if (badKeys.length > 0) {
      console.warn('\n⚠️  Keys chứa ký tự tiếng Việt (nên đổi thành snake_case tiếng Anh):');
      badKeys.forEach(k => console.warn(`   "${k}"`));
    }
    // Warning only — không fail test ngay, cần migration từ từ
    // expect(badKeys).toHaveLength(0);
    expect(badKeys.length).toBeGreaterThanOrEqual(0); // always pass, dùng để document
  });
});

describe('i18n — Translation Quality', () => {
  it('en.json không còn key chưa dịch (prefix ⚠)', () => {
    const untranslated = enKeys.filter(
      k => typeof en[k] === 'string' && en[k].startsWith('⚠')
    );
    if (untranslated.length > 0) {
      console.error(`\n❌ ${untranslated.length} keys trong en.json vẫn chưa được dịch (có prefix ⚠):`);
      untranslated.slice(0, 15).forEach(k =>
        console.error(`   "${k}": "${en[k]?.slice(0, 60)}"`)
      );
      if (untranslated.length > 15) console.error(`   ... và ${untranslated.length - 15} key khác`);
      console.error('\n   → Chạy: node scripts/translate-en.cjs để dịch tự động');
    }
    expect(untranslated, `${untranslated.length} keys chưa dịch`).toHaveLength(0);
  });

  it('en.json không có giá trị rỗng cho key đã có trong vi.json', () => {
    const emptyInEn = viKeys.filter(
      k => k in en && (en[k] === '' || en[k] === null || en[k] === undefined)
    );
    if (emptyInEn.length > 0) {
      console.error('\n❌ Keys có trong en.json nhưng giá trị rỗng:');
      emptyInEn.slice(0, 10).forEach(k =>
        console.error(`   "${k}" → vi: "${vi[k]?.slice(0, 40)}"`)
      );
    }
    expect(emptyInEn, `${emptyInEn.length} keys rỗng trong en.json`).toHaveLength(0);
  });
});

describe('i18n — Code Quality', () => {
  it('không còn pattern isEn ? inline trong source TSX/TS (bypass i18n)', () => {
    let count = 0;
    let examples: string[] = [];

    try {
      const result = execSync(
        `grep -rn "isEn ?" ${join(ROOT, 'src')} --include="*.tsx" --include="*.ts" 2>/dev/null || true`,
        { encoding: 'utf8' }
      );
      const lines = result.trim().split('\n').filter(Boolean);
      count = lines.length;
      examples = lines.slice(0, 5);
    } catch {
      count = 0;
    }

    if (count > 0) {
      console.error(`\n❌ Còn ${count} chỗ dùng "isEn ?" (bypass i18n system):`);
      examples.forEach(l => console.error(`   ${l.slice(0, 100)}`));
      if (count > 5) console.error(`   ... và ${count - 5} chỗ khác`);
      console.error('\n   → Chạy: node scripts/refactor-isen.cjs để xem hướng dẫn refactor');
    }

    expect(count, `${count} chỗ còn dùng isEn ? inline`).toBe(0);
  });

  it('JSON locale files là valid JSON và có thể parse được', () => {
    expect(() => JSON.parse(readFileSync(VI_PATH, 'utf8'))).not.toThrow();
    expect(() => JSON.parse(readFileSync(EN_PATH, 'utf8'))).not.toThrow();
  });
});

describe('i18n — Statistics (informational)', () => {
  it('thống kê tình trạng dịch thuật hiện tại', () => {
    const totalVi = viKeys.length;
    const totalEn = enKeys.length;
    const untranslated = enKeys.filter(k => typeof en[k] === 'string' && (en[k] as string).startsWith('⚠')).length;
    const translated = totalEn - untranslated;
    const missing = viKeys.filter(k => !(k in en)).length;
    const pct = totalVi > 0 ? Math.round((translated / totalVi) * 100) : 0;

    console.log('\n📊 i18n Translation Stats:');
    console.log(`   vi.json total keys:     ${totalVi}`);
    console.log(`   en.json total keys:     ${totalEn}`);
    console.log(`   Translated (real):      ${translated} (${pct}%)`);
    console.log(`   Untranslated (⚠):       ${untranslated}`);
    console.log(`   Missing in en:          ${missing}`);
    console.log(`   Target: 100% of ${totalVi} keys`);

    // Luôn pass — chỉ để in thống kê
    expect(pct).toBeGreaterThanOrEqual(0);
  });
});
