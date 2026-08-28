/**
 * scripts/optimize-keys.cjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Tối ưu key i18n: xóa orphan dài, merge duplicate, báo cáo cần rename
 *
 * CÁCH DÙNG:
 *   node scripts/optimize-keys.cjs --report      → báo cáo đầy đủ, không ghi
 *   node scripts/optimize-keys.cjs --purge-orphan → xóa key dài > 40 không dùng
 *   node scripts/optimize-keys.cjs --merge-dupl   → merge key trùng value về 1 key
 *   node scripts/optimize-keys.cjs --fix-vi-keys  → đổi key chứa ký tự VN
 *   node scripts/optimize-keys.cjs --all-safe     → chạy tất cả bước an toàn (không cần sửa code)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT    = path.join(__dirname, '..');
const VI_PATH = path.join(ROOT, 'public', 'locales', 'vi.json');
const EN_PATH = path.join(ROOT, 'public', 'locales', 'en.json');
const SRC_DIR = path.join(ROOT, 'src');

const MODE = {
  report:      process.argv.includes('--report'),
  purgeOrphan: process.argv.includes('--purge-orphan'),
  mergeDupl:   process.argv.includes('--merge-dupl'),
  fixViKeys:   process.argv.includes('--fix-vi-keys'),
  allSafe:     process.argv.includes('--all-safe'),
};
if (!Object.values(MODE).some(Boolean)) MODE.report = true; // default

// ─── Helpers ────────────────────────────────────────────────────────────────
function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n');
}

function backup() {
  fs.copyFileSync(VI_PATH, VI_PATH + '.bak');
  fs.copyFileSync(EN_PATH, EN_PATH + '.bak');
  console.log('  📦 Backup: vi.json.bak + en.json.bak\n');
}

/** Đọc toàn bộ code nguồn một lần */
function readAllSrc() {
  try {
    return execSync(
      `find ${SRC_DIR} -name "*.tsx" -o -name "*.ts" | xargs cat 2>/dev/null`,
      { maxBuffer: 50 * 1024 * 1024 }
    ).toString();
  } catch { return ''; }
}

function isKeyUsedInCode(key, allCode) {
  return allCode.includes(`'${key}'`) || allCode.includes(`"${key}"`);
}

function hasViChars(str) {
  return /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴĐ]/.test(str);
}

/** Tạo key chuẩn từ key cũ chứa ký tự VN */
function normalizeViKey(k) {
  const map = {
    'Điện tử': 'category_electronics',
    'Văn phòng phẩm': 'category_office_supplies',
    'Thực phẩm': 'category_food_grocery',
    'Ô tô - Xe máy': 'category_auto_moto',
    'Thời trang': 'category_fashion',
    'Gia dụng': 'category_home_appliances',
    'quản_lý_đơn_hàng_web': 'web_order_management',
    'nhà_cung_cấp_&_đối_tác': 'suppliers_partners',
  };
  return map[k] || k;
}

