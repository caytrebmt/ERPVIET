/**
 * scripts/translate-en.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Script dịch hàng loạt en.json bằng OpenAI API (GPT-4o-mini hoặc GPT-4o).
 *
 * CÁCH DÙNG:
 *   1. Đặt biến môi trường:   export OPENAI_API_KEY=sk-...
 *   2. Chế độ preview (không ghi):   node scripts/translate-en.cjs --dry-run
 *   3. Chế độ thật (ghi vào en.json): node scripts/translate-en.cjs
 *   4. Chỉ dịch N batch đầu:          node scripts/translate-en.cjs --batches=3
 *   5. Dùng model mạnh hơn:           node scripts/translate-en.cjs --model=gpt-4o
 *
 * OUTPUT:
 *   - Cập nhật public/locales/en.json (bỏ prefix ⚠, thay bằng bản dịch thật)
 *   - In log chi tiết từng batch ra console
 *   - Ghi backup: public/locales/en.json.bak trước khi ghi
 *
 * CHI PHÍ ƯỚC TÍNH:
 *   ~977 key × ~40 tokens/key = ~39K tokens input + ~20K output
 *   GPT-4o-mini: ~$0.03  |  GPT-4o: ~$0.80
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.argv.find(a => a.startsWith('--model='))?.split('=')[1] || 'gpt-4o-mini';
const DRY_RUN = process.argv.includes('--dry-run');
const MAX_BATCHES_ARG = process.argv.find(a => a.startsWith('--batches='));
const MAX_BATCHES = MAX_BATCHES_ARG ? parseInt(MAX_BATCHES_ARG.split('=')[1]) : Infinity;
const BATCH_SIZE = 40; // keys per API call
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;

const VI_PATH = path.join(__dirname, '..', 'public', 'locales', 'vi.json');
const EN_PATH = path.join(__dirname, '..', 'public', 'locales', 'en.json');

// ─── GLOSSARY (bắt buộc, tránh dịch sai thuật ngữ ERP/kế toán) ──────────────
const GLOSSARY = `
MANDATORY GLOSSARY (always use these exact English terms):
- Phiếu nhập kho → Goods Receipt Note (GRN)
- Phiếu xuất kho → Delivery Note / Stock Out
- Nhập kho → Stock In / Goods Receipt
- Xuất kho → Stock Out / Goods Issue
- Tồn kho / Tồn → Inventory Balance / Stock
- Công nợ phải thu → Accounts Receivable (AR) — TK 131
- Công nợ phải trả → Accounts Payable (AP) — TK 331
- Khấu hao → Depreciation — TK 214
- Kiểm kê → Stocktake / Inventory Count
- Thuế GTGT / VAT GTGT → VAT (Value Added Tax)
- Kê khai thuế → Tax Declaration
- Số dư đầu kỳ → Opening Balance
- Báo giá → Quotation
- Đơn mua hàng → Purchase Order (PO)
- Yêu cầu mua hàng → Purchase Request (PR)
- Nhà cung cấp → Supplier
- Khách hàng → Customer
- Phân hệ → Module
- Sổ cái → General Ledger
- Bút toán → Journal Entry
- Hóa đơn đầu ra → Sales Invoice / Output Invoice
- Hóa đơn đầu vào → Purchase Invoice / Input Invoice
- Thông tư 200 / TT200 → Circular 200/2014/TT-BTC (Vietnamese Accounting Standard)
- Mã số thuế (MST) → Tax Identification Number (TIN)
- Tài sản cố định → Fixed Asset
- Phân bổ → Allocation
- Hạch toán → Posting / Booking
- Duyệt → Approve
- Từ chối → Reject
- Đợt kiểm kê → Stocktake Cycle
- Chênh lệch → Variance / Discrepancy
- Điều chỉnh kho → Stock Adjustment
- Chuyển kho → Stock Transfer
- Đơn vị tính (ĐVT) → Unit of Measure (UOM)
- Kho bãi → Warehouse
- Thủ kho → Warehouse Keeper
- Trưởng phòng → Department Head
- Nhân viên bán hàng → Sales Executive
- Kế toán trưởng → Chief Accountant
- Lead (CRM) → Lead
- Pipeline → Pipeline
- Hợp đồng chốt → Won Deal
- Shipper → Delivery Carrier / Shipper
- Bàn giao → Handover
- Hoàn tất → Complete / Finish
- Đang vận chuyển → In Transit
`.trim();

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a professional ERP/Accounting software translator (Vietnamese → English).
Context: Vietnamese ERP system following TT200 accounting standard, used by Vietnamese businesses.

${GLOSSARY}

RULES:
1. Return ONLY a valid JSON object: { "key": "english translation", ... }
2. No extra text, no markdown, no explanation.
3. Keep the same key names exactly as provided.
4. Translate to natural business English (not literal word-for-word).
5. UI labels: concise (e.g. "Thêm mới" → "Add New", not "Add New Item").
6. Error/toast messages: keep the tone (success/warning/error).
7. Placeholders like {name}, {count}, %s: preserve exactly.
8. Technical codes (SKU, VAT, PO, GRN): keep as-is or use standard abbreviation.
9. Vietnamese category names used as product categories (e.g. "Gia dụng", "Thời trang"): translate to natural English category names.`;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function callOpenAI(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(`OpenAI error: ${json.error.message}`));
          resolve(json.choices?.[0]?.message?.content || '{}');
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}\nRaw: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function translateBatch(batch, batchNum, totalBatches) {
  const userContent = JSON.stringify(
    Object.fromEntries(batch.map(({ key, vi }) => [key, vi])),
    null, 2
  );

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Translate these ${batch.length} Vietnamese UI strings to English.\nInput:\n${userContent}`
    }
  ];

  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt++) {
    try {
      console.log(`  [Batch ${batchNum}/${totalBatches}] Calling ${MODEL}... (attempt ${attempt})`);
      const raw = await callOpenAI(messages);
      const parsed = JSON.parse(raw);

      // Validate: mỗi key phải có trong response
      const result = {};
      let validCount = 0;
      for (const { key } of batch) {
        if (parsed[key] && typeof parsed[key] === 'string' && parsed[key].trim()) {
          result[key] = parsed[key].trim();
          validCount++;
        }
      }

      console.log(`  [Batch ${batchNum}/${totalBatches}] ✓ Got ${validCount}/${batch.length} translations`);
      return result;
    } catch (err) {
      console.error(`  [Batch ${batchNum}/${totalBatches}] ✗ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < RETRY_LIMIT) {
        console.log(`  Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.error(`  [Batch ${batchNum}/${totalBatches}] ✗ All ${RETRY_LIMIT} attempts failed. Skipping batch.`);
  return {};
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  // Validation
  if (!OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY is not set.');
    console.error('   Run: export OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  // Load files
  const vi = JSON.parse(fs.readFileSync(VI_PATH, 'utf8'));
  const en = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));

  // Thu thập key cần dịch (prefix ⚠ hoặc thiếu hoàn toàn)
  const toTranslate = [];
  for (const [key, enVal] of Object.entries(en)) {
    if (typeof enVal === 'string' && enVal.startsWith('⚠')) {
      const viVal = vi[key] || enVal.slice(2).trim();
      toTranslate.push({ key, vi: viVal });
    }
  }
  // Thêm key thiếu hoàn toàn
  for (const [key, viVal] of Object.entries(vi)) {
    if (!(key in en) && typeof viVal === 'string') {
      toTranslate.push({ key, vi: viVal });
    }
  }

  console.log(`\n🌐 ERPVIET — en.json Translation Script`);
  console.log(`   Model:    ${MODEL}`);
  console.log(`   Mode:     ${DRY_RUN ? '🔍 DRY RUN (no file changes)' : '✏️  WRITE MODE'}`);
  console.log(`   Keys to translate: ${toTranslate.length}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  // Tạo batches
  const batches = [];
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    batches.push(toTranslate.slice(i, i + BATCH_SIZE));
  }
  const batchesToRun = Math.min(batches.length, MAX_BATCHES);
  console.log(`   Total batches: ${batches.length} (running: ${batchesToRun})\n`);

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — showing first 5 keys per batch, no API calls made:\n');
    for (let i = 0; i < batchesToRun; i++) {
      console.log(`Batch ${i + 1}/${batchesToRun}:`);
      batches[i].slice(0, 5).forEach(({ key, vi: viVal }) => {
        console.log(`  "${key}": "${viVal}" → [would translate]`);
      });
      if (batches[i].length > 5) console.log(`  ... and ${batches[i].length - 5} more`);
    }
    console.log(`\n✅ Dry run complete. Remove --dry-run to execute.`);
    return;
  }

  // Backup
  fs.copyFileSync(EN_PATH, EN_PATH + '.bak');
  console.log(`📦 Backup saved: en.json.bak\n`);

  // Process batches
  let totalTranslated = 0;
  let totalFailed = 0;
  const allResults = {};

  for (let i = 0; i < batchesToRun; i++) {
    const batch = batches[i];
    const results = await translateBatch(batch, i + 1, batchesToRun);

    Object.assign(allResults, results);
    totalTranslated += Object.keys(results).length;
    totalFailed += batch.length - Object.keys(results).length;

    // Ghi vào en.json sau mỗi batch (tránh mất dữ liệu nếu crash)
    for (const [key, translation] of Object.entries(results)) {
      en[key] = translation;
    }
    fs.writeFileSync(EN_PATH, JSON.stringify(en, null, 2) + '\n');

    // Delay giữa các batch tránh rate limit
    if (i < batchesToRun - 1) {
      await sleep(500);
    }
  }

  // Summary
  const remaining = toTranslate.length - batchesToRun * BATCH_SIZE;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ DONE`);
  console.log(`   Translated:  ${totalTranslated} keys`);
  console.log(`   Failed:      ${totalFailed} keys`);
  if (remaining > 0) {
    console.log(`   Remaining:   ~${Math.max(0, remaining)} keys (run again to continue)`);
  }
  console.log(`   File saved:  ${EN_PATH}`);
  console.log(`\nNext steps:`);
  console.log(`   1. Review: git diff public/locales/en.json`);
  console.log(`   2. Check terminology: grep -i "sai_thuật_ngữ" public/locales/en.json`);
  console.log(`   3. Verify: node -e "const e=require('./public/locales/en.json'); console.log(Object.values(e).filter(v=>v.startsWith('⚠')).length + ' keys still untranslated')"`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
