# 🚀 HƯỚNG DẪN TRIỂN KHAI I18N — ERPVIET

> Tài liệu thực hành từng bước. Đọc hết trước khi chạy bất kỳ lệnh nào.
>
> **Cập nhật 2026-09-18 (issue `#12` + `#14`)**: từ điển đã đủ **1.373 key / 2 ngôn ngữ**, `isEn ?` = **0**,
> nợ hardcode còn **684** và bị khoá bởi ratchet `tests/i18n-hardcoded-baseline.json`. Phần 3–4 dưới đây là
> **quy trình chạy lại cho module còn nợ** (không còn là kế hoạch 977 key như bản gốc). Các script một lần của
> đợt cũ (`refactor-isen.cjs`, `extract-strings.cjs`, `generate-report.cjs`, `codemods/`…) đã xoá — xem
> `ISSUES_AND_FIXES.md` issue `#14`.

---

## ⚡ TÓM TẮT NHANH (cho người vội)

```bash
# Bước 0: nợ dịch còn bao nhiêu (toàn repo + theo từng file)
node scripts/i18n-count-hardcoded.cjs

# Bước 1: JSON và DB `sys_translations` có lệch nhau không
node scripts/sync-sources.cjs --check

# Bước 2: nối một module còn hardcode sang t() (dry-run trước!)
node scripts/i18n-wire-hardcoded.cjs --create-keys --files=src/pages/saas/SaaSQuotationsPage.tsx
node scripts/i18n-wire-hardcoded.cjs --create-keys --write --files=src/pages/saas/SaaSQuotationsPage.tsx

# Bước 3: key mới sinh có en="" → PHẢI dịch theo docs/i18n-glossary.md
#         (hoặc chạy translate-en.cjs nếu có OPENAI_API_KEY), rồi chốt baseline:
node scripts/i18n-count-hardcoded.cjs --write-baseline

# Bước 4: kiểm tra
npx tsc --noEmit -p tsconfig.json && npm test && npm run build
```

## PHẦN 1: HIỂU VẤN ĐỀ "2 NGUỒN DỊCH SONG SONG"

### 1.1 Hai nguồn dữ liệu tồn tại song song

```
┌──────────────────────────────────────────────────────────────────┐
│                    LUỒNG DỮ LIỆU I18N                           │
│                                                                  │
│  NGUỒN A: public/locales/vi.json + en.json                      │
│  ──────────────────────────────────────────                      │
│  • Bundle vào app khi `npm run build`                           │
│  • Load đồng bộ → zero network delay, hiển thị ngay lập tức     │
│  • Chỉnh sửa bằng: text editor → git commit                     │
│  • Đây là SOURCE OF TRUTH (nguồn sự thật)                       │
│                          │                                       │
│                          │ i18n.ts: import viLocale, enLocale   │
│                          ▼                                       │
│  RUNTIME i18next bundle (in-memory)                              │
│                          │                                       │
│                          │ applyLocaleOverlay() — sau paint      │
│                          ▼                                       │
│  NGUỒN B: DB bảng sys_translations                              │
│  ────────────────────────────────                                │
│  • Load async sau khi app đã render (tránh delay paint)          │
│  • Admin chỉnh sửa qua UI (Settings → Quản lý Dịch thuật)      │
│  • Override giá trị từ JSON — KHÔNG thay thế JSON               │
│  • Cache vào sessionStorage 5 phút                               │
│  • Tại thời điểm hiện tại: chỉ có 8 rows (nav menu)             │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Tại sao có vấn đề?

Hai nguồn có thể **lệch nhau** theo thời gian:

| Tình huống | Hậu quả |
|---|---|
| Admin sửa bản dịch qua UI → lưu vào DB | JSON vẫn cũ → sau khi deploy lại, UI override mới mất |
| Dev cập nhật JSON → commit | DB vẫn cũ → DB override ghi đè bản dịch mới của dev |
| DB có 8 rows, JSON có 1.406 keys | 1.398 key chỉ đọc từ JSON (DB không biết) |

### 1.3 Giải pháp: **Chốt JSON là nguồn sự thật**

```
NGUYÊN TẮC:
  JSON = nguồn sự thật (source of truth)  ← dev quản lý qua git
  DB   = runtime override (tùy chọn)      ← admin fine-tune qua UI

WORKFLOW:
  Dev chỉnh sửa JSON → git commit → deploy
  Admin muốn override → chỉnh qua UI → lưu DB
  Định kỳ: sync DB → JSON → commit (để DB edits không bị mất khi deploy)