// ─── REPORT ────────────────────────────────────────────────────────────────
function doReport(vi, en, allCode) {
  const keys = Object.keys(vi).filter(k => !k.startsWith('_') && typeof vi[k] === 'string');

  // Phân loại key dài
  const long40  = keys.filter(k => k.length > 40);
  const longCalled  = long40.filter(k => isKeyUsedInCode(k, allCode));
  const longOrphan  = long40.filter(k => !isKeyUsedInCode(k, allCode));

  // Duplicate values
  const valMap = {};
  keys.forEach(k => {
    const v = vi[k];
    if (!valMap[v]) valMap[v] = [];
    valMap[v].push(k);
  });
  const duplGroups = Object.entries(valMap).filter(([, ks]) => ks.length > 1);

  // Bad vi keys
  const viKeyNames = keys.filter(k => hasViChars(k));

  // Bundle size
  const viSize  = JSON.stringify(vi).length;
  const enSize  = JSON.stringify(en).length;
  const totalKeyBytes = keys.reduce((s, k) => s + k.length, 0);
  const savedOrphan   = longOrphan.reduce((s, k) => s + k.length, 0);
  const savedDupl     = duplGroups.reduce((s, [, ks]) =>
    s + ks.slice(1).reduce((a, k) => a + k.length, 0), 0);

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║          ERPVIET — i18n Key Optimization Report                     ║
╚══════════════════════════════════════════════════════════════════════╝

📊 TỔNG QUAN
  vi.json size:         ${(viSize/1024).toFixed(1)} KB
  en.json size:         ${(enSize/1024).toFixed(1)} KB
  Tổng keys:            ${keys.length}
  Tổng bytes (key):     ${totalKeyBytes.toLocaleString()} / ${viSize.toLocaleString()} bytes (${(totalKeyBytes/viSize*100).toFixed(0)}%)
  Avg key length:       ${(totalKeyBytes/keys.length).toFixed(1)} chars

  Phân phối:
    ≤ 20 chars:  ${keys.filter(k=>k.length<=20).length} keys
    21–40 chars: ${keys.filter(k=>k.length>20&&k.length<=40).length} keys
    41–60 chars: ${keys.filter(k=>k.length>40&&k.length<=60).length} keys
    61–80 chars: ${keys.filter(k=>k.length>60&&k.length<=80).length} keys
    > 80 chars:  ${keys.filter(k=>k.length>80).length} keys

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[A] KEY DÀI > 40 CHARS VÀ ĐƯỢC CODE GỌI → cần RENAME (${longCalled.length} keys)
    → Cần: đổi key trong JSON + tìm-thay trong code
    → Tiết kiệm nếu rename về <= 40 chars: ~${longCalled.reduce((s,k)=>s+Math.max(0,k.length-35),0)} chars`);

  longCalled.slice(0, 10).forEach(k => {
    console.log(`    [${k.length}] ${k.slice(0, 80)}`);
    console.log(`         → "${vi[k].slice(0, 60)}"`);
  });
  if (longCalled.length > 10) console.log(`    ... và ${longCalled.length - 10} keys khác (xem scripts/key-report.json)`);

  console.log(`
[B] KEY DÀI > 40 CHARS VÀ KHÔNG DÙNG (orphan) → CÓ THỂ XÓA (${longOrphan.length} keys)
    → Không cần sửa code, chỉ xóa khỏi JSON
    → Tiết kiệm: ~${(savedOrphan * 2 / 1024).toFixed(1)} KB (vi + en)`);

  longOrphan.slice(0, 8).forEach(k => {
    console.log(`    [${k.length}] ${k.slice(0, 80)}`);
  });
  if (longOrphan.length > 8) console.log(`    ... và ${longOrphan.length - 8} keys khác`);

  console.log(`
[C] KEY TRÙNG VALUE (duplicate) → MERGE về 1 key (${duplGroups.length} nhóm, ${duplGroups.reduce((s,[,ks])=>s+ks.length-1,0)} key thừa)
    → Xóa key thừa, đổi code dùng key canonical
    → Tiết kiệm: ~${(savedDupl * 2 / 1024).toFixed(1)} KB`);

  duplGroups.slice(0, 8).forEach(([val, ks]) => {
    console.log(`    Value: "${val.slice(0, 50)}"`);
    const canonical = ks.find(k => isKeyUsedInCode(k, allCode)) || ks[0];
    ks.forEach(k => {
      const used = isKeyUsedInCode(k, allCode) ? '✓used' : ' orphan';
      const tag  = k === canonical ? '→ KEEP' : '  drop';
      console.log(`      [${used}] ${tag} ${k}`);
    });
  });

  console.log(`
[D] KEY CHỨA KÝ TỰ TIẾNG VIỆT → RENAME (${viKeyNames.length} keys)
    → Đổi thành snake_case tiếng Anh`);

  viKeyNames.forEach(k => {
    console.log(`    "${k}" → "${normalizeViKey(k)}"`);
  });

  const totalSaved = (savedOrphan + savedDupl) * 2;
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 TỔNG KẾT ƯỚC TÍNH:
  Xóa [B] orphan dài:   ${longOrphan.length} keys, ~${(savedOrphan*2/1024).toFixed(1)} KB   ← AN TOÀN (không sửa code)
  Merge [C] duplicate:  ${duplGroups.reduce((s,[,ks])=>s+ks.length-1,0)} keys, ~${(savedDupl*2/1024).toFixed(1)} KB   ← AN TOÀN nếu orphan
  Rename [A] long+used: ${longCalled.length} keys          ← cần sửa code
  Fix [D] vi key names: ${viKeyNames.length} keys          ← cần sửa code

  Tổng tiết kiệm (bước B+C): ~${(totalSaved/1024).toFixed(1)} KB (cả 2 file)
  Lợi ích THỰC SỰ: maintainability, DX, autocomplete trong IDE

LỆNH CHẠY:
  node scripts/optimize-keys.cjs --purge-orphan   # bước B
  node scripts/optimize-keys.cjs --merge-dupl     # bước C
  node scripts/optimize-keys.cjs --fix-vi-keys    # bước D
  node scripts/optimize-keys.cjs --all-safe       # B + C + D cùng lúc
`);

  // Ghi JSON report
  const reportPath = path.join(ROOT, 'scripts', 'key-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    stats: {
      totalKeys: keys.length,
      avgLen: parseFloat((totalKeyBytes/keys.length).toFixed(1)),
      viSizeKB: parseFloat((viSize/1024).toFixed(1)),
      enSizeKB: parseFloat((enSize/1024).toFixed(1)),
    },
    longAndCalled:  longCalled.map(k => ({ key: k, len: k.length, vi: vi[k] })),
    longAndOrphan:  longOrphan.map(k => ({ key: k, len: k.length, vi: vi[k] })),
    duplicates:     duplGroups.map(([val, ks]) => ({
      value: val,
      canonical: ks.find(k => isKeyUsedInCode(k, allCode)) || ks[0],
      keys: ks,
    })),
    viKeyNames: viKeyNames.map(k => ({ old: k, new: normalizeViKey(k) })),
  }, null, 2));
  console.log(`  📋 Full report: scripts/key-report.json`);
}

