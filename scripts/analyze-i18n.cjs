const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'public/locales');
const srcDir = path.join(root, 'src');

const viPath = path.join(localesDir, 'vi.json');
const enPath = path.join(localesDir, 'en.json');

const viRaw = JSON.parse(fs.readFileSync(viPath, 'utf8'));
const enRaw = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const viGroups = viRaw._groups || {};
const enGroups = enRaw._groups || {};
delete viRaw._groups;
delete enRaw._groups;

const viKeys = Object.keys(viRaw);
const enKeys = Object.keys(enRaw);

const viSet = new Set(viKeys);
const enSet = new Set(enKeys);

// Walk src for all .ts/.tsx files
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = walk(srcDir);

// Collect used keys with fallback values
// Match: t('key'), t("key"), t(`key`), i18n.t('key')
// The \b ensures we don't match "import(", "format(", etc.
// We need the t to be a standalone function call (not part of a longer identifier)
const usedKeys = new Map(); // key -> fallback value (if any)

// Pattern: word boundary, then t, then (, then quote, then content, then same quote
const keyRegex = /\bt\s*\(\s*(['"`])((?:[^'"`\\]|\\.)*)\1/g;

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = keyRegex.exec(content)) !== null) {
    let key = m[2].replace(/\\(.)/g, '$1').trim();
    // Skip if it looks like an interpolation or expression
    if (key.includes('{') || key.includes('\\n')) continue;
    // Skip if it contains $ (likely a template literal expression)
    if (key.includes('$')) continue;
    // Skip if it's an import path or file path
    if (key.startsWith('./') || key.startsWith('/')) continue;
    // Skip if it's a single character or simple word that's likely not a key
    if (key.length < 2) continue;
    // Skip common false positives
    if (['from', 'to', 'page', 'path', 'code', 'all', 'from', 'error', 'category_id', 'tenant', 'search', 'fs', '2d', 'a', 'T', 'canvas', '|', ':', '@', 'vi-VN', 'unauthorized_logout'].includes(key)) continue;

    if (!usedKeys.has(key)) {
      // Try to find fallback - look for t('key', 'fallback') pattern after the key
      const afterKey = content.substring(m.index + m[0].length);
      const fallbackMatch = afterKey.match(/^\s*,\s*(['"`])([^'"`\\]*(?:\\.[^'"`\\]*)*)\1/);
      if (fallbackMatch) {
        const fb = fallbackMatch[2].replace(/\\(.)/g, '$1').trim();
        if (fb && !fb.includes('{') && !fb.startsWith('"')) {
          usedKeys.set(key, fb);
        } else {
          usedKeys.set(key, null);
        }
      } else {
        usedKeys.set(key, null);
      }
    }
  }
}

const usedKeySet = new Set(usedKeys.keys());

console.log('Total unique keys used in source:', usedKeySet.size);
console.log('Total keys in vi.json:', viKeys.length);
console.log('Total keys in en.json:', enKeys.length);

// Unused: in locale but NOT used in source
const viUnused = viKeys.filter(k => !usedKeySet.has(k));
const enUnused = enKeys.filter(k => !usedKeySet.has(k));
console.log('\n=== Unused in vi.json:', viUnused.length, '===');
console.log('=== Unused in en.json:', enUnused.length, '===');

// Missing: used in source but NOT in locale
const viMissing = [...usedKeySet].filter(k => !viSet.has(k));
const enMissing = [...usedKeySet].filter(k => !enSet.has(k));
console.log('\n=== Missing from vi.json:', viMissing.length, '===');
viMissing.sort().forEach(k => {
  const fb = usedKeys.get(k);
  console.log('  ', k, fb ? `-> fallback: "${fb}"` : '(no fallback)');
});
console.log('\n=== Missing from en.json:', enMissing.length, '===');
if (enMissing.length !== viMissing.length) {
  console.log('MISMATCH! enMissing:', enMissing.length, 'viMissing:', viMissing.length);
}

// Check _groups integrity
const allGroupRefs = [];
for (const [cat, keys] of Object.entries(viGroups)) {
  if (Array.isArray(keys)) allGroupRefs.push(...keys);
  else if (typeof keys === 'object') allGroupRefs.push(...Object.keys(keys));
}
const inGroupsButNotTop = allGroupRefs.filter(k => !viSet.has(k));
console.log('\n_keys referenced in _groups but NOT in top-level:', inGroupsButNotTop.length);
if (inGroupsButNotTop.length > 0) inGroupsButNotTop.forEach(k => console.log('  ', k));

// Debug: check specific keys
console.log('\n--- DEBUG ---');
['sidebar_suppliers', 'saas_web_orders_thanh_toan', 'saas_web_orders_ma_d_n_web'].forEach(k => {
  console.log(k, 'in viSet:', viSet.has(k), '| in usedKeySet:', usedKeySet.has(k));
});
