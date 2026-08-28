/**
 * scripts/refactor-isen.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Phân tích và báo cáo tất cả pattern `isEn ?` trong source TSX/TS.
 * Giúp developer biết chính xác cần sửa bao nhiêu chỗ và ở đâu.
 *
 * CÁCH DÙNG:
 *   node scripts/refactor-isen.cjs            → báo cáo tổng hợp
 *   node scripts/refactor-isen.cjs --file=src/pages/saas/SaaSCRMPage.tsx
 *                                              → báo cáo 1 file cụ thể
 *
 * OUTPUT: In ra console danh sách đầy đủ với key gợi ý và snippet code
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

const SPECIFIC_FILE = process.argv.find(a => a.startsWith('--file='))?.split('=')[1];

// Tìm tất cả file TSX/TS
function findFiles(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(fullPath));
    } else if (entry.isFile() && /\.(tsx|ts)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// Tạo key gợi ý từ chuỗi tiếng Anh
function suggestKey(enStr, filePath) {
  const fileName = path.basename(filePath, path.extname(filePath))
    .replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');

  const keyBase = enStr
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('_');

  return `${fileName}_${keyBase}`.replace(/__+/g, '_').replace(/^_|_$/g, '');
}

// Parse pattern isEn ? 'EN' : 'VI' từ một file
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const findings = [];

  // Regex: isEn ? '...' : '...' (single hoặc double quotes)
  const PATTERN = /isEn\s*\?\s*(['"`])(.*?)\1\s*:\s*(['"`])(.*?)\3/g;

  lines.forEach((line, idx) => {
    let match;
    const lineCopy = line;
    PATTERN.lastIndex = 0;

    while ((match = PATTERN.exec(lineCopy)) !== null) {
      const enStr = match[2];
      const viStr = match[4];
      const sugKey = suggestKey(enStr, filePath);

      findings.push({
        line: idx + 1,
        col: match.index + 1,
        original: match[0],
        en: enStr,
        vi: viStr,
        suggestedKey: sugKey,
        replacement: `t('${sugKey}', '${viStr.replace(/'/g, "\\'")}')`,
      });
    }
  });

  return findings;
}

function main() {
  const files = SPECIFIC_FILE
    ? [path.resolve(ROOT, SPECIFIC_FILE)]
    : findFiles(SRC_DIR);

  let totalFindings = 0;
  const fileReports = [];

  for (const file of files) {
    const findings = analyzeFile(file);
    if (findings.length > 0) {
      fileReports.push({ file, findings });
      totalFindings += findings.length;
    }
  }

  console.log(`\n🔍 ERPVIET — isEn ? Pattern Analysis Report`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files with isEn?: ${fileReports.length}`);
  console.log(`   Total occurrences: ${totalFindings}`);
  console.log();

  for (const { file, findings } of fileReports) {
    const relPath = path.relative(ROOT, file);
    console.log(`\n📄 ${relPath} (${findings.length} occurrences)`);
    console.log('─'.repeat(70));

    for (const f of findings) {
      console.log(`  Line ${f.line}: ${f.original.slice(0, 80)}`);
      console.log(`    vi:  "${f.vi}"`);
      console.log(`    en:  "${f.en}"`);
      console.log(`    key: "${f.suggestedKey}"`);
      console.log(`    → Replace with: {${f.replacement}}`);
      console.log(`    → Add to vi.json: "${f.suggestedKey}": "${f.vi}"`);
      console.log(`    → Add to en.json: "${f.suggestedKey}": "${f.en}"`);
      console.log();
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`MANUAL REFACTORING GUIDE:`);
  console.log(`
For each occurrence above:
  1. Open the file at the line number shown
  2. Replace:   {isEn ? 'EN text' : 'VI text'}
     With:      {t('suggested_key', 'VI text')}
  3. Add to public/locales/vi.json:
                "suggested_key": "VI text"
  4. Add to public/locales/en.json:
                "suggested_key": "EN text"
  5. Run: npm run build && npm test

Do ONE FILE at a time — commit after each file.
`);

  // Xuất JSON cho tooling nếu cần
  const jsonReport = path.join(ROOT, 'scripts', 'isen-report.json');
  fs.writeFileSync(jsonReport, JSON.stringify(
    fileReports.map(({ file, findings }) => ({
      file: path.relative(ROOT, file),
      count: findings.length,
      findings: findings.map(f => ({
        line: f.line,
        key: f.suggestedKey,
        vi: f.vi,
        en: f.en,
      })),
    })),
    null, 2
  ));
  console.log(`📋 Full JSON report saved to: scripts/isen-report.json`);
}

main();