```

---

## PHẦN 2: ĐỒNG BỘ 2 NGUỒN (scripts/sync-sources.cjs)

### 2.1 Kiểm tra tình trạng (không ghi gì)

```bash
node scripts/sync-sources.cjs --check
```

Output mẫu:
```
=== Keys chỉ có trong JSON (chưa sync lên DB) ===
  + "dashboard_total_revenue": vi="Tổng Doanh Thu" | en="Total Revenue"
  + "crm_lead_status": vi="Trạng thái Lead" | en="⚠ Trạng thái Lead"
  ... và 1398 key khác

=== Keys chỉ có trong DB ===
  (không có — DB chỉ có 8 rows)

=== Conflicts (2 nguồn lệch) ===
  (không có)

📊 KẾT QUẢ:
   JSON total keys: 1406
   DB total rows:   8
   Chỉ trong JSON:  1398
   Chỉ trong DB:    0
   Conflicts:       0
```

### 2.2 Upload JSON lên DB (sau khi dịch xong)

```bash
node scripts/sync-sources.cjs --json-to-db
```

**Khi nào dùng:** Sau khi chạy `translate-en.cjs` và review xong, upload toàn bộ lên DB để admin xem/sửa qua UI.

### 2.3 Download DB về JSON (khi admin sửa nhiều qua UI)

```bash
node scripts/sync-sources.cjs --db-to-json
```

**Khi nào dùng:** Admin đã chỉnh sửa nhiều key qua giao diện → muốn lưu vào git.

> ⚠️ Script tự backup vi.json.bak + en.json.bak trước khi ghi.

---

## PHẦN 3: DỊCH KEY CÒN THIẾU (scripts/translate-en.cjs)

> **Tình trạng 2026-09-18:** 977 key trong bản kế hoạch đã dịch xong (dịch tay + theo glossary),
> `en.json` = 1.373/1.373 key, 0 giá trị rỗng. Phần này còn dùng khi `--create-keys` sinh batch key mới.

### 3.1 Yêu cầu

- **OpenAI API Key** (GPT-4o-mini ~$0.03 cho toàn bộ, GPT-4o ~$0.80)
- **Hoặc** dịch thủ công theo hướng dẫn bên dưới

### 3.2 Setup

```bash
# Option A: Dùng OpenAI API
export OPENAI_API_KEY=sk-proj-...   # lấy từ platform.openai.com

# Option B: Ghi vào .env (không commit)
echo "OPENAI_API_KEY=sk-proj-..." >> .env
```

### 3.3 Chạy dịch

```bash
# Bước 1: Preview trước (không tốn tiền)
node scripts/translate-en.cjs --dry-run

# Bước 2: Dịch thật (ghi vào en.json)
node scripts/translate-en.cjs

# Chỉ dịch 3 batch đầu để test (~120 key)
node scripts/translate-en.cjs --batches=3

# Dùng model mạnh hơn cho thuật ngữ kế toán
node scripts/translate-en.cjs --model=gpt-4o
```

### 3.4 Review sau khi dịch

```bash
# Xem thay đổi
git diff public/locales/en.json

# Kiểm tra còn bao nhiêu key chưa dịch
node -e "
  const en = require('./public/locales/en.json');
  const left = Object.values(en).filter(v => v.startsWith('⚠')).length;
  console.log('Keys still untranslated:', left);
"

# Tìm từ nghi ngờ dịch sai (kiểm tra thuật ngữ kế toán)
grep -i "deprecation\|receivables\|payables\|warehouse keeper\|stocktake" public/locales/en.json
```

### 3.5 Phân loại để review đúng trọng tâm

| Nhóm | Số key | Cách review | Ai review |
|---|---|---|---|
| A — Thuật ngữ kế toán (`saas_*` liên quan TT200, VAT, kho) | ~200 | Đọc kỹ từng key | Dev + Kế toán |
| B — UI thông dụng (`saas_*` button, label, placeholder) | ~600 | Lướt nhanh, spot-check | Dev |
| C — API messages (`api_*`) | ~68 | Kiểm tra tone (success/error) | Dev |
| D — Navigation (`menu_*`, `dashboard_*`) | ~34 | Xác nhận ngắn gọn | Dev |

```bash
# Xem nhóm A (thuật ngữ kế toán quan trọng)
python3 -c "
import json
en = json.load(open('public/locales/en.json'))
vi = json.load(open('public/locales/vi.json'))
keys = [k for k in en if 'kho' in vi.get(k,'').lower() or 'ke_toan' in k or 'vat' in k.lower() or 'pxk' in k.lower()]
for k in keys[:20]:
    print(f'{k}: {vi.get(k,\"\")} → {en[k]}')
"
```

### 3.6 Nếu không có OpenAI API (dịch thủ công)

Script tạo file CSV để dịch trong Google Sheets:

```bash
node -e "
const vi = require('./public/locales/vi.json');
const en = require('./public/locales/en.json');
const rows = Object.entries(en)
  .filter(([_,v]) => v.startsWith('⚠'))
  .map(([k,v]) => [k, vi[k]||'', ''].join('\t'));
