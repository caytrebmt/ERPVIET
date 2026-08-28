# 🌐 PHÂN TÍCH VẤN ĐỀ I18N & PHƯƠNG ÁN TỐI ƯU

> Phân tích thực tế từ source code tại branch `arena/01a0478a-erpviet`  
> Ngày: 2026-08-28

---

## 1. HIỆN TRẠNG THỰC TẾ (số liệu đo từ code)

| Chỉ số | Giá trị | Trạng thái |
|---|---|---|
| `vi.json` | **1.406 key** | Nguồn sự thật tiếng Việt ✅ |
| `en.json` tổng | **1.372 key** | Gần đủ về số lượng |
| Keys đã dịch thật sang tiếng Anh | **392 key** (~27.9%) | ⚠️ Rất thấp |
| Keys chưa dịch (prefix `⚠`) | **977 key** (~69.5%) | ❌ Vấn đề chính |
| Keys có trong vi nhưng thiếu en | **35 key** | ❌ Cần bổ sung |
| Pattern `isEn ? 'EN' : 'VI'` inline | **138 chỗ / 7 file** | ❌ Bypass i18n hoàn toàn |
| Chuỗi hardcode tiếng Việt trong TSX | **~1.031 chuỗi** | ❌ Chưa đưa vào i18n |

### Ba lớp vấn đề song song

```
┌─────────────────────────────────────────────────────────────────┐
│  LỚP 1: en.json thiếu bản dịch thật (977/1372 key dùng prefix ⚠)│
│  → App hiển thị "⚠ Thao tác" thay vì "Actions"                 │
├─────────────────────────────────────────────────────────────────┤
│  LỚP 2: isEn ? 'EN' : 'VI' inline (138 chỗ)                    │
│  → Bypass toàn bộ hệ thống i18n, không hưởng lợi từ JSON/DB    │
├─────────────────────────────────────────────────────────────────┤
│  LỚP 3: Chuỗi hardcode trong TSX (~1.031 chuỗi)                │
│  → Chưa được wrap bằng t(), không thể dịch được                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. KIẾN TRÚC I18N HIỆN TẠI

```
┌──────────────────────────────────────────────────────────┐
│                  KIẾN TRÚC 3 TẦNG                        │
│                                                          │
│  Tầng 1: public/locales/vi.json + en.json (bundle)       │
│          └─ load đồng bộ khi app khởi động (i18n.ts)    │
│                  ↓ fallbackLng = "vi"                    │
│  Tầng 2: DB sys_translations (override runtime)          │
│          └─ admin chỉnh sửa qua UI, merge sau paint      │
│                  ↓ sessionStorage cache 5 phút           │
│  Tầng 3: LanguageContext.t(key, defaultText)             │
│          └─ nếu thiếu key → trả defaultText (tiếng Việt)│
└──────────────────────────────────────────────────────────┘
```

**Điểm mạnh hiện tại:**
- i18next + react-i18next: industry standard ✅
- Bundle cả 2 locale vào app → zero network delay ✅
- fallback vi → không bao giờ crash ✅
- sessionStorage cache → tránh fetch lại liên tục ✅
- Hỗ trợ DB override runtime qua UI ✅

**Điểm yếu:**
- `keySeparator: false` → không hỗ trợ nested key (có thể scale sau)
- Thiếu CI guard kiểm tra parity + ⚠ còn sót

---

## 3. PHƯƠNG ÁN TỐI ƯU: "LLM-Assisted Batch Translation + CI Guard"

### Lý do chọn phương án này

Dự án có **977 key cần dịch** thuộc nhiều lĩnh vực: kế toán (TT200), ERP, VAT, kho bãi, CRM...
Không thể dịch tay toàn bộ (quá chậm), không thể dùng Google Translate thuần (thiếu context ERP).

**LLM-Assisted Batch** = LLM hiểu ngữ cảnh domain + tốc độ cao + chi phí thấp + human review layer.

---

## 4. PHƯƠNG ÁN CHI TIẾT: 4 BƯỚC

### Bước 1 — Tạo Glossary chuẩn (1–2 giờ)

Tạo file `docs/i18n-glossary.md` chứa thuật ngữ kế toán/ERP bắt buộc:

| Tiếng Việt | Tiếng Anh chuẩn | Ghi chú |
|---|---|---|
| Phiếu nhập kho | Goods Receipt Note (GRN) | TT200 |
| Phiếu xuất kho | Delivery Note / Stock Out | TT200 |
| Công nợ phải thu | Accounts Receivable | TK 131 |
| Công nợ phải trả | Accounts Payable | TK 331 |
| Khấu hao | Depreciation | TK 214 |
| Kiểm kê | Stocktake / Inventory Count | |
| Thuế GTGT | VAT (Value Added Tax) | |
| Kê khai thuế | Tax Declaration | |
| Số dư đầu kỳ | Opening Balance | |
| Tồn kho | Inventory Balance | |
| Nhà cung cấp | Supplier | |
| Báo giá | Quotation | |
| Đơn mua hàng | Purchase Order (PO) | |
| Yêu cầu mua | Purchase Request (PR) | |

→ Glossary này làm **context bắt buộc** khi gọi LLM, tránh dịch sai thuật ngữ domain.

---

### Bước 2 — Auto-translate 977 key bằng LLM (batch 50 key/lần)

**Script: `scripts/translate-with-llm.ts`**

```ts
// Pseudo-code của script
const BATCH_SIZE = 50;
const keys_to_translate = Object.entries(en)
  .filter(([_, v]) => v.startsWith('⚠'))
  .map(([k, v]) => ({ key: k, vi: v.slice(2).trim() }));

