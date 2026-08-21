# 🌐 KẾ HOẠCH HOÀN THIỆN I18N (Issue #12) — Dịch thuật & chuẩn hoá chuỗi

> Mục tiêu: tiếng Anh hiển thị đầy đủ, đúng và nhất quán trên cả WebShop + ERP SaaS.
> Trạng thái hiện tại đã đo đạc trực tiếp trên code tại branch `arena/01a01f8f-erpviet`.

---

## 1. HIỆN TRẠNG (số liệu thực tế, không ước lượng)

| Chỉ số | Giá trị | Ghi chú |
|---|---|---|
| `vi.json` | **1.402 key** | Nguồn sự thật của tiếng Việt |
| `en.json` | **481 key** | Chỉ đạt ~34% |
| Key có trong vi nhưng **thiếu trong en** | **921 key** | Đây là khối lượng dịch chính |
| Giá trị en **trùng tiếng Việt** (chưa dịch) | 18 giá trị | Cần dịch lại |
| Key có **ký tự tiếng Việt làm key** (anti-pattern) | 8 key | vd: `Điện tử`, `quản_lý_đơn_hàng_web` |
| Key trong `vi.json` không còn được code tham chiếu (mồ côi) | ~970 key | Tích tụ từ các lần scanner |
| Chuỗi tiếng Việt **hardcode trong TSX** | ~1.445 literal / 49 file | Bao gồm data + UI |
| Pattern `isEn ? 'EN' : 'VI'` inline (bỏ qua i18n) | **125 chỗ** | Cần refactor sang `t()` |
| Báo cáo scan cũ `missing-translations-report.md` | 1.031 chuỗi ứng viên | Đã lọc sẵn, dùng làm input |

**Kết luận:** bài toán #12 gồm **3 việc khác nhau**, không chỉ là "dịch 921 key":
1. **Làm sạch dữ liệu** (key mồ côi, key sai chuẩn, trùng lặp).
2. **Bổ sung + dịch `en.json`** (921 key thiếu + 18 giá trị chưa dịch).
3. **Refactor code** (~125 `isEn ?` inline + ~1.445 chuỗi hardcode → `t()`).

---

## 2. CƠ CHẾ I18N HIỆN TẠI (cần hiểu trước khi làm)

1. **JSON files** (`public/locales/vi.json`, `en.json`) — nguồn chính, được load async qua `src/i18n.ts`.
2. **DB `sys_translations`** — bảng ghi đè động, quản lý qua UI (tab "Quản lý Dịch thuật System" trong Settings) + API `/api/saas/translations/*`.
3. **`LanguageContext.t(key, defaultText)`** → `i18n.t(key, { defaultValue: defaultText })`: khi key thiếu, trả `defaultText` (thường là chuỗi tiếng Việt) — đây là lý do app **không vỡ** khi `en.json` thiếu, chỉ hiển thị tiếng Việt thay tiếng Anh.
4. **fallbackLng = "vi"** trong `i18n.ts` — mọi key thiếu ở en đều rơi về tiếng Việt.

> Hệ quả quan trọng: việc thiếu bản dịch **không gây lỗi**, chỉ ảnh hưởng chất lượng UX tiếng Anh. Vì vậy #12 là công việc "cải thiện chất lượng", có thể làm dần theo từng phần, không phải big-bang.

---

## 3. QUYẾT ĐỊNH CHIẾN LƯỢC (leader cần chốt)

| Quyết định | Đề xuất | Lý do |
|---|---|---|
| Nguồn sự thật | **`vi.json` + `en.json`** là nguồn; `sys_translations` chỉ là overrides runtime | Tránh 2 nguồn lệch nhau |
| Dịch bulk | **Auto-translate (LLM/Google Translate) → người review** cho 921 key thường; **dịch tay** cho thuật ngữ kế toán/đặc thù | Cân bằng tốc độ & độ chính xác |
| Refactor hardcode | Làm theo **module** (không làm toàn bộ 1 lần) | Giảm rủi ro, dễ review |
| Key naming | Chuẩn hoá về **snake_case tiếng Anh**; bỏ key chứa tiếng Việt | Đồng nhất với scanner |

---

## 4. LỘ TRÌNH 5 GIAI ĐOẠN

### Giai đoạn 0 — Chuẩn hoá key & dọn dẹp (data hygiene)

**Mục tiêu:** làm nền sạch trước khi dịch.