require('fs').writeFileSync('to-translate.tsv', 'key\tvi\ten\n' + rows.join('\n'));
console.log('Created to-translate.tsv — import vào Google Sheets để dịch');
"
```

Sau khi dịch trong Sheets, export CSV rồi import lại:

```bash
node -e "
const fs = require('fs');
const en = require('./public/locales/en.json');
// Đọc CSV đã dịch (cột: key, vi, en)
const csv = fs.readFileSync('translated.csv', 'utf8').trim().split('\n').slice(1);
csv.forEach(line => {
  const [key, _vi, enText] = line.split('\t');
  if (key && enText && enText.trim()) {
    en[key] = enText.trim();
  }
});
fs.writeFileSync('public/locales/en.json', JSON.stringify(en, null, 2) + '\n');
console.log('Done!');
"
```

---

## PHẦN 4: NỐI MODULE CÒN NỢ VÀO `t()` (codemod AST)

`isEn ?` / `language === 'en' ?` hiện bằng **0** và bị test guard chặn. Việc còn lại là **độ phủ**:
684 chuỗi tiếng Việt chưa đi qua từ điển, dồn ở 5 module:

| Module | Chuỗi hardcode | Ghi chú |
|---|---|---|
| `src/pages/saas/SaaSSettingsPage.tsx` | 64 | cài đặt, admin thấy nhiều |
| `src/pages/OrderDetailPage.tsx` | 42 | khách vãng lai |
| `src/pages/saas/SaaSPurchasingPage.tsx` | 41 | mua hàng |
| `src/pages/saas/SaaSWebOrdersPage.tsx` | 40 | đơn WebShop |
| `src/pages/saas/SaaSWarehousesPage.tsx` | 37 | kho |

Đầy đủ: `node scripts/i18n-count-hardcoded.cjs`.

### 4.1 Hai codemod (đều AST, idempotent, mặc định là dry-run)

```bash
# (a) ternary chọn ngôn ngữ → t() / pickLocalized / getIntlLocale
node scripts/refactor-lang-ternary.cjs            # dry-run + /tmp/i18n-plan.json
node scripts/refactor-lang-ternary.cjs --write

# (b) chuỗi hardcode → t(); --create-keys sinh key MỚI cho chuỗi chưa có trong từ điển,
#     tự chèn useLanguage() nếu component thiếu hook
node scripts/i18n-wire-hardcoded.cjs --files=src/pages/saas/SaaSSettingsPage.tsx          # xem kế hoạch
node scripts/i18n-wire-hardcoded.cjs --create-keys --files=src/pages/saas/SaaSSettingsPage.tsx
node scripts/i18n-wire-hardcoded.cjs --create-keys --write --files=src/pages/saas/SaaSSettingsPage.tsx
```

### 4.2 Quy trình cho MỘT module (làm từng file, không làm toàn repo)

```bash
F=src/pages/saas/SaaSSettingsPage.tsx
node scripts/i18n-wire-hardcoded.cjs --create-keys --write --files=$F
npx tsc --noEmit -p tsconfig.json          # bắt buộc: phát hiện t() ngoài scope / mất cú pháp

# các key mới có en="" → đọc /tmp/i18n-new-keys.json, dịch theo docs/i18n-glossary.md, rồi:
node scripts/i18n-count-hardcoded.cjs --write-baseline
npm test && npm run build
git add $F public/locales/ tests/i18n-hardcoded-baseline.json
git commit -m "refactor(i18n): nối $F vào từ điển"
```

### 4.3 Quy tắc bắt buộc (lý do từng điều)

- **Không** wrap chuỗi là dữ liệu: `value`, `id`, `accessorKey`, `className`, payload API — codemod đã whitelist
  theo `UI_ATTRS` (`label`/`title`/`placeholder`/`alt`/`aria-label`…) và **không** tạo key cho `description`/`notes`/`reason`.
- **Không tự bịa bản dịch**: giá trị VI được giữ nguyên làm defaultValue; EN phải do người dịch theo glossary.
- Một chuỗi VI → **một key** (script tái dùng key có giá trị VI khớp tuyệt đối trước khi tạo key mới).
- Tên key: snake_case ASCII, ≤ 5 từ / 44 ký tự, `_2` khi trùng; chạy `scripts/normalize-locales.js` nếu cần chuẩn hoá hàng loạt.


---

## PHẦN 5: CI GUARD (tests/i18n.test.ts)

### 5.1 Test đã được tạo sẵn tại `tests/i18n.test.ts`

```bash
# Chạy test
npm test

