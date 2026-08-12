/**
 * jscodeshift codemod (AST-aware) to replace hardcoded Vietnamese strings
 * with i18n function calls using a precomputed i18n-replacements.json.
 *
 * Usage (preview):
 *   npx jscodeshift -t codemods/replace-with-i18n-ast.js . \
 *     --extensions=js,jsx,ts,tsx --parser=tsx --ignore-pattern=node_modules|dist \
 *     -d -p -- -replacements=i18n-replacements.json -i18nFuncName=t -i18nImportSource=i18n -insertImport=true
 *
 * Production run (no dry-run):
 *   npx jscodeshift -t codemods/replace-with-i18n-ast.js . \
 *     --extensions=js,jsx,ts,tsx --parser=tsx --ignore-pattern=node_modules|dist \
 *     -- -replacements=i18n-replacements.json -i18nFuncName=t -i18nImportSource=i18n -insertImport=true
 *
 * Options (passed after --):
 *   -replacements  path to replacements JSON (default: ./i18n-replacements.json)
 *   -i18nFuncName  name of i18n function to call (default: t)
 *   -i18nImportSource  module specifier to import from (default: i18n)
 *   -insertImport  if 'true', add `import { <i18nFuncName> } from '<i18nImportSource>'` when needed
 *
 * NOTE:
 *  - Run on a feature branch, inspect git diff, run tests, and review manual fixes.
 *  - The replacements file must contain entries with exact original strings:
 *      [{ "file": "path", "original":"Thêm mới", "key":"path.to.thêm-mới", ... }, ...]
 */

const fs = require('fs');
const path = require('path');

