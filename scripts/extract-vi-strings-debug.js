// scripts/extract-vi-strings-debug.js
// Usage:
//   node scripts/extract-vi-strings-debug.js          -> scans project (src/**/* and other common extensions)
//   node scripts/extract-vi-strings-debug.js path/to/file.tsx
//
// Output:
//   - prints per-file counts and sample matches
//   - writes i18n-replacements.json if matches found
//
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROOT = process.cwd();
const argPath = process.argv[2] || null;
const outFile = path.join(ROOT, 'i18n-replacements.json');

// Vietnamese letters set
const VI_CHARS = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ';
const viRegex = new RegExp('[' + VI_CHARS + ']');

// Globs to search by default
const defaultGlobs = [
  'src/**/*.{ts,tsx,js,jsx,vue}',
  'components/**/*.{ts,tsx,js,jsx,vue}',
  'pages/**/*.{ts,tsx,js,jsx,vue}',
  'public/**/*.{html,htm}',
  '*.ts','*.tsx','*.js','*.jsx'
];

function unique(arr) {
  return Array.from(new Set(arr));
}

function findQuotedStrings(content) {
  const results = [];
  const literalRegex = /(['"`])((?:(?!\1).)*?)\1/gms;
  let m;
  while ((m = literalRegex.exec(content)) !== null) {
    const val = m[2];
    if (val && viRegex.test(val)) results.push({type: 'literal', text: val});
  }
  return results;
}

function findTemplateLiterals(content) {
  const results = [];
  const tplRegex = /`([^`]*)`/gms;
  let m;
  while ((m = tplRegex.exec(content)) !== null) {
    const raw = m[1];
    if (raw && viRegex.test(raw)) {
      // detect expressions like ${...}
      const params = Array.from(raw.match(/\$\{([^}]+)\}/g) || []).map(s => s.slice(2,-1));
      results.push({type: 'template', text: raw, params});
    }
  }
  return results;
}

function findJSXText(content) {
  // crude but useful: find text between > ... < that contains Vietnamese
  const results = [];
  const jsxTextRegex = />[^<]*?([${VI}]?[^<]*?)*[^<]*?</gms; // fallback — we'll use simpler approach
  // Simpler: search for >...< with vi char
  const rx = />[^<]*[${VI}]?[^<]*</gms; // not used; use custom approach below

  // Simpler scanning for >...< fragments:
  const fragments = content.split(/</g);
  for (let i = 0; i < fragments.length - 1; i++) {
    const frag = fragments[i];
    const gtIndex = frag.lastIndexOf('>');
    if (gtIndex >= 0) {
      const text = frag.slice(gtIndex + 1);
      if (text && viRegex.test(text.trim())) {
        const trimmed = text.replace(/\s+/g, ' ').trim();
        if (trimmed.length > 0) results.push({type: 'jsxtext', text: trimmed});
      }
    }
  }
  return results;
}

function scanFile(fullPath) {
  const content = fs.readFileSync(fullPath, 'utf8');
  const hits = [];
  hits.push(...findQuotedStrings(content));
  hits.push(...findTemplateLiterals(content));
  hits.push(...findJSXText(content));
  // dedupe by text
  const uniq = [];
  const seen = new Set();
  for (const h of hits) {
    const t = h.text.trim();
    if (!seen.has(t)) {
      seen.add(t);
      uniq.push(h);
    }
  }
  return uniq;
}

(async () => {
  try {
    let files = [];
    if (argPath) {
      const stat = fs.existsSync(argPath) ? fs.statSync(argPath) : null;
      if (stat && stat.isFile()) files = [argPath];
      else {
        // treat argPath as glob
        files = glob.sync(argPath, { ignore: 'node_modules/**', nodir: true });
      }
    } else {
      for (const g of defaultGlobs) {
        files.push(...glob.sync(g, { ignore: 'node_modules/**', nodir: true }));
      }
    }
    files = unique(files).filter(f => !f.includes('node_modules'));
    console.log('Scanning', files.length, 'files...');
    const replacements = [];
    let totalMatches = 0;
    for (const file of files) {
      try {
        const full = path.join(ROOT, file);
        if (!fs.existsSync(full)) continue;
        const matches = scanFile(full);
        if (matches.length > 0) {
          totalMatches += matches.length;
          console.log(`\n[${file}] => ${matches.length} match(es):`);
          matches.slice(0, 10).forEach(m => {
            console.log(`  - (${m.type}) "${m.text.length>120?m.text.slice(0,120)+'...':m.text}"`);
            // generate key suggestion (simple)
            const keyBase = file.replace(/[\/\\]/g, '.').replace(/\.[^.]+$/, '');
            const slug = m.text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,'').trim().split(/\s+/).slice(0,6).join('-') || 'text';
            const suggestedKey = `${keyBase}.${slug}`;
            replacements.push({
              file,
              original: m.text,
              key: suggestedKey,
              params: m.params || []
            });
          });
          if (matches.length > 10) console.log(`  ... +${matches.length - 10} more`);
        }
      } catch (e) {
        console.error('Error reading file', file, e.message);
      }
    }

    console.log('\nTotal Vietnamese string matches found:', totalMatches);
    if (replacements.length > 0) {
      // dedupe by original
      const uniqMap = new Map();
      replacements.forEach(r => {
        const k = r.original.trim();
        if (!uniqMap.has(k)) uniqMap.set(k, r);
      });
      const out = Array.from(uniqMap.values());
      fs.writeFileSync(outFile, JSON.stringify(out, null, 2), 'utf8');
      console.log('Wrote', outFile, 'with', out.length, 'entries');
    } else {
      // remove existing output (if empty) to avoid confusion
      if (fs.existsSync(outFile)) {
        fs.unlinkSync(outFile);
        console.log('No matches: removed existing', outFile);
      } else {
        console.log('No matches found; no i18n-replacements.json created.');
      }
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();