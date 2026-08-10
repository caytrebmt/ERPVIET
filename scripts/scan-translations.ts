/**
 * Scan TSX files for hardcoded Vietnamese strings and generate translation keys.
 * Usage:  npx tsx scripts/scan-translations.ts <glob-pattern> [--write]
 *
 * Examples:
 *   npx tsx scripts/scan-translations.ts "src/pages/saas/*.tsx"
 *   npx tsx scripts/scan-translations.ts "src/pages/saas/SaaSWebOrdersPage.tsx"
 *   npx tsx scripts/scan-translations.ts "src/pages/saas/*.tsx" --write   (adds keys to vi.json & en.json)
 */
import fs from 'fs';
import path from 'path';

const [, , ...args] = process.argv;
const patterns = args.filter(a => !a.startsWith('--'));
const shouldWrite = args.includes('--write');

const VIETNAMESE_RE = /[À-ỹà-ỹ]/;

const SKIP_IF: ((s: string) => boolean)[] = [
  s => s.length < 4,
  s => /^\d+$/.test(s),
  s => /^api\//.test(s),
  s => /^http/.test(s),
  s => /^#[0-9a-f]{3,8}$/i.test(s),
  s => /^rgba?\(|^hsla?\(|^rgb\(|^hsl\(/i.test(s),
  s => /^\$[2ab]\$/.test(s),
  s => /^[a-z]+:[a-z]+$/i.test(s),
  s => /^src=|^https?/.test(s),
  s => /^[a-z0-9_]+$/i.test(s),
  s => s.includes('${'),
  s => s.includes('(') && s.includes(')'),
  s => s.length > 300,
];

function isKeyLike(s: string): boolean {
  return /^[a-z][a-z0-9_]*(:[a-z0-9_]+)*$/i.test(s);
}

function expandGlob(pattern: string): string[] {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  if (!fs.existsSync(dir)) return [];
  if (base === '*' || base === '*.tsx' || base === '*.ts') {
    const ext = base.replace('*', '');
    return fs.readdirSync(dir)
      .filter(f => ext ? f.endsWith(ext) : f.endsWith('.tsx'))
      .map(f => path.join(dir, f));
  }
  const full = path.join(dir, base);
  return fs.existsSync(full) ? [full] : [];
}

function walkDir(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...walkDir(full));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function fileKeyPrefix(filePath: string): string {
  const base = path.basename(filePath, '.tsx');
  return 'saas_' + base
    .replace(/^SaaS/, '')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
    .replace(/_page$/, '');
}

function slugifyVietnamese(str: string): string {
  const vietMap: Record<string, string> = {
    'à':'a','á':'a','ạ':'a','ả':'a','ã':'a','â':'a','ầ':'a','ấ':'a','ậ':'a','ẩ':'a','ẵ':'a',
    'è':'e','é':'e','ẹ':'e','ẻ':'e','ẽ':'e','ê':'e','ề':'e','ế':'e','ệ':'e','ể':'e','ễ':'e',
    'ì':'i','í':'i','ị':'i','ỉ':'i','ĩ':'i',
    'ò':'o','ó':'o','ọ':'o','ỏ':'o','õ':'o','ô':'o','ồ':'o','ố':'o','ộ':'o','ổ':'o','ỗ':'o',
    'ờ':'o','ớ':'o','ợ':'o','ở':'o','ỡ':'o',
    'ù':'u','ú':'u','ụ':'u','ủ':'u','ũ':'u','ưừ':'u','ự':'u','ứ':'u','ử':'u','ữ':'u',
    'ỳ':'y','ý':'y','ỵ':'y','ỷ':'y','ỹ':'y','đ':'d',
  };
  return str
    .toLowerCase()
    .replace(/[à-ỹ]/g, c => vietMap[c] || c)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface FoundString {
  str: string;
  line: number;
  context: string;
}

function extractStrings(content: string): FoundString[] {
  const results: FoundString[] = [];
  const lines = content.split('\n');

  // 1) String literals in quotes containing Vietnamese chars
  const stringRegex = /(['"`])((?:[^'"`\\]|\\.)*?)\1/g;
  let match: RegExpExecArray | null;

  while ((match = stringRegex.exec(content)) !== null) {
    const str = match[2].replace(/\\(.)/g, '$1');
    if (!str || str.trim().length < 3) continue;
    if (SKIP_IF.some(fn => fn(str))) continue;
    if (isKeyLike(str)) continue;
    if (!VIETNAMESE_RE.test(str)) continue;

    const before = content.slice(0, match.index);
    const lineNum = (before.match(/\n/g) || []).length + 1;

    // Skip if inside a t() call
    if (/t\(\s*['"`]/.test(before.slice(-10))) continue;

    // Skip if it's a data/status value assignment
    const line = lines[lineNum - 1] || '';
    if (/\b(status|erp_status|erp_note|role|role_code|type|payment_method|paymentMethod|code|sku|unit_price|amount|quantity)\s*:\s*['"]/.test(line)) continue;

    results.push({ str: str.trim(), line: lineNum, context: line.trim().slice(0, 150) });
  }

  // 2) JSX text content (text between tags)
  stringRegex.lastIndex = 0;
  const jsxTextRegex = />([^<{]+?)<\//g;
  while ((match = jsxTextRegex.exec(content)) !== null) {
    const str = match[1].trim();
    if (!str || str.length < 3) continue;
    if (SKIP_IF.some(fn => fn(str))) continue;
    if (isKeyLike(str)) continue;
    if (!VIETNAMESE_RE.test(str)) continue;

    const lineNum = (content.slice(0, match.index).match(/\n/g) || []).length + 1;
    const line = lines[lineNum - 1] || '';
    if (/t\(|t /.test(line)) continue;

    results.push({ str, line: lineNum, context: line.trim().slice(0, 150) });
  }

  return results;
}

function generateKey(prefix: string, str: string, existingKeys: Set<string>): string {
  let base = prefix + '_' + slugifyVietnamese(str);
  base = base.replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');

  let key = base;
  let counter = 1;
  while (existingKeys.has(key)) {
    key = `${base}_${counter}`;
    counter++;
  }
  return key;
}

async function main() {
  if (patterns.length === 0) {
    console.error('Usage: npx tsx scripts/scan-translations.ts <glob-pattern> [--write]');
    process.exit(1);
  }

  const files: string[] = [];
  for (const p of patterns) {
    if (p.includes('**')) {
      const baseDir = p.split('**')[0].replace(/\*$/, '').replace(/\/$/, '') || '.';
      const ext = p.endsWith('.tsx') ? '.tsx' : '.ts';
      files.push(...walkDir(baseDir).filter(f => f.endsWith(ext)));
    } else {
      files.push(...expandGlob(p));
    }
  }

  const unique = Array.from(new Set(files));
  if (unique.length === 0) {
    console.error('No files found matching patterns:', patterns);
    process.exit(1);
  }

  console.log(`\n=== Translation Key Scanner ===`);
  console.log(`Scanning ${unique.length} files for hardcoded Vietnamese strings...\n`);

  const viJsonPath = path.join(process.cwd(), 'public', 'locales', 'vi.json');
  const enJsonPath = path.join(process.cwd(), 'public', 'locales', 'en.json');
  const existingVi = JSON.parse(fs.readFileSync(viJsonPath, 'utf8'));
  const existingEn = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
  const existingKeys = new Set([...Object.keys(existingVi), ...Object.keys(existingEn)]);

  const allResults: Array<{ file: string; str: string; line: number; key: string; context: string }> = [];
  const newEntries: Record<string, string> = {};
  // Map: Vietnamese string -> key (so same string always reuses same key)
  const stringToKey: Map<string, string> = new Map();

  for (const file of unique) {
    if (file.includes('node_modules')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const prefix = fileKeyPrefix(file);
    const strings = extractStrings(content);

    if (strings.length === 0) {
      console.log(`  (no hardcoded strings in ${path.relative(process.cwd(), file)})`);
      continue;
    }

    for (const s of strings) {
      // Reuse existing key for identical string
      if (stringToKey.has(s.str)) {
        const existingKey = stringToKey.get(s.str)!;
        allResults.push({ file: path.relative(process.cwd(), file), str: s.str, line: s.line, key: existingKey, context: s.context });
        continue;
      }

      const key = generateKey(prefix, s.str, existingKeys);
      stringToKey.set(s.str, key);
      if (existingKeys.has(key) || newEntries[key]) continue;

      newEntries[key] = s.str;
      existingKeys.add(key);
      allResults.push({ file: path.relative(process.cwd(), file), str: s.str, line: s.line, key, context: s.context });
    }
  }

  if (allResults.length === 0) {
    console.log('✅ No hardcoded Vietnamese strings found. All strings are already translated or key-like.');
    return;
  }

  console.log(`Found ${allResults.length} hardcoded Vietnamese strings:\n`);

  const byFile: Record<string, typeof allResults> = {};
  for (const r of allResults) {
    if (!byFile[r.file]) byFile[r.file] = [];
    byFile[r.file].push(r);
  }

  for (const [file, entries] of Object.entries(byFile)) {
    console.log(`--- ${file} ---`);
    for (const e of entries) {
      console.log(`  Line ${e.line}: "${e.str}"`);
      console.log(`    → key: "${e.key}"`);
      console.log(`    → use: t('${e.key}')`);
      console.log();
    }
  }

  console.log(`\n=== New translation entries to add ===\n`);
  for (const [key, value] of Object.entries(newEntries)) {
    console.log(`  "${key}": "${value}"`);
  }

  if (shouldWrite) {
    console.log('\nWriting to locale files...');

    const insertKeys = (obj: Record<string, any>, keys: Record<string, string>) => {
      for (const [k, v] of Object.entries(keys)) {
        if (!(k in obj)) obj[k] = v;
      }
    };

    insertKeys(existingVi, newEntries);
    insertKeys(existingEn, Object.fromEntries(Object.keys(newEntries).map(k => [k, k])));

    fs.writeFileSync(viJsonPath, JSON.stringify(existingVi, null, 2) + '\n', 'utf8');
    fs.writeFileSync(enJsonPath, JSON.stringify(existingEn, null, 2) + '\n', 'utf8');

    console.log(`✓ Added ${Object.keys(newEntries).length} new keys to vi.json and en.json`);
  } else {
    console.log('\n(Dry run — use --write to add keys to locale files)');
  }
}

main().catch(console.error);