for (const batch of chunks(keys_to_translate, BATCH_SIZE)) {
  const prompt = `
    You are an ERP/Accounting translator (Vietnamese → English).
    Domain: Vietnamese ERP system following TT200 accounting standard.
    
    Glossary (MUST follow):
    ${glossary}
    
    Translate each Vietnamese text to natural English.
    Return JSON: { "key": "english translation" }
    
    Input: ${JSON.stringify(batch)}
  `;
  // Gọi API → parse JSON → ghi vào en.json (bỏ prefix ⚠)
}
```

**Phân nhóm để xử lý đúng thứ tự:**

| Nhóm | Ví dụ key | Cách xử lý |
|---|---|---|
| A — Thuật ngữ kế toán | `vat_declaration`, `cong_no`, `fifo` | LLM + glossary + review tay bắt buộc |
| B — UI thông dụng | `save`, `cancel`, `search_placeholder` | LLM auto → review nhanh (1 lượt) |
| C — Chuỗi dài / tooltip | mô tả chức năng | LLM + review kỹ hơn |

---

### Bước 3 — Refactor `isEn ? 'EN' : 'VI'` → `t('key')` (138 chỗ, 7 file)

**Thứ tự ưu tiên (theo tần suất user xem):**

| File | Số chỗ cần fix | Ưu tiên |
|---|---|---|
| `SaaSCRMPage.tsx` | ~30 | 1 |
| `SaaSDashboardPage.tsx` | ~20 | 2 |
| `SaaSSidebar.tsx` | ~15 | 3 |
| `SaaSSettingsPage.tsx` | ~25 | 4 |
| `SaaSTenantsPage.tsx` | ~15 | 5 |
| `SaaSPurchasingPage.tsx` | ~20 | 6 |
| `SaaSRegisterPage.tsx` | ~13 | 7 |

**Pattern chuyển đổi:**
```tsx
// ❌ TRƯỚC (bypass i18n)
{isEn ? 'Total Leads' : 'Tổng Cơ Hội Kinh Doanh'}

// ✅ SAU (đúng chuẩn i18n)
{t('crm_total_leads', 'Tổng Cơ Hội Kinh Doanh')}
// → thêm key vào vi.json: "crm_total_leads": "Tổng Cơ Hội Kinh Doanh"
// → thêm key vào en.json: "crm_total_leads": "Total Leads"
```

---

### Bước 4 — CI Guard (không bao giờ lùi lại)

Thêm test `tests/i18n.test.ts`:

```ts
import { it, expect } from 'vitest';
import vi from '../public/locales/vi.json';
import en from '../public/locales/en.json';

