/**
 * Usage: node scripts/normalize-locales.js public/locales/vi.json
 * Produces:
 *  - public/locales/vi.normalized.json
 *  - public/locales/vi-key-mapping.json (oldKey -> newKey)
 *
 * Converts ${var} -> {{var}} (i18next) and normalizes keys to dot.case based on value.
 */
const fs = require('fs');
const path = require('path');

function slugifyKey(s) {
  return s
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .slice(0, 6)
    .join('.');
}

function toDotKey(k, value) {
  if (/^[a-z0-9_.-]+$/.test(k)) return k;
  return slugifyKey(value || k) || slugifyKey(k) || k;
}

function convertInterpolation(val) {
  if (typeof val !== 'string') return val;
  // convert ${var} or ${obj.prop} -> {{var}} or {{obj.prop}}
  return val.replace(/\$\{([^}]+)\}/g, (_, p1) => `{{${p1}}}`);
}

const inPath = process.argv[2] || 'public/locales/vi.json';
if (!fs.existsSync(inPath)) {
  console.error('Input file not found:', inPath);
  process.exit(1);
}
const dir = path.dirname(inPath);
const raw = fs.readFileSync(inPath, 'utf8');
const obj = JSON.parse(raw);

const newObj = {};
const mapping = {};

Object.keys(obj).forEach(k => {
  const v = obj[k];
  const newVal = convertInterpolation(v);
  const newKey = toDotKey(k, newVal);

  // reuse existing key if same value already set
  const existingKey = Object.keys(newObj).find(ek => newObj[ek] === newVal);
  if (existingKey) {
    mapping[k] = existingKey;
  } else {
    // avoid key collision: if newKey already exists but different value, append index
    let keyCandidate = newKey;
    let idx = 1;
    while (newObj[keyCandidate] && newObj[keyCandidate] !== newVal) {
      keyCandidate = `${newKey}_${idx++}`;
    }
    newObj[keyCandidate] = newVal;
    mapping[k] = keyCandidate;
  }
});

const outPath = path.join(dir, 'vi.normalized.json');
const mappingPath = path.join(dir, 'vi-key-mapping.json');
fs.writeFileSync(outPath, JSON.stringify(newObj, null, 2), 'utf8');
fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('Wrote', mappingPath);