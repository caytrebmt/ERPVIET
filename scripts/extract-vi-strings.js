// scripts/extract-vi-strings.js
/**
 * Usage:
 *  node scripts/extract-vi-strings.js
 *
 * Reads public/locales/vi.normalized.json (if exists) to reuse existing translations.
 * Scans source files for Vietnamese-containing string literals and template literals,
 * then produces i18n-replacements.json with { file, original, key, params }.
 *
 * Installs: npm i glob
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = process.cwd();
const EXISTING_LOCALE = path.join(ROOT, 'public/locales/vi.normalized.json');
let existing = {};
try {
  existing = JSON.parse(fs.readFileSync(EXISTING_LOCALE, 'utf8'));
} catch (e) {
  // fallback to original vi.json if normalized not present
  try { existing = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales/vi.json'), 'utf8')); } catch (e2) { existing = {}; }
}

const files = glob.sync('src/**/*.{ts,tsx,js,jsx,vue}', { ignore: 'node_modules/**' });
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
const replacements = [];
const seen = new Map(); // original->key

// invert existing map: value->key for reuse
const valueToKey = new Map();
Object.keys(existing).forEach(k => {
  const v = existing[k];
  valueToKey.set(v, k);
});

function slugifyForKey(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 6)
    .join('-') || 'text';
}

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  // find string literals "..." or '...' or `...`
  const literalRegex = /(['"`])((?:(?!\1).)*?)\1/gms;
  let m;
  while ((m = literalRegex.exec(src)) !== null) {
    const val = m[2];
    if (!val || val.length < 2) continue;
    if (!VI_CHARS.test(val)) continue;
    // adjust interpolation ${...} -> {{...}} for matching existing locale
    const normalizedVal = val.replace(/\$\{([^}]+)\}/g, '{{$1}}');
    if (valueToKey.has(normalizedVal)) {
      const key = valueToKey.get(normalizedVal);
      replacements.push({ file, original: val, key, params: [] });
      seen.set(val, key);
      continue;
    }
    if (seen.has(val)) continue;
    // build key
    const base = file.replace(/[\/\\]/g, '.').replace(/\.[^.]+$/, '');
    const slug = slugifyForKey(val);
    let key = `${base}.${slug}`;
    let suffix = 0;
    while (Object.prototype.hasOwnProperty.call(existing, key) || Array.from(replacements).some(r => r.key === key)) {
      suffix += 1;
      key = `${base}.${slug}_${suffix}`;
    }
    replacements.push({ file, original: val, key, params: [] });
    seen.set(val, key);
  }

  // find template literals with expressions `Hello ${name}`
  const tplRegex = /`([^`]*\$\{[^`]+\}[^`]*)`/gms;
  while ((m = tplRegex.exec(src)) !== null) {
    const raw = m[1];
    if (!VI_CHARS.test(raw)) continue;
    // convert ${x} to {{x}} in value
    const normalized = raw.replace(/\$\{([^}]+)\}/g, '{{$1}}');
    if (valueToKey.has(normalized)) {
      const key = valueToKey.get(normalized);
      replacements.push({ file, original: raw, key, params: Array.from((raw.match(/\$\{([^}]+)\}/g) || []).map(s => s.slice(2,-1)) )});
      continue;
    }
    const base = file.replace(/[\/\\]/g, '.').replace(/\.[^.]+$/, '');
    const slug = slugifyForKey(normalized);
    let key = `${base}.${slug}`;
    let suffix = 0;
    while (Object.prototype.hasOwnProperty.call(existing, key) || Array.from(replacements).some(r => r.key === key)) {
      suffix += 1;
      key = `${base}.${slug}_${suffix}`;
    }
    const params = Array.from((raw.match(/\$\{([^}]+)\}/g) || []).map(s => s.slice(2,-1)));
    replacements.push({ file, original: raw, key, params });
  }
}

fs.writeFileSync(path.join(ROOT, 'i18n-replacements.json'), JSON.stringify(replacements, null, 2), 'utf8');
console.log('Wrote i18n-replacements.json with', replacements.length, 'entries');