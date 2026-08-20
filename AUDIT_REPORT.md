# 🔍 BÁO CÁO KIỂM TRA TỔNG THỂ DỰ ÁN ERPVIET

> **Người thực hiện:** Technical Leader (kiểm tra tổng thể theo phản hồi của khách hàng)
> **Ngày:** 2026-08-20 · **Branch:** `arena/01a01eb1-erpviet`
> **Phản hồi khách hàng:** *"Dự án gặp nhiều vấn đề, chưa hoạt động hoàn toàn, nhiều nghiệp vụ vẫn không chạy."*

---

## 1. KẾT LUẬN CHÍNH (EXECUTIVE SUMMARY)

**Nhận định của khách hàng là CHÍNH XÁC.** Sau khi dựng môi trường thật (Node 22 + PostgreSQL 18 + server dev + database full 120 bảng) và test tự động 52 luồng API end-to-end, tôi xác định:

| # | Chẩn đoán | Bằng chứng |
|---|-----------|------------|
| 1 | **Hệ thống KHÔNG khởi động được trên database mới** (đã sửa trong đợt này) | Server crash ngay lúc boot vì chạy `ALTER TABLE product_images` **trước khi** tạo schema |
| 2 | **~60% module ERP chỉ là "giao diện trình diễn"** — KHÔNG ghi dữ liệu thật | 10/25 trang ERP không gọi API nào; dữ liệu nằm trong state React / localStorage / mock cứng, refresh là mất |
| 3 | **3 endpoint API lỗi 500** do code query sai tên cột so với schema (đã sửa trong đợt này) | `/api/saas/menus`, `/api/saas/roles`, `/api/saas/crm/opportunities` |
| 4 | **Lỗ hổng bảo mật nghiêm trọng**: API quản trị không xác thực (đã sửa trong đợt này) | Tạo/sửa/xóa sản phẩm, xem danh sách khách hàng, **đổi mật khẩu khách hàng** — tất cả gọi được không cần đăng nhập |
| 5 | **Luồng bán hàng đứt đoạn nghiệp vụ**: đặt hàng không kiểm tra/giảm tồn kho, VAT hardcode 10%, tra cứu đơn bằng token không hoạt động (token đã sửa) | Test end-to-end + đọc code |
| 6. | Chất lượng build/TypeScript: **PASS** — vấn đề KHÔNG nằm ở compile, mà ở **nghiệp vụ & tích hợp** | `tsc` 0 lỗi, `vite build` thành công |

**Tình trạng sau đợt hotfix này:** script E2E đạt **52/52** luồng có backend; các lỗi P0 (boot, 500, bảo mật, token tra cứu) đã được vá và xác minh lại. Phần còn lại (module mock, nghiệp vụ ghi) cần theo lộ trình ở mục 6.

---

## 2. PHƯƠNG PHÁP KIỂM TRA

1. **Môi trường thật:** dựng PostgreSQL 18 local, nạp `schema.sql` + `insertdata.sql` (120 bảng, ~100 user ERP, 100 khách web, 1.000 đơn web, 500 sản phẩm), chạy `npm run dev` + `npm run build` + `tsc --noEmit`.
2. **Phân tĩnh:** rà toàn bộ `src/api` (1.900+ dòng router), `src/services`, `src/pages/saas` (25 trang), đối chiếu từng cặp **UI ↔ API ↔ DB schema**.
3. **Phân động:** viết `scripts/e2e-audit.mjs` — 52 kịch bản gọi API thật (đăng nhập ERP sai/đúng, danh mục, tồn kho, nhập kho, đăng ký/đăng nhập/giỏ hàng/đặt hàng WebShop, đơn admin, các endpoint thiếu). Kết quả: `audit-results.json`.
4. **Kiểm chứng bảo mật:** gọi các endpoint quản trị **không kèm token** ngay từ curl.

---

## 3. Ma trận trạng thái nghiệp vụ (UI ↔ Backend ↔ DB)

Chú thích: ✅ hoạt động thật · ⚠️ chạy một phần · ❌ không hoạt động (mock/locally only)