it('en.json đủ key so với vi.json (key parity)', () => {
  for (const k of Object.keys(vi)) {
    expect(en, `Thiếu key trong en.json: "${k}"`).toHaveProperty(k);
  }
});

it('Không còn key chưa dịch (không có prefix ⚠)', () => {
  for (const [k, v] of Object.entries(en)) {
    if (typeof v === 'string') {
      expect(v, `Key "${k}" chưa được dịch (còn prefix ⚠)`).not.toMatch(/^⚠/);
    }
  }
});

it('Không còn isEn ? inline trong source code', () => {
  // Đọc tất cả file TSX/TS và kiểm tra pattern
  // → Chạy grep, expect count === 0
});
```

---

## 5. ƯU ĐIỂM & NHƯỢC ĐIỂM CHI TIẾT

### ✅ ƯU ĐIỂM

| # | Ưu điểm | Giải thích |
|---|---|---|
| 1 | **Tốc độ cao** | LLM batch 50 key/lần, ~977 key ≈ 20 lần gọi, hoàn thành trong vài giờ thay vì vài ngày |
| 2 | **Hiểu ngữ cảnh domain** | LLM hiểu "Phiếu xuất kho" trong ERP context khác với dịch thông thường |
| 3 | **Tận dụng hạ tầng có sẵn** | i18next + react-i18next + DB override đã sẵn sàng, không cần thay đổi kiến trúc |
| 4 | **Chi phí thấp** | ~977 key × ~30 token/key = ~30K tokens, khoảng $0.03–0.10 với GPT-4o-mini |
| 5 | **Có human review layer** | Glossary làm guard rail; nhóm A (thuật ngữ kế toán) review tay bắt buộc |
| 6 | **CI Guard ngăn thoái lùi** | Test tự động chặn merge nếu có key thiếu hoặc còn prefix ⚠ |
| 7 | **Rollback an toàn** | en.json là file text → git diff rõ ràng, rollback = git revert |
| 8 | **Không vỡ runtime** | fallbackLng="vi" đảm bảo app không crash ngay cả khi key bị sai |
| 9 | **Làm dần theo module** | Mỗi batch = 1 commit, không cần big-bang |
| 10 | **Nhất quán thuật ngữ** | Glossary dùng xuyên suốt, không bị mỗi người dịch một kiểu |

### ❌ NHƯỢC ĐIỂM & RỦI RO

| # | Nhược điểm | Mức độ | Cách giảm thiểu |
|---|---|---|---|
| 1 | **LLM có thể dịch sai thuật ngữ kế toán** | Cao | Bắt buộc có glossary + reviewer domain (kế toán) review nhóm A |
| 2 | **977 key cần review sau dịch** | Trung bình | Phân nhóm B (UI thông dụng) review nhanh; nhóm A review kỹ |
| 3 | **Dịch thiếu văn phong tự nhiên** | Trung bình | Dùng LLM mạnh (GPT-4o/Claude 3.5); thêm instruction "natural business English" |
| 4 | **Chi phí API nếu dùng LLM thương mại** | Thấp | ~$0.1–0.5 toàn bộ; hoặc dùng LLM local (Ollama) miễn phí |
| 5 | **isEn ? refactor dễ gây bug nếu key sai** | Trung bình | Mỗi file refactor = 1 commit riêng + chạy lint + build ngay sau |
| 6 | **Chuỗi hardcode ~1.031 còn lại** | Trung bình | Làm theo module; scanner chỉ preview trước khi write |
| 7 | **Lệch giữa JSON và DB override** | Thấp | Chốt JSON là nguồn sự thật; DB chỉ là runtime override, không thay thế JSON |
| 8 | **key naming không nhất quán** | Thấp | Chuẩn hóa snake_case tiếng Anh cho key mới; giữ key cũ để không phá code |

---

## 6. SO SÁNH VỚI CÁC PHƯƠNG ÁN KHÁC

| Phương án | Tốc độ | Chi phí | Chất lượng | Rủi ro | Đánh giá |
|---|---|---|---|---|---|
| **A. LLM Batch + Glossary + Review** (đề xuất) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Thấp | ✅ **Tối ưu** |
| B. Dịch tay toàn bộ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | Thấp | ❌ Quá chậm (977 key × 3–5 phút/key = 2–4 tuần) |
| C. Google Translate thuần | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | Cao | ❌ Dịch sai thuật ngữ ERP/kế toán |
| D. Thay toàn bộ kiến trúc i18n | ⭐⭐ | ⭐ | ⭐⭐⭐⭐ | Rất cao | ❌ Không cần thiết, kiến trúc hiện tại đã tốt |
| E. Chỉ fix isEn? trước | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | Thấp | ⚠️ Chưa đủ (977 key ⚠ vẫn còn) |

---

## 7. LỘ TRÌNH TRIỂN KHAI (timeline thực tế)

```
Ngày 1 (0.5 ngày) — Chuẩn bị
  ├── Tạo glossary thuật ngữ ERP/kế toán
  ├── Thêm 35 key thiếu vào en.json
  └── Setup script translate-with-llm.ts

