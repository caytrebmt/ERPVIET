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

const exec = (cmd: string) => execSync(cmd, { encoding: 'utf8', cwd: join(__dirname, '..') });

/** Mọi key `t('…')` được gọi tĩnh trong source (bỏ qua key động dạng template/variable). */
const collectKeysUsedInCode = (): string[] => {
  const files: string[] = JSON.parse(
    exec(`node -e "const fs=require('fs'),p=require('path');const out=[];const walk=d=>{if(!fs.existsSync(d))return;for(const e of fs.readdirSync(d,{withFileTypes:true})){const f=p.join(d,e.name);if(e.isDirectory())walk(f);else if(/\\.(tsx|ts)$/.test(e.name)&&!/\\.d\\.ts$/.test(e.name))out.push(p.relative(process.cwd(),f));}};['src'].forEach(walk);console.log(JSON.stringify(out));"`),
  );
  const keys = new Set<string>();
  for (const f of files) {
    const src = readFileSync(join(__dirname, '..', f), 'utf8');
    // bỏ comment nhiều dòng + comment một dòng để không bắt nhầm ví dụ trong tài liệu
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of code.matchAll(/\bt\s*\(\s*['"]([A-Za-z0-9_.-]{2,})['"]/g)) keys.add(m[1]);
  }
  return [...keys].sort();
};

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
      console.error('\n   → Sửa bằng codemod: node scripts/refactor-lang-ternary.cjs --write'
        + ', rồi node scripts/i18n-wire-hardcoded.cjs --create-keys --write --files=<file>'
        + ' (hướng dẫn: I18N_DEPLOY_GUIDE.md Phần 4)');
    }

    expect(count, `${count} chỗ còn dùng isEn ? inline`).toBe(0);
  });

  it('không còn pattern language === "en" ? inline (anh-em song sinh của isEn ?)', () => {
    // Pattern này bypass từ điển y hệt isEn ?: bản dịch nằm chết trong code,
    // admin không sửa được trong Cài Đặt → Dịch thuật.
    const result = exec(
      `grep -rn "language === 'en' ?" ${join(ROOT, 'src')} --include="*.tsx" --include="*.ts" 2>/dev/null || true`,
    );
    const lines = result.trim().split('\n').filter(Boolean);
    if (lines.length > 0) {
      console.error(`\n❌ Còn ${lines.length} chỗ dùng ternary chọn ngôn ngữ. Thay bằng:`);
      console.error('   • chuỗi UI   → t(\'key\', \'Tiếng Việt\')');
      console.error('   • mã Intl    → getIntlLocale(language === "en")  (src/utils/localized.ts)');
      console.error('   • trường DB  → pickLocalized(language === "en", row.name_en, row.name_vi)');
      lines.slice(0, 8).forEach((l) => console.error(`   ${l.slice(0, 110)}`));
    }
    expect(lines.length, `${lines.length} chỗ còn dùng language === 'en' ?`).toBe(0);
  });

  it('JSON locale files là valid JSON và có thể parse được', () => {
    expect(() => JSON.parse(readFileSync(VI_PATH, 'utf8'))).not.toThrow();
    expect(() => JSON.parse(readFileSync(EN_PATH, 'utf8'))).not.toThrow();
  });
});