| Module ERP (`/saas`) | Trang UI có | API backend | Ghi DB thật | Đánh giá |
|---|---|---|---|---|
| Đăng nhập / phân quyền JWT | ✅ | ✅ | ✅ | ⚠️ Hoạt động, nhưng bỏ qua password sai kiểu plaintext-fallback, refresh token giả |
| Dashboard | ✅ | ⚠️ mượn `/shop/catalog` | — | ⚠️ Số liệu không từ ERP thật |
| Sản phẩm (ERP) | ✅ | ⚠️ qua `/api/shop/admin/products` | ✅ | ⚠️ Đã thêm auth; còn phụ thuộc shop API |
| Đơn hàng Web | ✅ | ✅ | ✅ | ⚠️ Duyệt đơn không tạo phiếu xuất kho |
| Tồn kho / XNT | ✅ | ✅ (GET) | ✅ | ⚠️ UI chỉ xem; `POST /inventory/movements` backend có sẵn **nhưng không trang nào gọi** |
| Nhập kho (PNK) | ✅ | ❌ không gọi API | ❌ | ❌ Toast "thành công" nhưng chỉ lưu state React → mất khi refresh |
| Xuất kho (PXK) | ✅ | ❌ chỉ đổi trạng thái đơn | ❌ | ❌ Không trừ tồn kho khi xuất |
| Kiểm kê | ✅ | ❌ | ❌ | ❌ Trang không gọi API nào |
| Kho hàng | ✅ | ❌ | ❌ | ❌ CRUD chỉ trên state React |
| Báo giá | ✅ | ✅ (GET) | ⚠️ | ❌ Tạo/sửa chỉ state React, không POST |
| Mua hàng (PR→RFQ→PO) | ✅ | ✅ (GET) | ⚠️ | ❌ Ghi vào **localStorage trình duyệt** (`procurementStore.ts`) — mất khi đổi máy, không đa tenant |
| CRM (Lead/Cơ hội) | ✅ | ✅ (GET) | ✅ | ❌ Trang UI không gọi API, không tạo/sửa được |
| Nhà cung cấp | ✅ | ✅ (GET) | ✅ | ❌ Trang UI không load, không CRUD |
| Công nợ | ✅ | ❌ | ❌ | ❌ Không có API, thanh toán chỉ state |
| VAT / Hóa đơn | ✅ | ❌ | ❌ | ❌ Trang rỗng (`records = []`) |
| Kế toán TT200 | ✅ | ❌ | ❌ | ❌ Bút toán rỗng, tài khoản hardcode |
| Báo cáo tài chính | ✅ | ❌ | ❌ | ❌ Toàn bộ mảng dữ liệu rỗng |
| TSCD | ✅ | ❌ | ❌ | ❌ `MOCK_ASSETS` cứng trong code |
| Audit log | ✅ | ✅ (GET) | ✅ | ❌ Trang dùng `MOCK_LOGS` cứng, không gọi API có sẵn |
| Nhân viên/Users | ✅ | ✅ CRUD | ✅ | ✅ |
| Tenant/SaaS | ✅ | ✅ | ✅ | ⚠️ Đa tenant lỏng: nhiều query không lọc company_id |
| i18n / Ngôn ngữ | ✅ | ✅ | ✅ | ⚠️ `missing-translations-report.md` còn ~1.000 chuỗi chưa dịch |

**WebShop (`/`):** catalog, chi tiết SP, giỏ hàng (guest + login), đăng ký/đăng nhập, đặt hàng, tra cứu đơn — ✅ hoạt động thật; ⚠️ thiếu: hủy đơn, đặt lại đơn, kiểm tra tồn khi mua, mã giảm giá (UI gọi `POST /promotions/validate` không tồn tại).

---

## 4. DANH SÁCH LỖI CHI TIẾT THEO MỨC ĐỘ

### 🔴 P0 — Blocker / Bảo mật (đã vá ✅ trong đợt này)

