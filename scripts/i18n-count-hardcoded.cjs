'use strict';

/**
 * scripts/i18n-count-hardcoded.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Đếm số CHUỖI TIẾNG VIỆT CÒN HARDCODE trong tầng hiển thị (JSX text + thuộc tính
 * UI dạng chuỗi tĩnh), dùng AST của TypeScript nên không đếm nhầm vào className,
 * giá trị so sánh (status === 'CHO_DUYET') hay chú thích.
 *
 * Dùng cho:
 *  - báo cáo tiến độ hoàn thiện i18n (Issue #12),
 *  - CI guard dạng "con chốt" (ratchet): số này chỉ được phép GIẢM.
 *
 * CÁCH DÙNG:
 *   node scripts/i18n-count-hardcoded.cjs                 # in bảng theo file
 *   node scripts/i18n-count-hardcoded.cjs --json          # { total, byFile }
 *   node scripts/i18n-count-hardcoded.cjs --write-baseline # ghi tests/i18n-hardcoded-baseline.json
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const UI_DIRS = ['src/pages', 'src/components', 'src/layouts'];
const BASELINE_PATH = path.join(ROOT, 'tests', 'i18n-hardcoded-baseline.json');

/** Thuộc tính mang nghĩa DỮ LIỆU/ĐỊNH DANH → không phải văn bản hiển thị. */
const DATA_ATTRS = new Set([
  'classname', 'class', 'value', 'defaultvalue', 'id', 'for', 'htmlfor', 'type', 'key', 'ref',
  'href', 'to', 'src', 'width', 'height', 'size', 'variant', 'color', 'path', 'accessorkey',
  'role', 'target', 'rel', 'method', 'action', 'accept', 'max', 'min', 'step', 'pattern',
  'autoComplete', 'capture', 'download', 'dir', 'lang', 'tabindex', 'span', 'colspan', 'rowspan',
  'icon', 'field', 'valuefield', 'idfield', 'columns', 'datakey', 'format', 'alt_source',
].map((s) => s.toLowerCase()));

const VI_DIACRITIC = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;
const hasViText = (s) => VI_DIACRITIC.test(String(s || '')) && /[A-Za-zÀ-ỹ]{2,}/.test(String(s || ''));

const tsxFiles = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx$/.test(e.name)) tsxFiles.push(p);
  }
};
UI_DIRS.forEach((d) => walk(path.join(ROOT, d)));

const byFile = {};
for (const file of tsxFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (!VI_DIACRITIC.test(text)) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  let n = 0;
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.JsxText) {
      if (hasViText(node.getText(sf).trim())) n += 1;
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer)) {
      const name = node.name.getText(sf).toLowerCase();
      if (!DATA_ATTRS.has(name) && hasViText(node.initializer.text)) n += 1;
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // chuỗi đứng một mình trong biểu thức UI (ngoài JSX attribute) — ví dụ label: 'Báo giá'
      const parent = node.parent;
      const isObjectLabel = parent && ts.isPropertyAssignment(parent) && /label|title|text|name|message|placeholder|description|heading|caption/i.test(parent.name.getText(sf));
      const isIntrinsicText = parent && (ts.isJsxExpression(parent) || ts.isCallExpression(parent));
      if ((isObjectLabel || (isIntrinsicText && !ts.isJsxAttribute(parent))) && hasViText(node.text)) n += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (n) byFile[path.relative(ROOT, file).split(path.sep).join('/')] = n;
}

const total = Object.values(byFile).reduce((a, b) => a + b, 0);
const json = process.argv.includes('--json');

if (process.argv.includes('--write-baseline')) {
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ generatedBy: 'node scripts/i18n-count-hardcoded.cjs --write-baseline', total, byFile }, null, 2)}\n`,
  );
  console.log(`✅ Baseline đã ghi vào tests/i18n-hardcoded-baseline.json (total=${total})`);
} else if (json) {
  console.log(JSON.stringify({ total, byFile }));
} else {
  console.log(`\n📏 Chuỗi tiếng Việt còn hardcode trong tầng hiển thị: ${total}`);
  for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${f}`);
}