| Việc | Cách làm | Công cụ/lệnh |
|---|---|---|
| 0.1 Xác định key mồ côi | Đối chiếu key trong `vi.json` với chuỗi tham chiếu trong code | `scripts/analyze-i18n.cjs` (có sẵn) |
| 0.2 Xoá/giữ key mồ côi | Chỉ xoá key **chắc chắn** không dùng (không xuất hiện dạng `t('...')`/`t("...")`); giữ lại nếu nghi ngờ | script mới `scripts/purge-orphan-keys.ts` |
| 0.3 Sửa 8 key tiếng Việt | `Điện tử`→`category_electronics`, `quản_lý_đơn_hàng_web`→`web_order_management`... (kèm cập nhật chỗ gọi trong code) | tay + `grep` |
| 0.4 Xoá key trùng lặp | Key trùng chỉ khác hoa/thường hoặc `-`/`_` | `scripts/cleanup-duplicate-keys.ts` (có sẵn) |
| 0.5 Chuẩn hoá thứ tự | Sort key A→Z trong cả 2 file JSON để diff sạch | `scripts/normalize-locales.js` (có sẵn) |

**Output:** `vi.json`/`en.json` sạch, key nhất quán. Commit riêng.

---

### Giai đoạn 1 — Đồng bộ cấu trúc (parity) — KHÔNG dịch

**Mục tiêu:** `en.json` có đủ 1.402 key như `vi.json` (giá trị tạm = tiếng Việt để không mất nội dung).

```bash
# Tạo bản đồ key thiếu → ghi vào en.json với giá trị = vi (đánh dấu TODO)
npx tsx scripts/sync-en-keys.ts   # script mới, sinh từ vi.json
```

Script `scripts/sync-en-keys.ts` (mới):
```ts
// Đọc vi.json, đảm bảo en.json có đủ key; key mới gán giá trị = vi + prefix "⚠ "
import fs from 'fs';
const vi = JSON.parse(fs.readFileSync('public/locales/vi.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('public/locales/en.json', 'utf8'));
let added = 0;
for (const [k, v] of Object.entries(vi)) {
  if (!(k in en)) { en[k] = `⚠ ${v}`; added++; }
}
fs.writeFileSync('public/locales/en.json', JSON.stringify(en, null, 2) + '\n');
console.log(`en.json: đã thêm ${added} key (chưa dịch, đánh dấu ⚠)`);
```

**Output:** parity key đạt 100%; mọi key chưa dịch có prefix `⚠` để lọc sau. Commit riêng.

---

### Giai đoạn 2 — Dịch bulk + review (khối lượng chính)

**2.1 Phân loại key thành 3 nhóm:**

| Nhóm | Ví dụ | Phương pháp |
|---|---|---|
| A. Thuật ngữ kế toán/ERP đặc thù | `vat_declaration`, `cong_no`, `fifo`, `tai_san_co_dinh` | **Dịch tay + glossary**, cần người am hiểu TT200 |
| B. Chuỗi UI thông dụng | `save`, `cancel`, `search_placeholder` | **Auto-translate** rồi review nhanh |
| C. Chuỗi dài/mô tả | tooltip, hướng dẫn | Auto-translate + review kỹ |

**2.2 Xây glossary chuẩn (bắt buộc, tránh dịch lệch thuật ngữ):**

Tạo `docs/i18n-glossary.md`:
| Tiếng Việt | Tiếng Anh chuẩn |
|---|---|
| Phiếu nhập kho | Goods Receipt Note (GRN) |
| Phiếu xuất kho | Delivery Note / Stock Out |
| Báo giá | Quotation |
| Công nợ | Accounts Receivable / Payable |
| Khấu hao | Depreciation |
| Kiểm kê | Stocktake / Inventory Count |
| Nhà cung cấp | Supplier |
| Khách hàng | Customer |

**2.3 Quy trình dịch bulk (đề xuất 2 bước):**
1. Sinh bản nháp tự động cho 921 key (LLM batching ~50 key/lần, dùng glossary làm context).
2. Ghi vào `en.json` (bỏ prefix `⚠` khi đã dịch).
3. Review: 1 người rà nhóm A+C, 1 người rà nhóm B.

**Output:** `en.json` hoàn chỉnh 1.402 key. Commit riêng.

---

### Giai đoạn 3 — Refactor code (hardcode → t())

**3.1 Ưu tiên theo file nặng nhất (đã đo):**

| File | Số ký tự VN | Ưu tiên |
|---|---|---|
| `SaaSUsersRbacTab.tsx` | 1.856 | 1 |
| `SaaSSettingsPage.tsx` | 1.844 | 2 |
| `SaaSCategoriesUnitsPage.tsx` | 1.692 | 3 |
| `SaaSPurchasingPage.tsx` | 1.567 | 4 |
| `SaaSStockOutPage.tsx` | 1.274 | 5 |
| ... (còn lại làm dần) | | |

