const fs = require('fs');
const path = require('path');

const candidates = JSON.parse(fs.readFileSync(path.join(__dirname, 'candidates.json'), 'utf8'));

// Flatten locale keys and values
function flattenKeys(obj, prefix, arr) {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenKeys(value, fullKey, arr);
    } else {
      arr.push(fullKey);
    }
  }
}
const vi = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'locales', 'vi.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'locales', 'en.json'), 'utf8'));
const localeKeys = [];
flattenKeys(vi, '', localeKeys);
flattenKeys(en, '', localeKeys);

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove Vietnamese accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function suggestKey(filePath, value, index) {
  // Determine component/page prefix from file path
  let prefix = 'common';
  if (filePath.includes('pages\\saas\\')) {
    prefix = 'saas';
  } else if (filePath.includes('pages\\')) {
    prefix = 'shop';
  } else if (filePath.includes('components\\')) {
    const comp = path.basename(filePath, path.extname(filePath));
    prefix = comp.replace(/SaaS/i, 'saas_').replace(/[A-Z]/g, (m, i) => i ? '_' + m.toLowerCase() : m.toLowerCase());
  }

  // Use slug of value as key part
  const slug = slugify(value);
  if (!slug) return `${prefix}_text_${index}`;
  return `${prefix}_${slug}`;
}

const lines = ['# Missing Translations Report', ''];

const skipPatterns = [
  /^[\s\W]*$/, // whitespace or non-word only
  /^[\d\s\W]+$/, // numbers and punctuation
  /^[\s\W]{1,3}$/, // very short punctuation/whitespace
  /^[A-Za-z]$/, // single letter
  /https?:\/\//, // URLs
  /^[\d\s]+$/, // digits
  /^[0-9,\sđ%]+$/, // currency/number strings
  /^[()]+$/, // parentheses only
  /^[\s•✓✕×x+\-~/=|]+$/, // symbols
];

let total = 0;
for (const [file, strings] of Object.entries(candidates)) {
  const filtered = [];
  for (let i = 0; i < strings.length; i++) {
    const s = strings[i];
    const shouldSkip = skipPatterns.some(re => re.test(s));
    if (shouldSkip) continue;
    // Skip if it's a known data value (email, phone, example address, etc.)
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)) continue;
    if (/^[\d\s./()+-]+$/.test(s) && s.length < 30) continue; // numbers like phone, dates
    if (/^(test|customer|example|demo|password|admin|user|info|support|contact|www\.)/i.test(s)) continue;
    // Skip very long strings that look like sentences but are more like descriptions? We might want them.
    // For now, keep everything else.
    filtered.push(s);
  }
  if (filtered.length === 0) continue;
  total += filtered.length;
  lines.push(`## ${file}`);
  lines.push('');
  lines.push('| # | Hardcoded String | Suggested Key |');
  lines.push('|---|------------------|---------------|');
  filtered.forEach((s, i) => {
    const key = suggestKey(file, s, i + 1);
    lines.push(`| ${i + 1} | \`${s.replace(/\|/g, '\\|')}\` | \`${key}\` |`);
  });
  lines.push('');
}

lines.unshift(`**Total candidate strings (after basic filtering): ${total}**`, '');
fs.writeFileSync(path.join(__dirname, 'missing-translations-report.md'), lines.join('\n'));
console.log('Report generated: missing-translations-report.md');
