'use strict';

/**
 * scripts/refactor-lang-ternary.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Codemod nối các tam phân chọn ngôn ngữ (UI copy) vào hệ thống i18n thật:
 *
 *   isEn ? 'Copy URL' : 'Sao chép URL'            → t('sao_chep_url', 'Sao chép URL')
 *   language === 'en' ? 'A' : 'B'                 → t('b', 'B')
 *   isEn ? `Up ${plan}` : `Đã nâng cấp ${plan}`   → t('key', 'Đã nâng cấp {{plan}}', { plan })
 *   isEn ? 'en-US' : 'vi-VN'                      → getIntlLocale(isEn)              (Intl locale, không phải bản dịch)
 *   isEn ? row.name_en : row.name_vi               → pickLocalized(isEn, ..., ...)   (trường song ngữ trong DB)
 *
 * Nguyên tắc:
 *  - Chỉ đụng vào tam phân nằm SAU vị trí khai báo `t` trong component (đảm bảo `t` có thật trong scope).
 *  - Tái sử dụng key đã có trong vi.json khi chuỗi tiếng Việt khớp chính xác → biến "key mồ côi" thành key sống.
 *  - Không tự bịa bản dịch tiếng Anh: EN lấy ngay từ nhánh tiếng Anh mà dev đã viết trong code.
 *  - Mọi replacement đều bản ghi (file, line, key, vi, en) để review.
 *
 * CÁCH DÙNG:
 *   node scripts/refactor-lang-ternary.cjs            # dry-run, in báo cáo + ghi /tmp/i18n-plan.json
 *   node scripts/refactor-lang-ternary.cjs --write     # áp dụng + cập nhật vi.json/en.json
 *   node scripts/refactor-lang-ternary.cjs --write --files=src/pages/saas/SaaSProductsPage.tsx
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const LOCALE_DIR = path.join(ROOT, 'public', 'locales');
const VI_PATH = path.join(LOCALE_DIR, 'vi.json');
const EN_PATH = path.join(LOCALE_DIR, 'en.json');

const WRITE = process.argv.includes('--write');
const FILES_ARG = (process.argv.find((a) => a.startsWith('--files=')) || '').split('=')[1];
const TARGET_DIRS = ['src/pages', 'src/components', 'src/layouts'];

/* ───────────────────────── helpers ───────────────────────── */

const removeTones = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const norm = (s) => removeTones(String(s || '')).replace(/\s+/g, ' ').trim().toLowerCase();

const VI_CHAR = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
const LOCALE_CODE = /^(en|vi|en[-_]us|vi[-_]vn|en[-_]gb)$/i;

/** Escape a text so it can be embedded in a single-quoted JS string literal. */
const jsQuote = (text) => `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')}'`;

function keyFromText(viText, enText) {
  const strip = (v) =>
    String(v || '')
      .replace(/\{\{[^}]*\}\}/g, ' ')
      .replace(/\$\{[^}]*\}/g, ' ');
  const base = removeTones(`${strip(viText)} ${strip(enText)}`.trim())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    // bỏ các token do placeholder sinh ra (value1, v2…)
    .replace(/(^|_)(value\d+|v\d+|count\d*)(?=_|$)/g, '_')
    .replace(/^_+|_+$/g, '');
  const words = base.split('_').filter(Boolean);
  if (!words.length) return '';
  let key = words.slice(0, 5).join('_');
  if (key.length > 44) key = key.slice(0, 44).replace(/_+$/, '');
  if (!/^[a-z][a-z0-9_]*$/.test(key)) return '';
  return key;
}

/** Bản dịch chỉ có nghĩa khi có chữ cái; chuỗi toàn số/ký tự → không đưa vào từ điển. */
const hasLetters = (v) => /[\p{L}]/u.test(String(v || '').replace(/\{\{[^}]*\}\}/g, ''));

/* ───────────────────────── locale state ───────────────────────── */

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const vi = readJson(VI_PATH);
const en = readJson(EN_PATH);

