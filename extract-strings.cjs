const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const LOCALE_DIR = path.join(__dirname, 'public', 'locales');
const SRC_DIR = path.join(__dirname, 'src');

function flattenValues(obj, prefix, set) {
  prefix = prefix || '';
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenValues(value, fullKey, set);
    } else {
      set.add(String(value));
    }
  }
}

const vi = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, 'vi.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, 'en.json'), 'utf8'));
const localeValues = new Set();
flattenValues(vi, '', localeValues);
flattenValues(en, '', localeValues);

const files = [];
function findFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full);
    } else if (/\.(tsx|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
}
findFiles(SRC_DIR);

const candidates = {};

for (const file of files) {
  const code = fs.readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (e) {
    console.error(`Failed to parse ${file}: ${e.message}`);
    continue;
  }

  const strings = [];
  const translatedStrings = new Set();

  traverse(ast, {
    CallExpression(path) {
      const { callee } = path.node;
      let name = null;
      if (callee.type === 'Identifier' && callee.name === 't') {
        name = 't';
      } else if (
        callee.type === 'MemberExpression' &&
        callee.object.type === 'Identifier' &&
        callee.property.type === 'Identifier'
      ) {
        if (callee.object.name === 'i18n' && callee.property.name === 't') {
          name = 'i18n.t';
        }
      }
      if (name && path.node.arguments.length > 0) {
        const arg = path.node.arguments[0];
        if (arg.type === 'StringLiteral') {
          translatedStrings.add(arg.value);
        } else if (arg.type === 'TemplateLiteral') {
          arg.expressions.forEach(expr => {
            if (expr.type === 'StringLiteral') translatedStrings.add(expr.value);
          });
        }
      }
    },
    JSXText(path) {
      const text = path.node.value.trim();
      if (text && !translatedStrings.has(text)) {
        strings.push({ type: 'jsx-text', value: text });
      }
    },
    StringLiteral(path) {
      if (translatedStrings.has(path.node.value)) {
        return;
      }
      const parent = path.parentPath;
      if (parent.isJSXAttribute()) {
        const attrName = parent.node.name.name;
        const uiAttrs = new Set([
          'placeholder', 'title', 'alt', 'aria-label', 'aria-labelledby',
          'label', 'caption', 'summary', 'header', 'buttonText', 'text',
          'message', 'error', 'success', 'warning', 'info', 'confirm',
          'cancel', 'submit', 'delete', 'edit', 'save', 'close', 'back',
          'next', 'prev', 'yes', 'no', 'ok'
        ]);
        if (!uiAttrs.has(attrName)) {
          return;
        }
      } else if (parent.isVariableDeclarator() || parent.isAssignmentExpression()) {
        return;
      } else if (parent.isArrayExpression() || parent.isObjectProperty()) {
        return;
      } else if (parent.isImportDeclaration() || parent.isExportDeclaration()) {
        return;
      } else if (parent.isCallExpression()) {
        const call = parent.node;
        if (call.callee.type === 'Identifier' && ['console', 'alert', 'confirm', 'prompt'].includes(call.callee.name)) {
          return;
        }
        if (call.callee.type === 'MemberExpression') {
          const obj = call.callee.object;
          if (obj.type === 'Identifier' && obj.name === 'console') {
            return;
          }
        }
      }
      if (parent.isJSXExpressionContainer()) {
        // include
      } else if (!parent.isJSXAttribute()) {
        return;
      }
      strings.push({ type: 'string-literal', value: path.node.value });
    }
  });

  const missing = strings.filter(s => !localeValues.has(s.value));
  if (missing.length > 0) {
    const rel = path.relative(__dirname, file);
    candidates[rel] = missing.map(s => s.value);
  }
}

fs.writeFileSync(path.join(__dirname, 'candidates.json'), JSON.stringify(candidates, null, 2));
console.log(`Found candidates in ${Object.keys(candidates).length} files. See candidates.json`);


