import fs from 'fs';
import path from 'path';

const viPath = path.join(process.cwd(), 'public', 'locales', 'vi.json');
const enPath = path.join(process.cwd(), 'public', 'locales', 'en.json');

const vi = JSON.parse(fs.readFileSync(viPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

// Build reverse map: Vietnamese string -> [key1, key2, ...]
const valueToKeys: Record<string, string[]> = {};
for (const [key, val] of Object.entries(vi)) {
  if (typeof val === 'string') {
    if (!valueToKeys[val]) valueToKeys[val] = [];
    valueToKeys[val].push(key);
  }
}

// For each value with duplicate keys, keep the one without suffix, remove others
const keysToRemove = new Set<string>();
for (const [val, keys] of Object.entries(valueToKeys)) {
  if (keys.length > 1) {
    // Sort by key length (shortest first = no suffix)
    keys.sort((a, b) => a.length - b.length);
    const keep = keys[0]; // shortest key (no _number suffix)
    for (const key of keys) {
      if (key !== keep) keysToRemove.add(key);
    }
  }
}

console.log(`Removing ${keysToRemove.size} duplicate keys`);

// Also remove keys that are pure duplicates (same key string used as value in en.json, where another key has the same meaning)
// Specifically: if vi[key] === vi[key_without_suffix], remove the suffixed one
for (const [key, val] of Object.entries(vi)) {
  if (typeof val !== 'string') continue;
  const lastUnderscore = key.lastIndexOf('_');
  if (lastUnderscore > 0) {
    const baseKey = key.slice(0, lastUnderscore);
    const suffix = key.slice(lastUnderscore + 1);
    if (/^\d+$/.test(suffix) && vi[baseKey] === val) {
      keysToRemove.add(key);
    }
  }
}

// Remove from both files
for (const key of keysToRemove) {
  delete vi[key];
  delete en[key];
}

fs.writeFileSync(viPath, JSON.stringify(vi, null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');

console.log(`vi.json: ${Object.keys(vi).length} keys total`);
console.log(`en.json: ${Object.keys(en).length} keys total`);
