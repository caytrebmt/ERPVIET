# 🚀 HƯỚNG DẪN TRIỂN KHAI I18N — ERPVIET

> Tài liệu thực hành từng bước. Đọc hết trước khi chạy bất kỳ lệnh nào.

---

## ⚡ TÓM TẮT NHANH (cho người vội)

```bash
# Bước 0: xem tình trạng hiện tại
npm test -- --reporter=verbose 2>&1 | grep -A5 "Statistics"

# Bước 1: check 2 nguồn JSON vs DB có lệch không
node scripts/sync-sources.cjs --check

# Bước 2: dịch 977 key còn thiếu (cần OPENAI_API_KEY)
export OPENAI_API_KEY=sk-...
node scripts/translate-en.cjs --dry-run   # xem trước
node scripts/translate-en.cjs             # dịch thật

# Bước 3: xem báo cáo isEn? cần refactor
node scripts/refactor-isen.cjs

# Bước 4: chạy test kiểm tra
npm test
```

---

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

## PHẦN 3: DỊCH 977 KEY (scripts/translate-en.cjs)

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

## PHẦN 4: REFACTOR `isEn ?` (138 chỗ / 7 file)

### 4.1 Xem báo cáo đầy đủ

```bash
node scripts/refactor-isen.cjs
# → In danh sách 138 chỗ cần sửa, kèm key gợi ý và snippet
# → Ghi scripts/isen-report.json để tooling

# Xem 1 file cụ thể
node scripts/refactor-isen.cjs --file=src/pages/saas/SaaSCRMPage.tsx
```

### 4.2 Quy trình refactor từng file (làm TỪ TỪNG FILE, không làm cùng lúc)

```bash
# Ví dụ: refactor SaaSCRMPage.tsx

# 1. Xem báo cáo file này
node scripts/refactor-isen.cjs --file=src/pages/saas/SaaSCRMPage.tsx

# 2. Mở file, tìm và thay thế từng pattern:
#    TRƯỚC:  {isEn ? 'Total Leads' : 'Tổng Cơ Hội Kinh Doanh'}
#    SAU:    {t('crm_total_leads', 'Tổng Cơ Hội Kinh Doanh')}

# 3. Thêm key vào vi.json:
#    "crm_total_leads": "Tổng Cơ Hội Kinh Doanh"

# 4. Thêm key vào en.json:
#    "crm_total_leads": "Total Leads"

# 5. Build + test
npm run build 2>&1 | tail -5
npm test

# 6. Commit FILE này (không commit nhiều file cùng lúc)
git add src/pages/saas/SaaSCRMPage.tsx public/locales/
git commit -m "refactor(i18n): replace isEn? with t() in SaaSCRMPage"
```

### 4.3 Thứ tự file ưu tiên

| # | File | isEn? count | Ưu tiên vì |
|---|---|---|---|
| 1 | `SaaSCRMPage.tsx` | ~30 | User hay xem |
| 2 | `SaaSDashboardPage.tsx` | ~20 | Trang đầu tiên sau login |
| 3 | `SaaSSidebar.tsx` | ~15 | Hiển thị mọi trang |
| 4 | `SaaSSettingsPage.tsx` | ~25 | Cài đặt quan trọng |
| 5 | `SaaSTenantsPage.tsx` | ~15 | Admin platform |
| 6 | `SaaSPurchasingPage.tsx` | ~20 | Mua hàng |
| 7 | `SaaSRegisterPage.tsx` | ~13 | Đăng ký |

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

## PHẦN 7: TIMELINE VÀ PHÂN CÔNG

```
Ngày 1 — Setup & Sync (0.5 ngày)
  ├── Cài OPENAI_API_KEY
  ├── Chạy sync-sources.cjs --check
  └── Review I18N_DEPLOY_GUIDE.md + glossary

Ngày 1-2 — Dịch bulk (1 ngày)
  ├── Chạy translate-en.cjs (toàn bộ 977 key, ~30 phút runtime)
  ├── Review nhóm A (thuật ngữ kế toán) — khoảng 3-4 giờ
  └── Commit: "feat(i18n): translate 977 missing en.json keys"

Ngày 2-3 — Refactor isEn? (1 ngày)
  ├── SaaSCRMPage + SaaSDashboardPage + SaaSSidebar
  └── Mỗi file = 1 commit riêng

Ngày 3-4 — Refactor tiếp (1 ngày)
  ├── SaaSSettingsPage + SaaSTenantsPage + SaaSPurchasingPage + SaaSRegisterPage
  └── Mỗi file = 1 commit riêng

Ngày 4-5 — QA + Sync DB (0.5 ngày)
  ├── npm test → tất cả pass
  ├── Runtime test (checklist ở Phần 6)
  ├── node scripts/sync-sources.cjs --json-to-db
  └── Commit final: "feat(i18n): complete EN translation + i18n CI guard"
```

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

### Test fail: "X keys still untranslated"
```bash
# Chạy lại translate script
node scripts/translate-en.cjs
```

### Test fail: "X chỗ còn dùng isEn ? inline"
```bash
# Xem báo cáo và refactor
node scripts/refactor-isen.cjs
```
