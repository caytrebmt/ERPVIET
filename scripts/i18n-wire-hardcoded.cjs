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

const vi = JSON.parse(fs.readFileSync(VI_PATH, 'utf8'));
const byViText = new Map();
for (const [k, v] of Object.entries(vi)) {
  if (k.startsWith('_') || typeof v !== 'string') continue;
  const n = norm(v);
  if (n && !byViText.has(n)) byViText.set(n, k);
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

  /** `t` chỉ gọi được trong component đã khai báo nó: xét function gần nhất quanh node. */
  const enclosingScope = (node) => {
    let cur = node.parent;
    while (cur && !ts.isFunctionLike(cur) && !ts.isSourceFile(cur)) cur = cur.parent;
    return cur;
  };
  const tInScope = (node) => {
    const scope = enclosingScope(node);
    const lo = scope ? scope.getStart(sf) : 0;
    const hi = scope ? scope.getEnd() : full.length;
    return tDecls.some((d) => d.end <= node.getStart(sf) && d.start >= lo - 1 && d.end <= hi + 1);
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
      const key = trimmed && hasLetters(trimmed) && trimmed.length > 1 ? byViText.get(norm(trimmed)) : undefined;
      if (key && !raw.includes('{') && !raw.includes('}')) {
        const lead = raw.slice(0, raw.indexOf(trimmed[0]));
        const tailLen = raw.length - (raw.indexOf(trimmed) + trimmed.length);
        const tail = raw.slice(raw.length - tailLen);
        const parts = [];
        if (lead.trim()) parts.push(jsQuote(lead));
        parts.push(`{t(${jsQuote(key)}, ${jsQuote(trimmed)})}`);
        if (tail.trim()) parts.push(jsQuote(tail));
        addEdit(node.getStart(sf), node.getEnd(), parts.join(''), { kind: 'jsx-text', key, text: trimmed }, node);
      }
    }

    // 2) thuộc tính UI dạng chuỗi tĩnh
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const attrName = node.name.getText(sf).toLowerCase();
      const text = node.initializer.text;
      if (!NEVER_ATTRS.has(attrName) && (UI_ATTRS.has(attrName) || hasLetters(text))) {
        const key = byViText.get(norm(text));
        if (key && hasLetters(text) && text.trim().length > 1) {
          addEdit(node.getStart(sf), node.getEnd(), `${node.name.getText(sf)}={t(${jsQuote(key)}, ${jsQuote(text)})}`, {
            kind: 'attr',
            key,
            attr: attrName,
            text,
          }, node);
        }
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
console.log('   📋 /tmp/i18n-wire-plan.json');