Ngày 1–2 (1 ngày) — Dịch bulk
  ├── Batch A: ~200 key thuật ngữ kế toán → LLM + review kỹ
  ├── Batch B: ~600 key UI thông dụng → LLM + review nhanh
  └── Batch C: ~177 key dài/tooltip → LLM + review trung bình

Ngày 2–3 (1 ngày) — Refactor isEn?
  ├── SaaSCRMPage.tsx (ưu tiên 1)
  ├── SaaSDashboardPage.tsx (ưu tiên 2)
  └── SaaSSidebar.tsx (ưu tiên 3)

Ngày 3–4 (1 ngày) — Refactor isEn? tiếp
  ├── SaaSSettingsPage.tsx
  ├── SaaSTenantsPage.tsx
  ├── SaaSPurchasingPage.tsx
  └── SaaSRegisterPage.tsx

Ngày 4–5 (0.5 ngày) — CI Guard + QA
  ├── tests/i18n.test.ts
  ├── Runtime test: bật EN, duyệt 10 trang chính
  └── Kiểm tra không còn ⚠ và isEn? trong code
```

**Tổng effort ước tính: 4–5 ngày (1 Dev + 0.5 ngày Reviewer domain kế toán)**

---

## 8. ĐỊNH NGHĨA HOÀN THÀNH (Definition of Done)

```bash
# Chạy các lệnh này → TẤT CẢ phải pass

# 1. Key parity
node -e "
  const vi = require('./public/locales/vi.json');
  const en = require('./public/locales/en.json');
  const missing = Object.keys(vi).filter(k => !en[k]);
  console.log('Missing in en:', missing.length); // → 0
"

# 2. Không còn key chưa dịch
grep -c '⚠' public/locales/en.json  # → 0

# 3. Không còn isEn ? inline
grep -rE "isEn \?" src --include="*.tsx" | wc -l  # → 0

# 4. Build thành công
npm run build

# 5. Test pass
npm test
```

---

## 9. KẾT LUẬN

**Phương án tối ưu: LLM-Assisted Batch Translation + CI Guard**

Lý do đây là phương án tốt nhất cho dự án ERPVIET:

1. **Kiến trúc i18n hiện tại đã đúng** (i18next + react-i18next + DB override) — không cần thay đổi, chỉ cần điền nội dung còn thiếu.

2. **Nút thắt thực sự** không phải là thiếu key về số lượng (1.372/1.406 ≈ 97.6%) mà là **977/1.372 key vẫn chứa tiếng Việt** và **138 chỗ bypass i18n hoàn toàn bằng `isEn ?`**.

3. **LLM Batch** giải quyết được nút thắt lớn nhất (977 key) với tốc độ nhanh và chi phí thấp, trong khi glossary + human review đảm bảo độ chính xác thuật ngữ domain.

4. **CI Guard** là "bảo hiểm" dài hạn — ngăn tình trạng tích lũy nợ kỹ thuật i18n như hiện tại không tái diễn.

> **Ưu tiên làm ngay:** Dịch 977 key ⚠ (LLM batch) → Refactor 138 isEn? → Thêm CI test.
> Không cần đụng vào kiến trúc i18n — nền tảng đã được xây đúng.