module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  const opts = api.options || {};
  // jscodeshift passes CLI options after -- as properties on api.options
  // We allow both forms: '-replacements=path' or 'replacements=path' depending on runner.
  const getOpt = name => (
    opts[name] ??
    opts[`-${name}`] ??
    (process.argv.find(a => a.startsWith(`-${name}=`)) || '').split('=')[1] ??
    (process.argv.find(a => a.startsWith(`${name}=`)) || '').split('=')[1]
  );

  const replPath = getOpt('replacements') || './i18n-replacements.json';
  const i18nFuncName = getOpt('i18nFuncName') || getOpt('i18n-func-name') || 't';
  const i18nImportSource = getOpt('i18nImportSource') || getOpt('i18n-import-source') || 'i18n';
  const insertImport = (getOpt('insertImport') === 'true' || getOpt('insertImport') === true);

  let replacements = [];
  try {
    const replFull = path.resolve(process.cwd(), replPath);
    replacements = JSON.parse(fs.readFileSync(replFull, 'utf8'));
  } catch (e) {
    // If no replacements file, do nothing
    // (This avoids breaking when running codemod on unrelated repos)
    return fileInfo.source;
  }

  // Build map original -> key
  const map = new Map(replacements.map(r => [r.original, r.key]));

  if (map.size === 0) return fileInfo.source;

  let appliedCount = 0;

  // Helper to create callExpression t('key')
  function buildCall(key) {
    return j.callExpression(j.identifier(i18nFuncName), [j.literal(key)]);
  }

  // 1) JSXText: <div>Thêm mới</div>  -> <div>{t('key')}</div>
  root.find(j.JSXText).forEach(p => {
    const raw = p.node.value;
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (map.has(trimmed)) {
      const key = map.get(trimmed);
      const call = buildCall(key);
      const jsxExpr = j.jsxExpressionContainer(call);
      // Replace the text node with the JSXExpressionContainer
      j(p).replaceWith(jsxExpr);
      appliedCount++;
    }
  });

  // 2) JSXAttribute values: title="Thêm" or title={'Thêm'} or :title={`Thêm`}
  root.find(j.JSXAttribute).forEach(p => {
    const attr = p.node;
    const val = attr.value;
    if (!val) return;
    let str = null;
    if (val.type === 'Literal' && typeof val.value === 'string') {
      str = val.value;
    } else if (val.type === 'JSXExpressionContainer') {
      const expr = val.expression;
      if (expr && expr.type === 'Literal' && typeof expr.value === 'string') {
        str = expr.value;
      } else if (expr && expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
        str = expr.quasis[0].value.cooked;
      }
    } else if (val.type === 'JSXElement') {
      // skip nested JSX
      return;
    }

    if (str && map.has(str)) {
      const key = map.get(str);
      const call = buildCall(key);
      // replace attribute value with JSXExpressionContainer(call)
      attr.value = j.jsxExpressionContainer(call);
      appliedCount++;
    }
  });

  // Utility: check for unsafe parent contexts where we should NOT replace string literals
  function isUnsafeParent(parent) {
    if (!parent) return false;
    const tpe = parent.node ? parent.node.type : parent.type;
    // Import/Export module specifiers:
    if (tpe === 'ImportDeclaration' || tpe === 'ExportAllDeclaration' || tpe === 'ExportNamedDeclaration') return true;
    // require('mod')
    if (tpe === 'CallExpression' && parent.node && parent.node.callee && parent.node.callee.name === 'require') return true;
    // property keys: { "key": value } when the literal is the key
    if (tpe === 'Property' && parent.name === 'key') return true;
    // member expression property: obj['prop'] or obj.prop (prop as literal)
    if (tpe === 'MemberExpression' && parent.name === 'property') return true;
    // leave TaggedTemplateLiteral alone (could be SQL or other DSL)
    if (tpe === 'TaggedTemplateExpression') return true;
    // directive "use strict"
    if (tpe === 'ExpressionStatement' && parent.node && parent.node.expression && parent.node.expression.type === 'Literal') return true;
    return false;
  }

  // 3) TemplateLiteral with no expressions (not in JSX): `Thêm mới`
  root.find(j.TemplateLiteral).forEach(p => {
    if (p.node.expressions && p.node.expressions.length > 0) return;
    const cooked = p.node.quasis[0].value.cooked;
    if (!cooked) return;
    if (map.has(cooked)) {
      // ensure not in a tagged template
      const parent = p.parent;
      if (parent && parent.node && parent.node.type === 'TaggedTemplateExpression') return;
      const key = map.get(cooked);
      const call = buildCall(key);
      j(p).replaceWith(call);
      appliedCount++;
    }
  });

  // 4) General string Literal nodes in code (const s = "Thêm mới")
  root.find(j.Literal).forEach(p => {
    // skip if not string literal
    if (typeof p.node.value !== 'string') return;

    const str = p.node.value;
    if (!map.has(str)) return;

    // skip if in JSX contexts (handled earlier) or other unsafe parents
    const parentPath = p.parent;
    if (parentPath && isUnsafeParent(parentPath)) return;

    // Also skip if literal is the name in ImportDeclaration.source etc (already checked), or part of object key handled in isUnsafeParent

    // Replace literal with call expression
    const key = map.get(str);
    const call = buildCall(key);
    j(p).replaceWith(call);
    appliedCount++;
  });

  // 5) Literal inside JSXExpressionContainer already handled via JSXAttribute / TemplateLiteral / Literal but include a last-pass for expression containers with literal
  root.find(j.JSXExpressionContainer).forEach(p => {
    const expr = p.node.expression;
    if (!expr) return;
    if (expr.type === 'Literal' && typeof expr.value === 'string' && map.has(expr.value)) {
      const key = map.get(expr.value);
      const call = buildCall(key);
      p.node.expression = call;
      appliedCount++;
    }
  });

  // If replacements were applied and insertImport requested, add import if missing
  if (appliedCount > 0 && insertImport) {
    // detect existing import of the function from the same module
    const hasImport = root.find(j.ImportDeclaration, { source: { value: i18nImportSource } })
      .filter(path => {
        return path.node.specifiers.some(s => {
          return (s.imported && s.imported.name === i18nFuncName) || (s.local && s.local.name === i18nFuncName);
        });
      }).size() > 0;

    const hasAnyImportFromSource = root.find(j.ImportDeclaration, { source: { value: i18nImportSource } }).size() > 0;

    if (!hasImport) {
      const importSpec = j.importSpecifier(j.identifier(i18nFuncName));
      const importDecl = j.importDeclaration([importSpec], j.literal(i18nImportSource));
      // Insert after any leading comments / 'use strict' or before first node
      const body = root.get().node.program.body;
      let insertIndex = 0;
      // skip over "use strict" directives and leading comments/imports from other modules? Place at top
      body.splice(insertIndex, 0, importDecl);
    }
  }

  if (appliedCount > 0) {
    // console log to help debugging when running with -d -p
    // (jscodeshift prints stdout when using -d -p)
    // eslint-disable-next-line no-console
    console.log(`${fileInfo.path}: applied ${appliedCount} replacements`);
  }

  return root.toSource({ quote: 'single' });
};