# Xem chi tiết
npm test -- --reporter=verbose
```

### 5.2 Test coverage

| Test | Mô tả | Fail khi |
|---|---|---|
| Key parity | en.json có đủ key từ vi.json | thiếu ≥1 key |
| No ⚠ prefix | Không còn key chưa dịch | còn ≥1 key có ⚠ |
| No isEn? | Không còn bypass inline | còn ≥1 chỗ `isEn ?` |
| Valid JSON | File JSON parse được | JSON bị lỗi cú pháp |
| Stats | In thống kê (không fail) | luôn pass |

### 5.3 Thêm vào CI (GitHub Actions)

Thêm vào `.github/workflows/ci.yml`:

```yaml
- name: i18n Quality Check
  run: npm test -- --reporter=verbose
```

---

## PHẦN 6: KIỂM TRA RUNTIME

Sau khi dịch xong, test thực tế trên UI:

```bash
npm run dev
```

Sau đó kiểm tra theo checklist:

- [ ] Chuyển sang English (EN) ở góc phải trên
- [ ] Dashboard: tất cả label, số liệu hiển thị tiếng Anh
- [ ] Products: tên cột, button, placeholder = tiếng Anh
- [ ] Inventory: "Stock In", "Stock Out", "Stocktake" đúng thuật ngữ
- [ ] Accounting: "General Ledger", "VAT", "Journal Entry" đúng
- [ ] CRM: "Lead", "Pipeline Value", "Won Deal" đúng
- [ ] Settings: menu, label, form đúng tiếng Anh
- [ ] Toast messages: "Saved successfully", "Error: ..." tiếng Anh

---

## PHẦN 7: TRẠNG THÁI THEO TỪNG BƯỚC

| Bước | Trạng thái | Ghi chú |
|---|---|---|
| Đồng bộ JSON ↔ DB (`sync-sources.cjs --check`) | ✅ | JSON là nguồn sự thật, overlay admin vẫn merge lúc chạy |
| Dịch `en.json` | ✅ | 1.373/1.373 key, 0 `⚠`, 0 EN còn dấu tiếng Việt (guard chặn) |
| Dọn key mồ côi / flatten | ✅ | xoá 169 key chết, backfill 7 key thiếu, làm phẳng `date_filter.*`/`auth_web.*` |
| Refactor ternary ngôn ngữ | ✅ | 543 điểm sửa; `isEn ?` = 0, `language === 'en' ?` = 0 |
| Nối hardcode → `t()` | 🟡 theo module | `SaaSAssets`/`SaaSStockIn`/`SaaSStockOut` xong; còn **684** chuỗi |
| CI guard | ✅ | `tests/i18n.test.ts` 14 test + ratchet baseline |
| CI thật (GitHub Actions) | ⬜ | chưa có workflow (issue `#19`) → verify bằng `npm test` local |


---

## PHẦN 8: TROUBLESHOOTING

### Lỗi: "OPENAI_API_KEY is not set"
```bash
export OPENAI_API_KEY=sk-proj-...
# hoặc thêm vào .env file (không commit .env)
```

### Lỗi: Batch dịch trả về JSON không hợp lệ
```bash
# Script tự retry 3 lần. Nếu vẫn lỗi, giảm batch size:
# Sửa BATCH_SIZE = 20 trong scripts/translate-en.cjs
```

### Lỗi: Database connection failed
```bash
# Kiểm tra .env có SUPABASE_DATABASE_URL hoặc DATABASE_URL chưa
cat .env | grep DATABASE
```

### en.json bị hỏng sau khi script chạy
```bash
# Restore từ backup
cp public/locales/en.json.bak public/locales/en.json
```

### Test fail: "X keys still untranslated" / en thiếu key
```bash
node scripts/translate-en.cjs            # cần OPENAI_API_KEY, hoặc dịch tay theo docs/i18n-glossary.md
```

### Test fail: "X chỗ còn dùng isEn ? inline"
```bash
node scripts/refactor-lang-ternary.cjs --write    # codemod thay ternary bằng t()/pickLocalized/getIntlLocale
```

### Test fail: "chuỗi hardcode tăng so với baseline"
```bash
node scripts/i18n-count-hardcoded.cjs              # xem file nào tăng
# hoặc, nếu đợt này thật sự đã nối thêm t():
node scripts/i18n-count-hardcoded.cjs --write-baseline
```

### Chuỗi trên UI in ra `undefined` / key thô
```bash
# key rỗng hoặc thiếu trong từ điển — kiểm tra 2 nguồn:
grep -rn "t(''" src | head        # codemod tạo key lỗi
node -e "const vi=require('./public/locales/vi.json'),en=require('./public/locales/en.json');
console.log('vi',Object.keys(vi).length,'en',Object.keys(en).length,
  '| thiếu:',Object.keys(vi).filter(k=>!(k in en)).slice(0,10))"
```