| Mã | Vấn đề | Hậu quả | Trạng thái |
|----|--------|---------|-----------|
| P0-1 | `server.ts`: chạy `ensureProductImageSchema()` (ALTER bảng) **trước** `autoMigrateDatabase()` | Deploy lên DB mới → **server crash ngay lập tức**, auto-migration không bao giờ chạy — đúng hiện tượng "không chạy được" | ✅ Đã đổi thứ tự + bọc try/catch, xác minh boot sạch trên DB mới |
| P0-2 | 9 endpoint `/api/shop/admin/*` (tạo/sửa/xóa sản phẩm, xem khách, **đổi mật khẩu khách**, duyệt đơn) **không có xác thực** | Bất kỳ ai trên internet cũng chiếm quyền quản trị, đọc PII, đổi mật khẩu khách hàng | ✅ Đã thêm middleware `requireSaasStaff` (chỉ nhận JWT nhân viên ERP, từ chối token `web_customer`, gán `companyId` từ token); curl không token giờ trả 401/403 |
| P0-3 | `GET /api/saas/menus` query cột `path`,`icon` — schema có `path_url`,`icon_name` | 500 | ✅ Đã sửa query |
| P0-4 | `GET /api/saas/roles` query `description_en/vi` — schema chỉ có `description` | 500 | ✅ Đã sửa query |
| P0-5 | `GET /api/saas/crm/opportunities` join `crm_contacts.contact_id` — schema là `crm_leads.lead_id` | 500 | ✅ Đã sửa join |
| P0-6 | `web_orders` không có cột `tracking_token`, `vat_amount`, `note` → sinh token xong **vứt bỏ**, tra cứu theo token bất khả thi | Khách không tra cứu được đơn bằng token ở trang thành công | ✅ Đã thêm cột (idempotent, cả trong `schema.sql`), lưu khi INSERT, lookup `code OR tracking_token` — test tra cứu thành công |
| P0-7 | Vite dev server chặn host preview/domain ngoài (không có `allowedHosts`) | Không xem được app qua domain proxy/preview | ✅ Đã thêm `allowedHosts: true` |

### 🟠 P1 — Nghiệp vụ cốt lõi sai hoặc đứt (cần làm tiếp)

| Mã | Vấn đề | Chi tiết |
|----|--------|----------|
| P1-1 | **Nhập/Xuất kho không ghi DB** | `SaaSStockInPage` / `SaaSStockOutPage` lưu phiếu bằng `useState` → toast "thành công" nhưng DB không có phiếu, tồn kho không đổi. Backend `postInventoryMovement()` (transaction chuẩn) **đã có sẵn** — UI chỉ cần gọi. |
| P1-2 | **Bán hàng không trừ tồn kho** | Duyệt đơn web chỉ `UPDATE web_orders.order_status`; không tạo PXK, không giảm `stock_balances`. Không có kiểm tra tồn khi khách đặt → bán hàng hóa không có kho. |
| P1-3 | **Module Mua hàng lưu bằng localStorage** (`procurementStore.ts`) | PR/RFQ/PO không xuống DB → không đa tenant, mất khi đổi trình duyệt/máy, quản lý không thấy. |
| P1-4 | **Báo giá chỉ lưu state React** | Backend chỉ có GET; thiếu POST/PUT/DELETE + máy in/chuyển đổi đơn hàng. |
| P1-5 | **VAT hardcode 10%** trên đơn web (`vat = (subtotal-discount)*0.1`) | Giá web VN thường đã gồm VAT → tổng đơn sai hiển thị khách; `vat_amount` giờ đã lưu được nhưng cách tính vẫn sai. |
| P1-6 | **Tin tưởng giá do client gửi** khi đặt hàng (`unit_price` từ body) | Khách có thể sửa giá = 1đ. Server phải đọc lại giá từ DB. |
| P1-7 | **Đặt hàng không dùng transaction** | Chèn đơn OK nhưng chèn item lỗi giữa chừng → đơn không có dòng hàng, không rollback. |
| P1-8 | `webCustomerId` nhận từ body (có thể giả mạo) | Router nên lấy từ token đã xác thực thay vì tin client. |
| P1-9 | **UI gọi endpoint không tồn tại** | `POST /api/shop/promotions/validate`, `POST /api/shop/orders/:id/cancel`, `POST /api/shop/orders/:id/reorder` → 404, nút bấm lỗi. |
| P1-10 | 10 trang ERP **không có lấy/gửi dữ liệu** (Kho, NCC, Công nợ, VAT, Kế toán, Báo cáo, TSCD, Kiểm kê, CRM, AuditLog) | Trang trắng/rỗng dữ liệu — cảm nhận "nghiệp vụ không chạy" của khách hàng bắt nguồn chủ yếu từ đây. |

### 🟡 P2 — Chất lượng / hiệu năng / đúng đắn dữ liệu

