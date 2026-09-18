'use strict';

/**
 * scripts/i18n-wire-hardcoded.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Tầng 2 của chiến dịch i18n: thay CHUỖI TIẾNG VIỆT CÒN HARDCODE trong giao diện
 * bằng `t(key, 'Tiếng Việt')`, **tái sử dụng key đã có sẵn trong vi.json**.
 *
 * Vì sao an toàn:
 *  - Chỉ đụng vào vị trí hiển thị cho người dùng, phân tích bằng AST TypeScript:
 *      • JSX text node            →  {"Thêm mới"}  →  {t('them_moi', 'Thêm mới')}
 *      • thuộc tính UI (whitelist) →  placeholder="…" → placeholder={t('…', '…')}
 *  - Chỉ thay khi chuỗi khớp CHÍNH XÁC (bỏ dấu + hoa/thường) với giá trị `vi` của
 *    một key đã có trong từ điển → không sinh key mới, không tự bịa bản dịch.
 *  - Không đụng: className/value/id/type/href/to/path/đường dẫn API/chuỗi so sánh
 *    (status === 'CHO_DUYET'), nhãn dữ liệu do tenant nhập.
 *
 * CÁCH DÙNG:
 *   node scripts/i18n-wire-hardcoded.cjs            # dry-run + /tmp/i18n-wire-plan.json
 *   node scripts/i18n-wire-hardcoded.cjs --write     # áp dụng
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const VI_PATH = path.join(ROOT, 'public', 'locales', 'vi.json');
const WRITE = process.argv.includes('--write');
/** --create-keys: với chuỗi UI chưa có trong từ điển → sinh key mới (vi = nguyên văn, en = '' để dịch sau). */
const CREATE_KEYS = process.argv.includes('--create-keys');
const NEW_KEYS_PATH = '/tmp/i18n-new-keys.json';
const FILES_ARG = (process.argv.find((a) => a.startsWith('--files=')) || '').split('=')[1];

/** Thuộc tính chỉ ảnh hưởng tới văn bản hiển thị → được phép bọc t(). */
const UI_ATTRS = new Set([
  'label', 'placeholder', 'title', 'alt', 'aria-label', 'tooltip', 'description',
  'helper', 'helpertext', 'emptytext', 'searchplaceholder', 'buttontext', 'errortext',
  'confirmtext', 'canceltext', 'heading', 'subtitle', 'caption', 'legend',
]);
/** Thuộc tính KHÔNG được dịch (dữ liệu / định danh / style). */
const NEVER_ATTRS = new Set(['className', 'class', 'value', 'defaultValue', 'id', 'htmlFor', 'type', 'key', 'ref', 'href', 'to', 'src', 'width', 'height', 'size', 'variant', 'color', 'path', 'columns', 'accessorKey', 'idField', 'parentid', 'field', 'datakey', 'valuefield', 'route', 'icon', 'index']);

const removeTones = (s) =>
  String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const norm = (s) => removeTones(s).replace(/\s+/g, ' ').trim().toLowerCase();
const hasLetters = (s) => /[a-zA-ZàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀ-Ỹ]/.test(String(s));
const jsQuote = (t) => `'${String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')}'`;
/** Cần >= 3 ký tự chữ: loại 'đ' (đơn vị tiền), ký hiệu, số. */
const isProse = (s) => hasLetters(s) && String(s).replace(/[^A-Za-z\u00C0-\u1EF9]/g, '').length >= 3;

const slugOf = (text) => {
  const base = removeTones(String(text).replace(/\{\{[^}]*\}\}/g, ' '))
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .replace(/(^|_)(value\d+|v\d+)(?=_|$)/g, '_').replace(/^_+|_+$/g, '');
  const words = base.split('_').filter(Boolean);
  if (!words.length) return '';
  let key = words.slice(0, 5).join('_');
  if (key.length > 44) key = key.slice(0, 44).replace(/_+$/, '');
  return /^[a-z][a-z0-9_]*$/.test(key) ? key : '';
};

const vi = JSON.parse(fs.readFileSync(VI_PATH, 'utf8'));
const byViText = new Map();
for (const [k, v] of Object.entries(vi)) {
  if (k.startsWith('_') || typeof v !== 'string') continue;
  const n = norm(v);
  if (n && !byViText.has(n)) byViText.set(n, k);
}

/** Văn bản của StringLiteral / NoSubstitutionTemplate (bỏ qua template có ${}). */
function plainStringText(node, sf) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function collectFiles() {
  if (FILES_ARG) return FILES_ARG.split(',').map((f) => path.resolve(ROOT, f.trim()));
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx$/.test(e.name)) out.push(p);
    }
  };
  ['src/pages', 'src/components', 'src/layouts'].forEach((d) => {
    if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  });
  return out;
}

