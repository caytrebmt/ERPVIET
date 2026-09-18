'use strict';

/**
 * scripts/i18n-prune-and-flatten.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Dọn dẹp từ điển dịch thuật sau 2 tầng codemod:
 *
 *  1. FLATTEN — `public/locales/*.json` là map PHẲNG (i18n.ts đặt keySeparator=false).
 *     Các key lồng `date_filter.*` / `auth_web.*` vì thế không bao giờ resolve được,
 *     UI in ra đúng tên key thô. Script này đẩy chúng về key chấm phẳng.
 *
 *  2. BACKFILL — mọi key `t('…')` có trong code nhưng thiếu trong vi.json sẽ được
 *     thêm lại (kèm nhãn tiếng Việt + tiếng Anh) để UI không rơi về key thô.
 *
 *  3. PRUNE — key không còn `t('…')` nào tham chiếu VÀ chuỗi tiếng Việt của nó cũng
 *     không xuất hiện trong source (không còn dùng ở đâu) sẽ bị xóa khỏi vi/en/_groups.
 *     Đây là "key mồ côi" tích tụ từ các lần chạy scanner trước.
 *
 * CÁCH DÙNG:
 *   node scripts/i18n-prune-and-flatten.cjs           # báo cáo (dry-run)
 *   node scripts/i18n-prune-and-flatten.cjs --write    # ghi file
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALE_DIR = path.join(ROOT, 'public', 'locales');
const VI_PATH = path.join(LOCALE_DIR, 'vi.json');
const EN_PATH = path.join(LOCALE_DIR, 'en.json');
const WRITE = process.argv.includes('--write');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const vi = readJson(VI_PATH);
const en = readJson(EN_PATH);

/* ── 1. Flatten key lồng ─────────────────────────────────────────────── */

const FLAT_FALLBACK_EN = {
  'date_filter.label': 'Period:',
  'date_filter.presets.all': 'All',
  'date_filter.presets.today': 'Today',
  'date_filter.presets.seven_days': 'Last 7 days',
  'date_filter.presets.this_month': 'This month',
  'date_filter.presets.this_quarter': 'This quarter',
  'date_filter.presets.custom': 'Custom',
  'date_filter.custom_range.from': 'From:',
  'date_filter.custom_range.to': 'To:',
  'date_filter.actions.reset': 'Clear filter',
  'date_filter.actions.reset_tooltip': 'Reset time filter',
  'auth_web.showPassword': 'Show password',
  'auth_web.hidePassword': 'Hide password',
};

const flattenInto = (dict, out, prefix = '', nestedKeys = []) => {
  for (const [k, v] of Object.entries(dict)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenInto(v, out, `${prefix}${k}.`, nestedKeys);
      if (!prefix) nestedKeys.push(k);
    } else {
      const key = `${prefix}${k}`;
      if (!(key in out)) out[key] = v;
    }
  }
};

const viFlat = {};
const enFlat = {};
flattenInto(vi, viFlat);
flattenInto(en, enFlat);

const nestedTopKeys = [...new Set(Object.keys(viFlat).map((k) => (k.includes('.') ? k.split('.')[0] : null)).filter(Boolean))];
for (const top of nestedTopKeys) {
  delete viFlat[top];
  delete enFlat[top];
}
// chèn bản dịch EN chuẩn cho các key vừa flatten
for (const [k, v] of Object.entries(FLAT_FALLBACK_EN)) {
  if (k in viFlat) enFlat[k] = enFlat[k] && !`${enFlat[k]}`.startsWith('⚠') ? enFlat[k] : v;
}

/* ── 2. Backfill key dùng trong code nhưng thiếu trong từ điển ───────── */

const MISSING_KEYS = {
  product_contact_for_price: { vi: 'Liên hệ để báo giá', en: 'Contact us for price' },
  sidebar_suppliers: { vi: 'Nhà cung cấp', en: 'Suppliers' },
  sidebar_warehouse_locations: { vi: 'Địa điểm kho bãi', en: 'Warehouse Locations' },
  api_auth_google_login_success: { vi: 'Đăng nhập Google thành công!', en: 'Signed in with Google successfully!' },
  assets_status: { vi: 'Trạng thái', en: 'Status' },
  saas_web_orders_thanh_tien: { vi: 'Thành tiền', en: 'Amount' },
  nav_categories: { vi: 'Danh mục', en: 'Categories' },
};