1. **Đa tenant lỏng:** nhiều GET (`/departments`, `/categories`, `/uom`, `/roles`, `/menus`…) không lọc `company_id`; tenant webshop fallback về công ty 1 khi không xác định slug → dữ liệu công ty này lẫn sang công ty khác.
2. **`/inventory/balances` trả toàn bộ** (500 SP × N kho), không filter/pagination — chậm dần theo dữ liệu.
3. **`fetchOrders()` full-scan** mỗi lần tìm 1 đơn (trong `updateOrderStatus`, `createNewOrder`…).
4. **Định nghĩa route trùng lặp** trong `saasRouter.ts`: `/translations/all`, `POST /translations`, `DELETE /translations/:key` mỗi cái định nghĩa 2 lần (bản sau là dead-code, dễ gây regress khi sửa nhầm bản không chạy).
5. **JWT secret fallback hardcode** (`jwt-secret-webshop-2026`) và mật khẩu demo hardcode trong code — phải bắt buộc biến môi trường ở production.
6. **Đăng nhập ERP có nhánh so sánh mật khẩu plaintext** (fallback legacy) — rủi ro giảm chuẩn hash.
7. **Gọi `/api/shop/admin/products?limit=1000`** cho ERP Products/Quotations/StockIn/StockOut — sai tầng kiến trúc, tải thừa, lộ giá vốn cho token sai phạm vi (đã chặn auth, còn lại là thiết kế).
8. **Repo bẩn:** file rác ở gốc (`--extensions`, `-d`, `npx` rỗng), 2 file schema song song (`schema.sql`, `schema - fix.sql`, `schema_fixes.sql`) không ai biết bản nào thật; `candidates.json`, `codemods/`, `check_toasts.js` là công cụ một lần để lẫn trong nguồn.
9. **`customerId = webCustomerId + 100`** — ánh xạ ID giả, gây nhiễu dữ liệu.
10. **Hủy đơn không trả tồn kho / không hoàn khuyến mãi**; không có state machine cho `order_status` (cho phép nhảy trạng thái tùy ý).
11. **i18n:** `en.json` chỉ ~37KB so với `vi.json` 114KB; báo cáo `missing-translations-report.md` tự sinh đã disclose ~1.000 chuỗi chưa dịch.
12. **SaaS ERP & Netlify function**: đã có warm-start probe DB (tốt), nhưng `ensureProductImageSchema/ensureWebOrderSchema` không chạy trên Netlify function → DB Supabase production có thể thiếu cột mới.

---

## 5. NHỮNG GÌ ĐÃ SỬA TRONG ĐỢT NÀY (đã xác minh lại bằng test)

| File | Thay đổi | Kiểm chứng |
|------|----------|-----------|
| `server.ts` | Đổi thứ tự migrate → ensure-schema; try/catch boot; gọi `ensureWebOrderSchema` | Boot DB mới (`erpacc_fresh`): tự tạo 120 bảng, server sống, login 200 |
| `src/db/index.ts` | Thêm `ensureWebOrderSchema()` (thêm cột `tracking_token`, `vat_amount`, `note`, `updated_at` idempotent + index) | Cột tồn tại trên DB cũ không cần can thiệp tay |
| `src/api/saasRouter.ts` | Sửa 3 query sai tên cột (`sys_menus`, `sys_roles`, `crm_opportunities`) | 3 endpoint 500 → 200 |
| `src/api/shopRouter.ts` | Thêm middleware `requireSaasStaff` + gắn vào 9 route `/admin/*` | Không token → 401; token web_customer → 403; token ERP → 200 |
| `src/services/shopOrderService.ts` | INSERT lưu `tracking_token/vat_amount/note`; tra cứu đơn `code OR tracking_token` | Đặt hàng → nhận token → `GET /orders/track/tr_xxx` trả đúng đơn |
| `src/api/client.ts` | URL `/api/shop/admin/*` ưu tiên token ERP (tránh gửi nhầm token khách) | Logic interceptor |
| `schema.sql` | Bổ sung cột + index cho `web_orders` | Bản cài mới đầy đủ |
| `vite.config.ts` | `allowedHosts: true`, `host: true` | Preview domain ngoài hoạt động |
| `scripts/e2e-audit.mjs` *(mới)* | Bộ test E2E 52 kịch bản tái sử dụng | **52/52 đạt** trên các luồng có backend (trước vá: 47/52 + 3 lỗi 500 + lỗ hổng admin) |

---