/** normalized VI text -> existing key. Cho phép tái sử dụng "key mồ côi" đã có sẵn bản dịch. */
const viIndex = new Map();
for (const [k, v] of Object.entries(vi)) {
  if (k.startsWith('_') || typeof v !== 'string') continue;
  const n = norm(v);
  if (n && !viIndex.has(n)) viIndex.set(n, k);
}

const isUntranslated = (v) => typeof v !== 'string' || v.trim() === '' || v.startsWith('⚠') || norm(v) === '';

const newVi = {};
const newEn = {};
const taken = new Set([...Object.keys(vi), ...Object.keys(en)]);

function claimKey(preferred, viText, enText) {
  const fallback = `ui_${Buffer.from(String(viText || enText || 'label')).toString('base64url').slice(0, 8).replace(/[^a-z0-9]/gi, 'x').toLowerCase()}`;
  let key = preferred || fallback;
  if (taken.has(key)) {
    // cùng cặp VI+EN => dùng lại key đã có
    if (vi[key] === viText) return key;
    let i = 2;
    while (taken.has(`${key}_${i}`)) i += 1;
    key = `${key}_${i}`;
  }
  taken.add(key);
  if (!(key in vi)) newVi[key] = viText;
  if (!(key in en) || isUntranslated(en[key])) newEn[key] = enText || viText;
  return key;
}

/* ───────────────────────── file analysis ───────────────────────── */

function collectFiles() {
  if (FILES_ARG) return FILES_ARG.split(',').map((f) => path.resolve(ROOT, f.trim()));
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) out.push(p);
    }
  };
  TARGET_DIRS.forEach((d) => walk(path.join(ROOT, d)));
  return out;
}

/** Find `<test> ? a : b` where <test> is a language switch we recognize. */
function languageTest(expr, sf) {
  if (!expr) return null;
  if (ts.isParenthesizedExpression(expr)) return languageTest(expr.expression, sf);
  if (ts.isIdentifier(expr) && expr.text === 'isEn') return { positive: true, text: 'isEn' };
  if (ts.isBinaryExpression(expr)) {
    const k = expr.operatorToken.kind;
    const isEq = k === ts.SyntaxKind.EqualsEqualsToken || k === ts.SyntaxKind.EqualsEqualsEqualsToken;
    const isNe = k === ts.SyntaxKind.ExclamationEqualsToken || k === ts.SyntaxKind.ExclamationEqualsEqualsToken;
    if (!isEq && !isNe) return null;
    const nameOf = (n) => (ts.isIdentifier(n) ? n.text : null);
    const litOf = (n) => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : null);
    const lname = nameOf(expr.left);
    const rname = nameOf(expr.right);
    const lstr = litOf(expr.left);
    const rstr = litOf(expr.right);
    const hits = (lname === 'language' && rstr === 'en') || (rname === 'language' && lstr === 'en');
    if (hits) return { positive: isEq, text: expr.getText(sf) };
  }
  return null;
}

const plainString = (node, sf) => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) {
    // chỉ nhận template có nội dung "tĩnh" (không có ${})
    if (node.head.spans && node.head.spans.length === 0 && !node.templateSpans.length) return node.head.text;
  }
  return null;
};

/** Tách template literal thành [text, expr, text, …] theo đúng AST của TypeScript. */
function templateParts(node, sf) {
  const parts = [{ type: 'text', text: node.head.text }];
  for (const span of node.templateSpans) {
    parts.push({ type: 'expr', expr: span.expression.getText(sf).trim() });
    parts.push({ type: 'text', text: span.literal.text });
  }
  return parts;
}

/** Tên biến nội suy: lấy định danh cuối cùng của biểu thức (a.b || a.c -> c). */
function varNameOf(exprText, used, idx) {
  const idents = String(exprText).match(/[A-Za-z_$][A-Za-z0-9_$]*/g) || [];
  let name = idents.length ? idents[idents.length - 1] : '';
  name = removeTones(name).replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  if (!name || /^\d/.test(name) || name.length > 20) name = `value${idx + 1}`;
  let unique = name;
  let i = 2;
  while (used.has(unique)) unique = `${name}${i++}`;
  used.add(unique);
  return unique;
}