for (const [k, v] of Object.entries(MISSING_KEYS)) {
  if (!(k in viFlat)) viFlat[k] = v.vi;
  if (!(k in enFlat) || `${enFlat[k]}`.startsWith('⚠') || !`${enFlat[k]}`.trim()) enFlat[k] = v.en;
}

/* ── 3. Prune key mồ côi ─────────────────────────────────────────────── */

const CODE_DIRS = ['src', 'netlify'];
let corpus = '';
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts|js|cjs|mjs)$/.test(e.name)) corpus += `${fs.readFileSync(p, 'utf8')}\n`;
  }
};
CODE_DIRS.forEach(walk);

const usedKeys = new Set();
for (const m of corpus.matchAll(/\bt\s*\(\s*['"`]([A-Za-z0-9_.-]{2,})['"`]/g)) usedKeys.add(m[1]);

const VI_CHARS = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
const isDead = (k) => {
  if (usedKeys.has(k)) return false;
  const v = viFlat[k];
  if (typeof v !== 'string') return true;
  // chuỗi tiếng Việt vẫn hardcode trong code → giữ lại làm key chờ nối
  if (VI_CHARS.test(v) && corpus.includes(v)) return false;
  return true;
};

const kept = {};
const removed = [];
for (const [k, v] of Object.entries(viFlat)) {
  if (isDead(k)) removed.push(k);
  else kept[k] = v;
}
const keptEn = {};
for (const k of Object.keys(kept)) keptEn[k] = enFlat[k];

/* _groups: metadata phân loại cho tab Dịch thuật — viết lại theo key còn sống */
const rebuildGroups = (groupsObj) => {
  const src = groupsObj && typeof groupsObj === 'object' ? groupsObj : {};
  const out = {};
  const seen = new Set();
  for (const [group, keys] of Object.entries(src)) {
    if (!Array.isArray(keys)) continue;
    const list = keys.filter((k) => kept[k] && !seen.has(k));
    list.forEach((k) => seen.add(k));
    if (list.length) out[group] = list;
  }
  const orphans = Object.keys(kept).filter((k) => !seen.has(k) && !k.startsWith('_'));
  if (orphans.length) out['Khác'] = [...(out['Khác'] || []), ...orphans];
  return out;
};

const groups = rebuildGroups(vi._groups);
const finalVi = { ...kept, _groups: groups };
const finalEn = { ...keptEn, _groups: groups };

/* ── Report ──────────────────────────────────────────────────────────── */

const before = Object.keys(vi).filter((k) => !k.startsWith('_') && typeof vi[k] === 'string').length;
const after = Object.keys(finalVi).length;
const stillUntranslated = Object.keys(finalEn).filter(
  (k) => k !== '_groups' && (typeof finalEn[k] !== 'string' || !finalEn[k].trim() || finalEn[k].startsWith('⚠')),
).length;

console.log(`\n🧹 i18n-prune-and-flatten — ${WRITE ? 'WRITE' : 'DRY-RUN'}`);
console.log(`   key VI trước: ${before}  →  sau: ${after}  (xóa ${removed.length} key mồ côi)`);
console.log(`   key lồng đã làm phẳng: ${Object.keys(FLAT_FALLBACK_EN).length}`);
console.log(`   backfill key thiếu: ${Object.keys(MISSING_KEYS).length}`);
console.log(`   key EN chưa dịch (cần dịch): ${stillUntranslated}`);
if (removed.length) console.log(`   ví dụ key xóa: ${removed.slice(0, 10).join(', ')}`);

fs.writeFileSync('/tmp/i18n-untranslated.txt', Object.entries(finalEn).filter(([k, v]) => k !== '_groups' && (typeof v !== 'string' || !v.trim() || v.startsWith('⚠'))).map(([k]) => `${k}\t${finalVi[k]}`).join('\n'));

if (WRITE) {
  fs.writeFileSync(VI_PATH, `${JSON.stringify(finalVi, null, 2)}\n`);
  fs.writeFileSync(EN_PATH, `${JSON.stringify(finalEn, null, 2)}\n`);
  console.log('   ✅ đã ghi public/locales/vi.json + en.json');
}