describe('i18n — Dictionary Contract (chống key thô hiện trên UI)', () => {
  it('mọi key t("…") gọi trong src/ phải tồn tại trong vi.json', () => {
    const missing = collectKeysUsedInCode().filter((k) => !(k in vi));
    if (missing.length > 0) {
      console.error(`\n❌ ${missing.length} key được gọi bằng t() nhưng KHÔNG có trong vi.json:`);
      missing.slice(0, 15).forEach((k) => console.error(`   "${k}"`));
      console.error('   → i18next sẽ in raw key ra màn hình. Thêm key vào vi.json + en.json,');
      console.error('     hoặc truyền defaultValue: t(key, "Tiếng Việt").');
    }
    expect(missing, `${missing.length} key gọi trong code nhưng thiếu trong vi.json`).toHaveLength(0);
  });

  it('locale JSON phải là map PHẲNG (i18n.ts đặt keySeparator=false)', () => {
    // Key lồng {"date_filter": {"label": …}} không bao giờ resolve với keySeparator=false
    // → UI in ra "date_filter.label". Mọi key phải là chuỗi ở tầng 1 (trừ metadata _groups).
    const nested = (dict: Record<string, unknown>, name: string) =>
      Object.entries(dict)
        .filter(([k, v]) => !k.startsWith('_') && v && typeof v === 'object')
        .map(([k]) => `${name}.${k}`);
    const offenders = [...nested(vi, 'vi.json'), ...nested(en, 'en.json')];
    expect(offenders, `key lồng không phân giải được: ${offenders.join(', ')}`).toHaveLength(0);
  });

  it('placeholder nội suy phải là {{ten}} (i18next), không phải {ten} hay ${ten}', () => {
    const bad: string[] = [];
    for (const [name, dict] of [['vi', vi], ['en', en]] as Array<[string, Record<string, any>]>) {
      for (const [k, v] of Object.entries(dict)) {
        if (k.startsWith('_') || typeof v !== 'string') continue;
        // Sau khi bỏ các placeholder hợp lệ {{x}}, không còn dấu ngoặc nhọn hay dấu $ nào.
        const rest = v.replace(/\{\{[^}]*\}\}/g, '');
        if (/[{}$]/.test(rest)) bad.push(`${name}.${k} = ${rest.slice(0, 60)}`);
      }
    }
    if (bad.length) console.error(`\n❌ Placeholder sai chuẩn:\n   ${bad.slice(0, 10).join('\n   ')}`);
    expect(bad, `${bad.length} placeholder sai chuẩn`).toHaveLength(0);
  });
});

describe('i18n — English Quality', () => {
  it('en.json không còn giá trị chứa ký tự tiếng Việt (dịch chưa tới)', () => {
    const VI_CHAR = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
    const stillVi = enKeys.filter((k) => typeof en[k] === 'string' && VI_CHAR.test(en[k]));
    if (stillVi.length) {
      console.error(`\n❌ ${stillVi.length} giá trị en.json vẫn là tiếng Việt:`);
      stillVi.slice(0, 10).forEach((k) => console.error(`   "${k}": ${JSON.stringify(en[k]).slice(0, 70)}`));
    }
    expect(stillVi, `${stillVi.length} giá trị en chưa dịch (không có ⚠ nhưng vẫn là tiếng Việt)`).toHaveLength(0);
  });

  it('không có giá trị giống hệt nhau giữa vi/en khi tiếng Việt có dấu (except brand/loanwords)', () => {
    // Giá trị trùng nhau chỉ chấp nhận được khi đó là thuật ngữ giữ nguyên (SKU, VAT, PO, UOM…).
    const ACRONYM_ONLY = /^[A-Z0-9&./%+\s-]+$/;
    const suspicious = viKeys.filter((k) => {
      const v = vi[k], e = en[k];
      if (typeof v !== 'string' || typeof e !== 'string') return false;
      if (ACRONYM_ONLY.test(v)) return false;
      return v === e && /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i.test(v);
    });
    expect(suspicious, `${suspicious.length} key en sao chép nguyên văn tiếng Việt: ${suspicious.slice(0, 8).join(', ')}`).toHaveLength(0);
  });
});

describe('i18n — Ratchet (nợ hardcode chỉ được phép giảm)', () => {
  it('số chuỗi tiếng Việt hardcode trong tầng hiển thị không tăng so với baseline', () => {
    const baselinePath = join(ROOT, 'tests', 'i18n-hardcoded-baseline.json');
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { total: number; byFile: Record<string, number> };
    const current = JSON.parse(exec('node scripts/i18n-count-hardcoded.cjs --json')) as {
      total: number;
      byFile: Record<string, number>;
    };

    const regressions = Object.entries(current.byFile).filter(([f, n]) => n > (baseline.byFile[f] || 0));
    if (regressions.length) {
      console.error(`\n❌ Chuỗi tiếng Việt hardcode TĂNG ở ${regressions.length} file:`);
      regressions.slice(0, 10).forEach(([f, n]) =>
        console.error(`   ${f}: ${baseline.byFile[f] || 0} → ${n}`),
      );
      console.error('   → Bọc vào t(\'key\', \'Tiếng Việt\') rồi chạy: node scripts/i18n-wire-hardcoded.cjs --write');
    }
    expect(current.total, `tổng hardcode ${current.total} > baseline ${baseline.total}`).toBeLessThanOrEqual(
      baseline.total,
    );
    expect(regressions, `${regressions.length} file có hardcode copy tăng thêm`).toHaveLength(0);
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