// ─── PURGE ORPHAN (bước B) ─────────────────────────────────────────────────
function doPurgeOrphan(vi, en, allCode) {
  console.log('\n🗑️  [B] Xóa key dài > 40 chars không được dùng trong code...\n');
  backup();

  const keys = Object.keys(vi).filter(k => !k.startsWith('_') && typeof vi[k] === 'string');
  const toDelete = keys.filter(k => k.length > 40 && !isKeyUsedInCode(k, allCode));

  toDelete.forEach(k => {
    delete vi[k];
    delete en[k];
  });

  saveJson(VI_PATH, vi);
  saveJson(EN_PATH, en);

  console.log(`  ✅ Đã xóa ${toDelete.length} keys dài > 40 chars (orphan)`);
  console.log(`  vi.json: ${Object.keys(vi).length} keys còn lại`);
  toDelete.slice(0, 10).forEach(k => console.log(`    - [${k.length}] ${k}`));
  if (toDelete.length > 10) console.log(`    ... và ${toDelete.length - 10} keys khác`);
}

// ─── MERGE DUPLICATE (bước C) ──────────────────────────────────────────────
function doMergeDupl(vi, en, allCode) {
  console.log('\n🔀 [C] Merge key trùng value...\n');
  backup();

  const keys = Object.keys(vi).filter(k => !k.startsWith('_') && typeof vi[k] === 'string');
  const valMap = {};
  keys.forEach(k => {
    const v = vi[k];
    if (!valMap[v]) valMap[v] = [];
    valMap[v].push(k);
  });

  let merged = 0;
  const renames = []; // để log

  Object.entries(valMap)
    .filter(([, ks]) => ks.length > 1)
    .forEach(([, ks]) => {
      // Chọn canonical: ưu tiên key ngắn nhất và đang được dùng
      const canonical = [...ks]
        .sort((a, b) => a.length - b.length)
        .find(k => isKeyUsedInCode(k, allCode))
        || [...ks].sort((a, b) => a.length - b.length)[0];

      ks.filter(k => k !== canonical).forEach(k => {
        // Chỉ xóa key ORPHAN — key đang được code gọi thì chỉ log cảnh báo
        if (!isKeyUsedInCode(k, allCode)) {
          renames.push({ del: k, keep: canonical });
          delete vi[k];
          delete en[k];
          merged++;
        } else {
          console.log(`  ⚠️  SKIP (code đang dùng): "${k}" → canonical: "${canonical}"`);
        }
      });
    });

  saveJson(VI_PATH, vi);
  saveJson(EN_PATH, en);

  console.log(`  ✅ Đã xóa ${merged} key trùng (orphan)`);
  renames.slice(0, 10).forEach(r =>
    console.log(`    - "${r.del}" → kept "${r.keep}"`)
  );
}

// ─── FIX VN KEY NAMES (bước D) ─────────────────────────────────────────────
function doFixViKeys(vi, en, allCode) {
  console.log('\n🔤 [D] Đổi key chứa ký tự tiếng Việt...\n');
  backup();

  const viKeyNames = Object.keys(vi).filter(k => hasViChars(k));
  let fixed = 0;

  viKeyNames.forEach(oldKey => {
    const newKey = normalizeViKey(oldKey);
    if (newKey === oldKey) return;

    vi[newKey] = vi[oldKey];
    en[newKey] = en[oldKey] || vi[oldKey];
    delete vi[oldKey];
    delete en[oldKey];

    if (isKeyUsedInCode(oldKey, allCode)) {
      console.log(`  ⚠️  KEY ĐƯỢC CODE DÙNG: "${oldKey}" → "${newKey}"`);
      console.log(`      → Bạn cần tìm-thay trong code: grep -rn "'${oldKey}'" src/`);
    } else {
      console.log(`  ✅ "${oldKey}" → "${newKey}"`);
    }
    fixed++;
  });

  saveJson(VI_PATH, vi);
  saveJson(EN_PATH, en);
  console.log(`\n  Fixed ${fixed} key names`);
}

// ─── MAIN ───────────────────────────────────────────────────────────────────
(function main() {
  console.log('\n🔧 ERPVIET — i18n Key Optimizer\n');

  const vi = loadJson(VI_PATH);
  const en = loadJson(EN_PATH);

  console.log('  Đang đọc source code...');
  const allCode = readAllSrc();
  console.log(`  Source code loaded (${(allCode.length/1024).toFixed(0)} KB)\n`);

  if (MODE.report || MODE.allSafe) doReport(vi, en, allCode);

  if (MODE.purgeOrphan || MODE.allSafe) doPurgeOrphan(vi, en, allCode);
  if (MODE.mergeDupl   || MODE.allSafe) doMergeDupl(vi, en, allCode);
  if (MODE.fixViKeys   || MODE.allSafe) doFixViKeys(vi, en, allCode);

  if (MODE.allSafe) {
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ --all-safe hoàn thành. Các bước còn lại cần sửa code thủ công:
   Xem scripts/key-report.json → mục "longAndCalled" (${loadJson(path.join(ROOT,'scripts','key-report.json')).longAndCalled?.length || '?'} keys)
   Mỗi key: tìm trong code → đổi sang tên ngắn hơn → cập nhật JSON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
  }
})();