## 6. HƯỚNG GIẢI QUYẾT — LỘ TRÌNH ĐỀ XUẤT

### Giai đoạn 1 — Cứu nghiệp vụ kho & bán hàng (1–2 tuần · 1 dev)
1. Gắn `SaaSStockInPage`/`SaaSStockOutPage` vào `POST /api/saas/inventory/movements` (backend đã có, chỉ cần UI gọi).
2. Duyệt đơn web → tạo PXK tự động (giảm tồn, có kiểm tra tồn) trong 1 transaction; hủy đơn → trả tồn.
3. Đặt hàng web: kiểm tra tồn + **server định giá lại** từ DB + transaction đơn/items + `webCustomerId` từ token.
4. Thêm 3 endpoint còn thiếu: `promotions/validate`, `orders/:id/cancel`, `orders/:id/reorder`.
5. Đính chính VAT theo cấu hình từng sản phẩm (gồm/không gồm VAT) thay vì hardcode 10%.

### Giai đoạn 2 — Hoàn thiện module ERP đang là "vỏ" (3–5 tuần · 1–2 dev)
6. Mua hàng: chuyển PR/RFQ/PO từ localStorage xuống DB (bảng đã có trong schema) + luồng duyệt, nhận hàng → PNK tự động + công nợ NCC.
7. Báo giá: POST/PUT/DELETE + duyệt → chuyển đơn hàng; in PDF.
8. Kho hàng, NCC, Kiểm kê, CRM: nối UI vào API có sẵn + viết API ghi còn thiếu.
9. AuditLog: dùng API có sẵn, ghi log ở mọi hành động ghi dữ liệu.

### Giai đoạn 3 — Kế toán – Tài chính (4–8 tuần · 2 dev + 1 kế toán nghiệp vụ)
10. Cây tài khoản, nhật ký chung, phát sinh tự động từ kho/bán/mua (schema `accounting_*` đã có).
11. Hóa đơn VAT đầu vào/đầu ra, tờ khai; công nợ + thanh toán; TSCD + khấu hao.
12. Bộ báo cáo: P&L, cân đối, công nợ theo tuổi nợ, XNT — dùng SQL tổng hợp, không mock.

### Giai đoạn 4 — Củng cố nền tảng (song song, 2–3 tuần)
13. Bắt buộc `JWT_SECRET_KEY` ở production, bỏ nhánh plaintext, xóa mật khẩu demo hardcode.
14. Siết đa tenant: mọi query thêm `company_id`; kiểm tra cross-tenant bằng test.
15. Dọn repo: xóa file rộc (`--extensions`, `-d`, `npx`…), hợp nhất 3 file schema thành 1 có version, thêm `.env.example`, xóa công cụ dùng một lần.
16. CI: `tsc`, `build`, chạy `scripts/e2e-audit.mjs` mỗi PR (cần DB service trong CI).
17. Hiệu năng: pagination + filter cho `/inventory/balances`, `/products`; bỏ full-scan `fetchOrders()`.
18. Đồng bộ `ensure*Schema()` chạy cả trên Netlify function (cold start).

### Đề xuất quy trình phòng ngừa
- **Định nghĩa chuẩn** "định nghĩa hoàn thành" (DoD) cho 1 nghiệp vụ = UI + API ghi + DB + test E2E + audit log. Không tính "xong" khi chỉ có UI.
- Mỗi module có **1 file E2E** trong `scripts/` chạy được local lẫn CI — chính là cách phát hiện sớm các vấn đề khách hàng đang gặp.

---

## 7. CÁCH TỰ KIỂM TRA LẠI (cho đội dev)

```bash
# 1. Chạy server (đã cấu hình .env trỏ Postgres local)
npm run dev

# 2. Chạy bộ test E2E 52 kịch bản
node scripts/e2e-audit.mjs        # kết quả chi tiết: audit-results.json

# 3. Kiểm tra lỗi 500 còn sót
curl -s localhost:3000/api/saas/menus -H "Authorization: Bearer $TOKEN" | head -c 200
```

Tài khoản demo: ERP `admin/admin123` · WebShop `demo.customer@gmail.com / web12345`.

---

*Báo cáo này dựa trên kiểm chứng trực tiếp trên môi trường thật; mọi lỗi nêu trên đều tái hiện được và các mục đã sửa đều được test lại pass.*