const plan = [];
let totalEdits = 0;
const createdKeys = {};

function createKeyFor(viText, enText) {
  let key = slugOf(viText || '') || slugOf(enText || '');
  if (!key) return null;
  let candidate = key;
  let i = 2;
  while (vi[candidate] !== undefined || createdKeys[candidate] !== undefined) {
    candidate = `${key}_${i++}`;
  }
  createdKeys[candidate] = { vi: viText, en: enText || '' };
  const n = norm(viText);
  if (!byViText.has(n)) byViText.set(n, candidate);
  vi[candidate] = viText; // để các vị trí trùng chuỗi tái dùng ngay trong lần chạy này
  return candidate;
}

for (const filePath of collectFiles()) {
  const rel = path.relative(ROOT, filePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  const full = sf.getFullText();

  // Các khai báo `const { t } = useLanguage() | useTranslation()` trong file (kèm vị trí).
  const tDecls = [];
  const findT = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name)) {
      const init = node.initializer;
      const name = init && ts.isCallExpression(init) ? init.expression.getText(sf) : '';
      if (name === 'useLanguage' || name === 'useTranslation') {
        if (node.name.elements.some((e) => (e.propertyName ? e.propertyName.getText(sf) : e.name.getText(sf)) === 't')) {
          tDecls.push({ start: node.getStart(sf), end: node.getEnd() });
        }
      }
    }
    ts.forEachChild(node, findT);
  };
  findT(sf);
  if (!tDecls.length) continue; // file không có `t` → bỏ qua

  /**
   * `t` phải khả dụng tại vị trí dùng: đi ngược lên các scope cha,`t` khai báo ở scope nào
   * mà KẾT THÚC TRƯỚC vị trí node (closure hợp lệ) là dùng được.
   */
  const scopeOf = (node) => {
    let cur = node.parent;
    while (cur && !ts.isFunctionLike(cur) && !ts.isSourceFile(cur)) cur = cur.parent;
    return cur;
  };
  const tInScope = (node) => {
    const pos = node.getStart(sf);
    let scope = node;
    while (scope) {
      const lo = ts.isSourceFile(scope) ? 0 : scope.getStart(sf);
      const hi = ts.isSourceFile(scope) ? full.length : scope.getEnd();
      if (tDecls.some((d) => d.start >= lo && d.end <= hi && d.end <= pos)) return true;
      scope = scope.parent && ts.isSourceFile(scope.parent) ? null : scope.parent;
      while (scope && !ts.isFunctionLike(scope) && !ts.isSourceFile(scope)) scope = scope.parent;
    }
    return false;
  };

  const edits = [];
  const addEdit = (start, end, replacement, meta, anchorNode) => {
    if (anchorNode && !tInScope(anchorNode)) return; // `t` không tồn tại trong component này
    edits.push({ start, end, replacement, ...meta });
  };

  const visit = (node) => {
    // 1) JSX text
    if (node.kind === ts.SyntaxKind.JsxText) {
      const raw = full.slice(node.getStart(sf), node.getEnd());
      const trimmed = raw.trim();
      let key = trimmed && isProse(trimmed) ? byViText.get(norm(trimmed)) : undefined;
      if (!key && CREATE_KEYS && isProse(trimmed) && trimmed.length < 200) key = createKeyFor(trimmed);
      if (key && !raw.includes('{') && !raw.includes('}')) {
        const lead = raw.slice(0, raw.indexOf(trimmed[0]));
        const tailLen = raw.length - (raw.indexOf(trimmed) + trimmed.length);
        const tail = raw.slice(raw.length - tailLen);
        // Giữ khoảng trắng CÙNG DÒNG (ảnh hưởng render); khoảng trắng có xuống dòng được JSX
        // collapse thành không → bỏ an toàn.
        const keepWs = (w) => (w && !/[\n\r]/.test(w) ? `{${jsQuote(w)}}` : '');
        const parts = [];
        if (lead.trim()) parts.push(keepWs(lead) || `{${jsQuote(lead)}}`);
        parts.push(`{t(${jsQuote(key)}, ${jsQuote(trimmed)})}`);
        if (tail.trim()) parts.push(keepWs(tail) || `{${jsQuote(tail)}}`);
        addEdit(node.getStart(sf), node.getEnd(), parts.join(''), { kind: 'jsx-text', key, text: trimmed }, node);
      }
    }

    // 2) thuộc tính UI dạng chuỗi tĩnh
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const attrName = node.name.getText(sf).toLowerCase();
      const text = node.initializer.text;
      if (!NEVER_ATTRS.has(attrName) && (UI_ATTRS.has(attrName) || hasLetters(text))) {
        let key = byViText.get(norm(text));
        if (!key && CREATE_KEYS && UI_ATTRS.has(attrName) && isProse(text)) key = createKeyFor(text);
        if (key && isProse(text)) {
          addEdit(node.getStart(sf), node.getEnd(), `${node.name.getText(sf)}={t(${jsQuote(key)}, ${jsQuote(text)})}`, {
            kind: 'attr',
            key,
            attr: attrName,
            text,
          }, node);
        }
      }
    }

    if (CREATE_KEYS && ts.isCallExpression(node) && node.arguments.length) {
      const callee = node.expression.getText(sf);
      const TOAST_RE = /(?:addToast|showToast|pushToast|toast|alert|confirm|setError|setSuccess|setNotice|notify)$/;
      if (TOAST_RE.test(callee.replace(/\s/g, '')) || /\.(?:alert|confirm)$/.test(callee)) {
        const arg0 = node.arguments[0];
        const text = plainStringText(arg0, sf);
        if (text && isProse(text) && text.length < 260) {
          const key = byViText.get(norm(text)) || createKeyFor(text);
          if (key) addEdit(arg0.getStart(sf), arg0.getEnd(), `t(${jsQuote(key)}, ${jsQuote(text)})`, { kind: 'toast', key, text }, node);
        }
      }
    }

    if (CREATE_KEYS && ts.isPropertyAssignment(node) && ts.isStringLiteral(node.initializer)) {
      const propName = node.name.getText(sf).replace(/['"]/g, '').toLowerCase();
      const SAFE_PROPS = /^(label|title|text|header|placeholder|tooltip|errormessage|emptymessage|confirmtext|canceltext|heading|subtitle|buttonlabel|actionlabel|colheader)$/;
      const text = node.initializer.text;
      if (SAFE_PROPS.test(propName) && isProse(text) && text.length < 260) {
        const key = byViText.get(norm(text)) || createKeyFor(text);
        if (key) addEdit(node.initializer.getStart(sf), node.initializer.getEnd(), `t(${jsQuote(key)}, ${jsQuote(text)})`, { kind: 'prop', key, prop: propName, text }, node);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);

  if (!edits.length) continue;

  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let cursor = -1;
  for (const e of edits) if (e.start >= cursor) { kept.push(e); cursor = e.end; }

  plan.push({ file: rel, count: kept.length, edits: kept.map(({ start, end, ...rest }) => rest) });
  totalEdits += kept.length;

  if (!WRITE) continue;

  let outText = full;
  for (const e of [...kept].sort((a, b) => b.start - a.start)) {
    outText = outText.slice(0, e.start) + e.replacement + outText.slice(e.end);
  }
  fs.writeFileSync(filePath, outText);
}

console.log(`\n🧵 i18n-wire-hardcoded — ${WRITE ? 'WRITE' : 'DRY-RUN'}`);
console.log(`   files: ${plan.length} | replacements: ${totalEdits}`);
for (const f of plan) console.log(`   ${f.file}: ${f.count}`);
fs.writeFileSync('/tmp/i18n-wire-plan.json', JSON.stringify(plan, null, 1));
if (Object.keys(createdKeys).length) {
  fs.writeFileSync(NEW_KEYS_PATH, JSON.stringify(createdKeys, null, 1));
  console.log(`   ⚠ ${Object.keys(createdKeys).length} key MỚI cần dịch EN → ${NEW_KEYS_PATH}`);
  if (WRITE) {
    const viPath = path.join(ROOT, 'public', 'locales', 'vi.json');
    const enPath = path.join(ROOT, 'public', 'locales', 'en.json');
    const viJson = JSON.parse(fs.readFileSync(viPath, 'utf8'));
    const enJson = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    for (const [k, v] of Object.entries(createdKeys)) {
      viJson[k] = v.vi;
      enJson[k] = v.en;
      if (viJson._groups) {
        if (!viJson._groups['Khác']) viJson._groups['Khác'] = [];
        if (!viJson._groups['Khác'].includes(k)) viJson._groups['Khác'].push(k);
      }
      if (enJson._groups) {
        if (!enJson._groups['Khác']) enJson._groups['Khác'] = [];
        if (!enJson._groups['Khác'].includes(k)) enJson._groups['Khác'].push(k);
      }
    }
    fs.writeFileSync(viPath, `${JSON.stringify(viJson, null, 2)}\n`);
    fs.writeFileSync(enPath, `${JSON.stringify(enJson, null, 2)}\n`);
  }
}
console.log('   📋 /tmp/i18n-wire-plan.json');