**3.2 Hai pattern cần xử lý:**
- **`isEn ? 'EN' : 'VI'`** (125 chỗ): thay bằng `t('key', 'VI')` và đưa cả 2 ngôn ngữ vào JSON.
- **Chuỗi tiếng Việt trần**: chạy scanner sinh key rồi wrap.

**3.3 Dùng scanner bán tự động:**
```bash
# Preview key sẽ sinh (không ghi)
npx tsx scripts/scan-translations.ts "src/pages/saas/SaaSPurchasingPage.tsx"

# Ghi key vào vi.json/en.json (en là placeholder, dịch ở Giai đoạn 2)
npx tsx scripts/scan-translations.ts "src/pages/saas/SaaSPurchasingPage.tsx" --write
```
> Lưu ý: scanner chỉ **sinh key**, không tự sửa code gọi. Cần thêm bước AST rewrite (`scripts/replace-with-i18n-ast.js` có sẵn) hoặc sửa tay từng chỗ — đánh giá kỹ trước khi chạy hàng loạt để tránh wrap nhầm chuỗi dữ liệu (option values, API payload).

**Output:** mỗi file refactor = 1 commit riêng, kèm `npm run lint && npm run build`.

---

### Giai đoạn 4 — QA & chốt (Definition of Done)

| Kiểm tra | Cách làm |
|---|---|
| Key parity | `Object.keys(vi).length === Object.keys(en).length` |
| Không còn `⚠ ` trong en.json | `grep -c "⚠" public/locales/en.json` = 0 |
| Không còn `isEn ?` inline | `grep -rE "isEn \?" src --include=*.tsx` = 0 (hoặc giảm dần theo plan) |
| Runtime | Bật English ở WebShop + SaaS, duyệt các trang chính (Dashboard, Products, Orders, Inventory, Accounting, VAT, Settings) |
| CI guard | Thêm test kiểm tra parity + phát hiện `⚠ ` (giống `tests/security-regression.test.ts`) |

Test guard gợi ý (`tests/i18n.test.ts`):
```ts
import { it, expect } from 'vitest';
import vi from '../public/locales/vi.json';
import en from '../public/locales/en.json';

it('en.json đủ key so với vi.json', () => {
  for (const k of Object.keys(vi)) expect(en, `thiếu key ${k}`).toHaveProperty(k);
});
it('không còn key chưa dịch (prefix ⚠)', () => {
  for (const [k, v] of Object.entries(en)) expect(v as string, k).not.toMatch(/^⚠/);
});
```

---

## 5. ƯỚC LƯỢNG EFFORT & RỦI RO

| Giai đoạn | Ước lượng | Người thực hiện |
|---|---|---|
| 0 — Data hygiene | 0.5 ngày | Dev |
| 1 — Parity | 0.5 ngày | Dev (script) |
| 2 — Dịch bulk + review | 2–4 ngày | Translator + 1 reviewer (domain) |
| 3 — Refactor code | 3–5 ngày (chia nhỏ theo file) | Dev |
| 4 — QA & CI | 1 ngày | Dev + QA |

**Rủi ro chính:**
1. **Dịch sai thuật ngữ kế toán** → bắt buộc có glossary + reviewer domain.
2. **Scanner wrap nhầm chuỗi dữ liệu** → luôn preview trước `--write`, review diff từng file.
3. **Lệch giữa JSON và DB overrides** → chốt JSON là nguồn sự thật, publish DB về JSON khi xong.
4. **Phạm vi lớn** → làm theo module, mỗi commit nhỏ, có CI chạy `lint`/`test`/`build` chặn lỗi.

---

## 6. THỨ TỰ ƯU TIÊN KHI CÓ ÍT THỜI GIAN

Nếu chỉ được làm một phần, ưu tiên:
1. **Giai đoạn 1 + nhóm B của Giai đoạn 2** (key UI thông dụng) — cải thiện rõ nhất với ít effort.
2. **Nhóm A (thuật ngữ kế toán)** — vì ERP, phần này sai là mất uy tín chuyên môn.
3. **Refactor `isEn ?`** ở các trang khách hàng hay xem nhất (Dashboard, Products, Orders).

---

> Ghi chú: đây là kế hoạch (plan). Chưa có thay đổi code nào được thực hiện trong tài liệu này.