function buildTemplate(node, sf) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, vars: [] };
  }
  if (!ts.isTemplateExpression(node)) return null;
  let out = '';
  const vars = [];
  const used = new Set();
  for (const p of templateParts(node, sf)) {
    if (p.type === 'text') out += p.text;
    else {
      if (/[\r\n]/.test(p.expr) || p.expr.includes('`')) return null; // biểu thức phức tạp -> để dev xử lý
      const name = varNameOf(p.expr, used, vars.length);
      vars.push({ name, expr: p.expr });
      out += `{{${name}}}`;
    }
  }
  return { text: out.replace(/\s+/g, ' ').trim(), vars };
}

function sameVarShape(a, b) {
  if (!a || !b) return false;
  if (a.vars.length !== b.vars.length) return false;
  return a.vars.every((v, i) => v.name === b.vars[i].name);
}

const report = [];
let filesChanged = 0;

for (const filePath of collectFiles()) {
  const rel = path.relative(ROOT, filePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const fullText = sf.getFullText();

  // 1) vị trí mà `t` bắt đầu có trong scope
  let tAvailableAt = -1;
  let tSource = null;
  const findT = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      const init = node.initializer;
      const callName = init && ts.isCallExpression(init) ? init.expression.getText(sf) : '';
      if (callName === 'useLanguage' || callName === 'useTranslation') {
        const names = node.name.elements.map((e) => (e.propertyName ? e.propertyName.getText(sf) : e.name.getText(sf)));
        if (names.includes('t')) {
          tAvailableAt = node.getEnd();
          tSource = callName;
        }
      }
    }
    ts.forEachChild(node, findT);
  };
  findT(sf);
  if (tAvailableAt === -1) {
    // có dùng hook nhưng chưa lấy `t` → sẽ chèn thêm vào destructure
    const hookMatch = fullText.match(/const\s*\{([^}]*)\}\s*=\s*useLanguage\(\)/);
    if (hookMatch) {
      tAvailableAt = fullText.indexOf(hookMatch[0]) + hookMatch[0].length;
      tSource = 'useLanguage-needs-t';
    }
  }
  if (tAvailableAt === -1) {
    const candidates = (fullText.match(/isEn \?|language === 'en' \?/g) || []).length;
    if (candidates) report.push({ file: rel, skipped: 'no-t-in-scope', candidates });
    continue;
  }

  // 2) tìm mọi tam phân chọn ngôn ngữ sau vị trí đó
  const edits = [];
  const visit = (node) => {
    if (ts.isConditionalExpression(node) && node.getStart(sf) > tAvailableAt) {
      const test = languageTest(node.condition, sf);
      if (test) {
        const enNode = test.positive ? node.whenTrue : node.whenFalse;
        const viNode = test.positive ? node.whenFalse : node.whenTrue;
        const enLit = plainString(enNode, sf);
        const viLit = plainString(viNode, sf);
        const enTpl = buildTemplate(enNode, sf);
        const viTpl = buildTemplate(viNode, sf);

        if (
          enLit !== null &&
          viLit !== null &&
          !LOCALE_CODE.test(enLit.trim()) &&
          !LOCALE_CODE.test(viLit.trim()) &&
          (hasLetters(viLit) || hasLetters(enLit))
        ) {
          // (a) chuỗi tĩnh thuần UI → t(key, 'VI')
          const existing = viIndex.get(norm(viLit));
          let key = null;
          if (existing && (isUntranslated(en[existing]) || norm(en[existing]) === norm(enLit) || en[existing] === viLit)) {
            key = existing;
            if (isUntranslated(en[key])) newEn[key] = enLit;
            if (!(key in vi)) newVi[key] = viLit;
          } else {
            key = claimKey(keyFromText(viLit, enLit), viLit, enLit);
            if (key && !viIndex.has(norm(viLit))) viIndex.set(norm(viLit), key);
          }
          if (key) {
            edits.push({
              start: node.getStart(sf),
              end: node.getEnd(),
              replacement: `t(${jsQuote(key)}, ${jsQuote(viLit)})`,
              kind: 'literal',
              key,
              vi: viLit,
              en: enLit,
              line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            });
          }
        } else if (
          enLit !== null && viLit !== null && LOCALE_CODE.test(enLit.trim()) && LOCALE_CODE.test(viLit.trim())
        ) {
          // (b) mã Intl locale, không phải bản dịch
          edits.push({
            start: node.getStart(sf),
            end: node.getEnd(),
            replacement: `getIntlLocale(${test.text})`,
            kind: 'intl',
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          });
        } else if (enTpl && viTpl && sameVarShape(enTpl, viTpl) && (hasLetters(viTpl.text) || hasLetters(enTpl.text))) {
          // (c) chuỗi có nội suy → t(key, 'VI {{v}}', { v })
          const key = claimKey(keyFromText(viTpl.text, enTpl.text), viTpl.text, enTpl.text);
          if (key) {
            const varList = viTpl.vars.map((v) => `${v.name}: ${v.expr}`).join(', ');
            edits.push({
              start: node.getStart(sf),
              end: node.getEnd(),
              replacement: varList
                ? `t(${jsQuote(key)}, ${jsQuote(viTpl.text)}, { ${varList} })`
                : `t(${jsQuote(key)}, ${jsQuote(viTpl.text)})`,
              kind: 'interpolation',
              key,
              vi: viTpl.text,
              en: enTpl.text,
              line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            });
          }
        } else {
          // (d) chọn trường dữ liệu song ngữ (name_en/name_vi…) → helper tập trung
          edits.push({
            start: node.getStart(sf),
            end: node.getEnd(),
            replacement: `pickLocalized(${test.text}, ${enNode.getText(sf)}, ${viNode.getText(sf)})`,
            kind: 'datafield',
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  // loại edit chồng lấn: node cha được xử lý trước, node con bị loại
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let cursor = -1;
  for (const e of edits) {
    if (e.start >= cursor) {
      kept.push(e);
      cursor = e.end;
    }
  }
  edits.length = 0;
  edits.push(...kept);

  if (!edits.length) continue;

  const counts = edits.reduce((a, e) => ({ ...a, [e.kind]: (a[e.kind] || 0) + 1 }), {});
  report.push({ file: rel, total: edits.length, ...counts });
  filesChanged += 1;

  if (!WRITE) continue;

  // 3) áp dụng edits từ cuối file lên đầu
  let outText = fullText;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    outText = outText.slice(0, e.start) + e.replacement + outText.slice(e.end);
  }

  // 4) đảm bảo `t` có trong scope (thêm vào destructure hiện có, giữ nguyên format nhiều dòng)
  const hasT = /const\s*\{[^}]*\bt\b[^}]*\}\s*=\s*use(Language|Translation)\(\)/.test(outText);
  if (!hasT) {
    const hookRe = /const\s*\{([^}]*)\}\s*=\s*useLanguage\(\)/;
    const m = outText.match(hookRe);
    if (m) {
      outText = m[1].includes('\n')
        ? outText.replace(hookRe, (full, inner) => full.replace(`{${inner}`, `{${inner.trimStart() ? `${inner.replace(/\s*$/, '')}\n    t,` : 't, '}`))
        : outText.replace(hookRe, (full, inner) => {
            const parts = inner.split(',').map((x) => x.trim()).filter(Boolean);
            parts.push('t');
            return `const { ${parts.join(', ')} } = useLanguage()`;
          });
    } else {
      // file chỉ dùng useTranslation: `t` đã có qua react-i18next, hoặc chèn mới sau dòng import
      const importEnd = outText.lastIndexOf('\nimport ');
      const lineEnd = outText.indexOf('\n', importEnd + 1);
      outText = `${outText.slice(0, lineEnd + 1)}\nconst { t } = useTranslation();${outText.slice(lineEnd + 1)}`;
      if (!/from 'react-i18next'/.test(outText)) {
        outText = `import { useTranslation } from 'react-i18next';\n${outText}`;
      }
    }
  }

  // 5) chèn import helper (nếu dùng) — đặt SAU statement import cuối cùng, an toàn với import nhiều dòng
  const needsIntl = edits.some((e) => e.kind === 'intl');
  const needsPick = edits.some((e) => e.kind === 'datafield');
  if ((needsIntl || needsPick) && !/from '[^']*utils\/localized'/.test(outText)) {
    const sf2 = ts.createSourceFile(filePath, outText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
    let insertAt = 0;
    const visitImport = (node) => {
      if (ts.isImportDeclaration(node)) insertAt = Math.max(insertAt, node.getEnd());
      ts.forEachChild(node, visitImport);
    };
    visitImport(sf2);
    if (!insertAt) {
      const m = outText.match(/^(\/\/[^\n]*\n)?/);
      insertAt = m ? m[0].length : 0;
    }
    let relImport = path.relative(path.dirname(filePath), path.join(ROOT, 'src', 'utils', 'localized')).split(path.sep).join('/');
    if (!relImport.startsWith('.')) relImport = `./${relImport}`;
    const names = [needsIntl ? 'getIntlLocale' : '', needsPick ? 'pickLocalized' : ''].filter(Boolean).join(', ');
    const nl = outText.indexOf('\n', insertAt);
    outText = `${outText.slice(0, nl + 1)}import { ${names} } from '${relImport}';\n${outText.slice(nl + 1)}`;
  }

  fs.writeFileSync(filePath, outText);
}

/* ───────────────────────── locale file update ───────────────────────── */

if (WRITE && (Object.keys(newVi).length || Object.keys(newEn).length)) {
  const groupsForFile = {}; // best-effort group assignment (metadata used by /api/saas/locales)
  const finalVi = { ...vi, ...newVi };
  const finalEn = { ...en, ...newEn };
  if (finalVi._groups) {
    for (const k of Object.keys(newVi)) {
      if (!finalVi._groups['Khác']) finalVi._groups['Khác'] = [];
      if (!finalVi._groups['Khác'].includes(k)) finalVi._groups['Khác'].push(k);
      if (finalEn._groups) {
        if (!finalEn._groups['Khác']) finalEn._groups['Khác'] = [];
        if (!finalEn._groups['Khác'].includes(k)) finalEn._groups['Khác'].push(k);
      }
    }
  }
  fs.writeFileSync(VI_PATH, `${JSON.stringify(finalVi, null, 2)}\n`);
  fs.writeFileSync(EN_PATH, `${JSON.stringify(finalEn, null, 2)}\n`);
}

/* ───────────────────────── report ───────────────────────── */

console.log(`\n🔧 refactor-lang-ternary — ${WRITE ? 'WRITE' : 'DRY-RUN'}`);
console.log(`   files with edits: ${filesChanged}`);
const totals = report.reduce(
  (a, r) => {
    for (const k of ['literal', 'interpolation', 'intl', 'datafield', 'skipped']) if (r[k]) a[k] = (a[k] || 0) + r[k];
    return a;
  },
  {},
);
console.log(`   ${JSON.stringify(totals)}`);
console.log(`   new vi keys: ${Object.keys(newVi).length} | new/filled en keys: ${Object.keys(newEn).length}`);
for (const r of report) console.log(`   ${r.file}: ${JSON.stringify(r)}`);
if (WRITE) console.log(`   ${JSON.stringify({ newVi, newEn }, null, 1).slice(0, 100)} …(đã ghi vào public/locales)`);
fs.writeFileSync('/tmp/i18n-plan.json', JSON.stringify({ report, newVi, newEn }, null, 1));
console.log('   📋 /tmp/i18n-plan.json');
