# 🧭 BÁO CÁO ĐÁNH GIÁ & PHÂN TÍCH DỰ ÁN ERPVIET
### Vai trò: Project Leader — Chuẩn bị cho triển khai (Deployment Readiness)

> Ngày đánh giá: 2026-08-20 · Branch: `arena/01a01f8f-erpviet` · Commit gốc: `67cec32`
> Phương pháp: khảo sát trực tiếp mã nguồn, chạy `npm run lint` + `npm run build`, đối chiếu tài liệu (README / PROJECT_INFO) với thực tế code.

---

## 1. TỔNG QUAN & NHẬN ĐỊNH BAN ĐẦU

ERPVIET là một **hệ thống full-stack nguyên khối (monolith)** kết hợp 2 sản phẩm trong một codebase:

| Thành phần | Mô tả | Endpoint/Route |
|---|---|---|
| **WebShop** | Cửa hàng B2C cho khách cuối | `/`, `/product/:slug`, `/cart`, `/checkout`, `/orders` |
| **ERP SaaS** | Quản trị doanh nghiệp (kho, mua, bán, kế toán, VAT, CRM, tài sản, audit) | `/saas/*` |

**Quy mô thực tế (đo đạc):**

| Chỉ số | Giá trị |
|---|---|
| File source | 84 file (62 `.tsx` + 21 `.ts` + khác) |
| LOC | ~28,124 dòng |
| Bảng DB trong `schema.sql` | **102 bảng** |
| Module nghiệp vụ | 10+ (Inventory, Procurement, Sales, Accounting/VAT, CRM, Fixed Assets, WebShop, User/RBAC, Translation, Notifications) |
| Trang SaaS | 24 trang |
| Locale | `vi.json` 1,402 key · `en.json` 481 key |

**Kết luận ban đầu:** Đây là một dự án **có chiều sâu nghiệp vụ rất lớn** (đặc biệt về kế toán TT200, FIFO, multi-tenant), kiến trúc đơn giản dễ vận hành, và **đã build được** — nhưng tồn tại **các lỗ hổng bảo mật nghiêm trọng và sự thiếu nhất quán về schema** khiến dự án **CHƯA đạt chuẩn để đưa vào production**. Chi tiết bên dưới.

---

## 2. KẾT QUẢ KIỂM THỬ KỸ THUẬT (đã thực thi)

| Hạng mục | Kết quả | Ghi chú |
|---|---|---|
| `npm install` | ✅ Pass | 561 packages, ~16s |
| `npm run lint` (`tsc --noEmit`) | ✅ Pass | Không có lỗi TypeScript |
| `npm run build` | ✅ Pass | Vite build 5.5s; server bundle 278 KB; code-splitting hoạt động tốt |
| Test (unit/integration/e2e) | ❌ **Không có** | Không có script `test`, không có file test, không có CI |

> **Điểm tốt:** TypeScript nghiêm ngặt và build sạch cho thấy codebase có kỷ luật. Nhưng **hoàn toàn không có automated test** là rủi ro lớn khi triển khai — mọi thay đổi đều phải kiểm thử tay.

---

## 3. ĐIỂM MẠNH (Cần giữ vững)

1. **Kiến trúc isomorphic đơn giản** — Express + Vite trong một process; dev dùng middleware Vite (HMR), prod phục vụ static + API từ một server duy nhất. Dễ deploy, ít thành phần chuyển động.
2. **Độ phủ nghiệp vụ ấn tượng** — 102 bảng phủ gần như đầy đủ một ERP Việt Nam: sơ đồ tài khoản TT200, hóa đơn/VAT, FIFO cost layers, kiểm kê, mua hàng 4 bước (PR→RFQ→Quotation→PO→GRN), công nợ, CRM, tài sản cố định.
3. **Multi-tenancy được thiết kế có chủ đích** — `company_id` trên mọi bảng nghiệp vụ, middleware tách tenant riêng cho SaaS (JWT) và WebShop (slug/query/header).
4. **i18n có hạ tầng** — i18next + react-i18next, tool scanner tự động (`scan-translations.ts`), quản lý translation động qua DB + UI.
5. **Tài liệu tốt** — `PROJECT_INFO.md` (559 dòng) là tài liệu onboarding khá chi tiết cho dev mới.
6. **Deployment-ready về hạ tầng** — `netlify.toml`, Netlify Function (`serverless-http`), kết nối Supabase pooler có sẵn; có xử lý cold-start (probe DB trước request đầu).
7. **Hiệu năng frontend** — code-splitting qua `manualChunks`, lazy-load route, chunk size hợp lý.

---

## 4. VẤN ĐỀ NGHIÊM TRỌNG (BLOCKER — phải xử lý TRƯỚC khi deploy)

### 🔴 4.1 Lỗ hổng bypass xác thực (CRITICAL)
`src/api/saasRouter.ts` (~dòng 145–155) trong luồng login:

```js
if (!isMatch) {
  const demoPasswords = ['password123','admin123','web12345','techviet123'];
  isMatch = demoPasswords.includes(cleanPass.toLowerCase());
}
```

**Hệ quả:** Bất kỳ tài khoản nào cũng đăng nhập được bằng **một trong 4 mật khẩu demo**, bất kể mật khẩu thật trong DB là gì. Đây là **cửa hậu (backdoor) toàn cục** — ai biết `admin123` là vào được hệ thống với quyền ADMIN.
→ **Hành động:** gỡ hoàn toàn block demo-password; chỉ chấp nhận `bcrypt.compare`. Nếu cần dữ liệu demo thì tạo user demo riêng với hash bcrypt thật.

### 🔴 4.2 JWT secret có giá trị mặc định (CRITICAL)
`src/middleware/tenant.ts` và `shopTenant.ts`:

```js
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'jwt-secret-webshop-2026';
```

**Hệ quả:** Nếu quên set `JWT_SECRET_KEY`, hệ thống dùng secret **công khai trong source**, kẻ tấn công có thể **tự ký JWT** và giả mạo bất kỳ user/company nào. README lại hướng dẫn set `JWT_SECRET_KEY=erpacc-super-secret-jwt-key-2026` — bản thân giá trị này cũng là secret "nổi tiếng".
→ **Hành động:** bỏ giá trị mặc định — nếu thiếu env thì **từ chối khởi động** (fail-fast) thay vì dùng fallback.

### 🔴 4.3 Rò rỉ dữ liệu cross-tenant (HIGH)
`tenantMiddleware`: khi token không có `companyId` và không phải super-admin → **tự gán `companyId = 1`** (tenant đầu tiên). `shopTenantMiddleware`: khi không xác định được slug/JWT → **fallback về `companies.id = 1`**.
→ Một token hợp lệ nhưng thiếu thông tin có thể **đọc/ghi dữ liệu của tenant khác**. Kèm theo bất nhất role: middleware kiểm tra `decoded.role === 'SUPER_ADMIN'` nhưng JWT thực tế được ký với `role: 'ADMIN'` → **nhánh super-admin bypass là dead code**, và khái niệm "super admin toàn hệ thống" chưa từng hoạt động đúng.
→ **Hành động:** nếu không xác định được tenant → trả 401/403 (không fallback). Thống nhất role naming (`ADMIN` vs `SUPER_ADMIN`).

### 🔴 4.4 RBAC chỉ tồn tại ở frontend (HIGH)
- Khi login, mọi user không phải ADMIN nhận **một danh sách permission hardcode** (`['quotation:view','quotation:create','order:view','customer:view','product:view']`) thay vì đọc từ bảng `sys_role_permissions`.
- Việc chặn quyền (`SaaSProtectedRoute`, `hasRole/hasPermission`) **chạy ở React** — backend API **không kiểm tra permission** ở từng endpoint.
→ Người dùng có thể gọi trực tiếp API vượt quyền. Bảng RBAC trong DB hiện **không được sử dụng thực sự**.
→ **Hành động:** thêm authorization middleware ở backend (đọc role/permission từ DB theo `companyId` + `userId`), đồng bộ với frontend.

### 🔴 4.5 Ba file schema mâu thuẫn nhau (HIGH)
Repo có **3** file định nghĩa DB:
1. `schema.sql` (2,807 dòng, 102 bảng) — **file chính** mà `autoMigrateDatabase()` áp dụng.
2. `schema - fix.sql` (851 dòng) — tự nhận là "ULTIMATE OPTIMIZED SCHEMA" dùng partitioning, cấu trúc khác (bảng `companies` thiếu nhiều cột so với schema.sql).
3. `schema_fixes.sql` (69 dòng) — helper upsert + trigger.

**Hệ quả:** chỉ `schema.sql` được áp dụng tự động; hai file còn lại nằm "chết". Không ai biết đâu là **nguồn sự thật** cho production → nguy cơ tạo DB sai cấu trúc.
→ **Hành động:** chọn một file chuẩn, xóa/gộp phần còn lại, và đưa vào hệ thống migration có phiên bản (xem 4.6).

### 🔴 4.6 Không có hệ thống migration có phiên bản (HIGH)
Schema được áp dụng bằng "auto-migrate" — đọc `schema.sql` + `insertdata.sql` và `pool.query` nguyên file, **bỏ qua nếu thấy có dữ liệu**. Không có bảng `migrations`/versioning. Các sửa đổi schema về sau được vá bằng `ensureProductImageSchema()` chạy thủ công lúc boot.
→ **Hành động:** dùng công cụ migration (như `node-pg-migrate`, `knex`, hoặc tự viết bảng `schema_migrations`) để schema có thể tiến hóa an toàn trên production.

---

## 5. VẤN ĐỀ TRUNG BÌNH (MEDIUM — nên xử lý trước/sớm sau go-live)

| # | Vấn đề | Chi tiết |
|---|---|---|
| 5.1 | **i18n tiếng Anh chưa hoàn thiện** | `en.json` chỉ có 481/1,402 key (~34%). Báo cáo `missing-translations-report.md` ghi nhận **1,031 chuỗi hardcode** chưa extract. Nếu có khách quốc tế sẽ thấy text tiếng Việt lẫn lộn. |
| 5.2 | **Dependency thừa/khó hiểu** | `next-i18next`, `next-intl` (thư viện của Next.js — dự án là Vite), `@google/genai` (không dùng ở đâu). `metadata.json` khai báo capability "SERVER_SIDE_GEMINI_API" nhưng **không có code nào gọi Gemini**. → gây bloat và hiểu nhầm. |
| 5.3 | **File rác bị commit** | `--extensions`, `-d`, `npx` (0 byte), `i18n-replacements.json` (rỗng) — dấu hiệu lệnh CLI lỗi bị `git add` nhầm. Nên dọn. |
| 5.4 | **Doc/code lệch nhau (drift)** | PROJECT_INFO ghi "React 18 + React Router v6" nhưng thực tế **React 19 + react-router-dom 7.11**; ghi saasRouter ~1072 dòng (thực 1269); vi.json ~1300 key (thực 1402). |
| 5.5 | **CORS mở toàn bộ** | `app.use(cors())` cho phép mọi origin — chấp nhận được cho shop công khai nhưng nên giới hạn cho API SaaS. |
| 5.6 | **Không rate-limit** | Endpoint login không giới hạn số lần thử → dễ brute-force. |
| 5.7 | **Logging quá mức** | `query()` log **mọi** câu SQL kèm thời gian qua `console.log` → ồn, tốn I/O, rò rỉ thông tin khi vận hành production. Nên chuyển sang level-based logger. |
| 5.8 | **`express.json({limit:'50mb'})`** | Giới hạn payload lớn → bề mặt DoS. Nên giảm (vd 1–5 MB) cho API thường. |
| 5.9 | **Dữ liệu procurement PR nằm trong localStorage** | `erp_procurement_prs_v1` — PR chưa có endpoint DB, dữ liệu sẽ mất khi đổi máy/trình duyệt. Được ghi nhận trong doc nhưng là gap chức năng thật. |
| 5.10 | **Không có `.env.example`** | `.gitignore` cho phép `!.env.example` nhưng file này không tồn tại → dev mới khó biết cần những biến gì. |
| 5.11 | **`rejectUnauthorized: false`** | SSL không verify — chấp nhận được với Supabase pooler, nhưng cần ghi chú rõ và không tái dùng cho DB khác. |

---

## 6. NHẬN XÉT VỀ TỪNG GÓC ĐỘ LEADER QUAN TÂM

**Chất lượng code:** Tốt về tổ chức thư mục (api/contexts/services/pages/layouts), type-safety tốt (tsc sạch). Nhưng router backend quá lớn (`saasRouter.ts` 1,269 dòng) → khó bảo trì, nên tách theo module. Thiếu kiểm thử.

**Bảo mật:** Là điểm yếu lớn nhất hiện tại (mục 4.1–4.4). Với một ERP chứa dữ liệu kế toán/kho, **không thể go-live trước khi đóng các lỗ hổng này**.

**Dữ liệu & DB:** Nghiệp vụ rất đầy đủ nhưng **quản trị schema lỏng lẻo** (3 file, không versioning). Đây là rủi ro vận hành dài hạn.

**Khả năng vận hành (ops):** Deploy Netlify + Supabase được chuẩn bị tốt về cấu hình. Thiếu observability (chưa có error tracking, structured logging), thiếu backup strategy, thiếu CI/CD pipeline trong repo.

**Tính hoàn thiện sản phẩm:** WebShop gần hoàn chỉnh; ERP có nhiều trang còn "đang phát triển" (orders, deliveries) và một số module lưu tạm localStorage.

---

## 7. LỘ TRÌNH TRIỂN KHAI ĐỀ XUẤT (Roadmap)

### Giai đoạn 0 — HARDENING BẢO MẬT (bắt buộc, chặn deploy)
- [ ] Gỡ block demo-password trong login (4.1).
- [ ] Bỏ JWT secret mặc định; fail-fast nếu thiếu env (4.2); sinh secret mạnh ngẫu nhiên cho production.
- [ ] Sửa tenant isolation: không fallback `company_id=1`; thống nhất `ADMIN`/`SUPER_ADMIN` (4.3).
- [ ] Thêm authorization backend theo permission từ `sys_role_permissions` (4.4).
- [ ] Giới hạn CORS, thêm rate-limit cho `/api/saas/auth/login`.

### Giai đoạn 1 — DỮ LIỆU & MIGRATION
- [ ] Chọn 1 schema chuẩn; gộp `schema - fix.sql` / `schema_fixes.sql` vào nguồn sự thật duy nhất (4.5).
- [ ] Đưa vào migration tool có versioning (4.6).
- [ ] Tạo `.env.example` đầy đủ biến (5.10).
- [ ] Xác định chiến lược backup (Supabase PITR / pg_dump định kỳ).

### Giai đoạn 2 — HOÀN THIỆN CHẤT LƯỢNG
- [ ] Hoàn thiện `en.json` (chạy scanner + dịch 481→1402 key) (5.1).
- [ ] Dọn dependency thừa (`next-i18next`, `next-intl`, `@google/genai` nếu không dùng) (5.2).
- [ ] Dọn file rác ở root (5.3); cập nhật PROJECT_INFO cho khớp phiên bản (5.4).
- [ ] Viết tối thiểu: smoke test đăng nhập các role, test luồng đặt hàng, test kiểm kê (FIFO).

### Giai đoạn 3 — VẬN HÀNH (OPS)
- [ ] Chuyển logging sang structured/level-based (5.7); giảm payload limit (5.8).
- [ ] Cấu hình error tracking (Sentry/Netlify logs).
- [ ] Thiết lập CI/CD (Netlify preview + deploy gate chạy `tsc`/build/test).

### Giai đoạn 4 — GO-LIVE & GIÁM SÁT
- [ ] Môi trường staging: seed dữ liệu mẫu, kiểm thử UAT toàn bộ role (admin/sales/accountant/warehouse/purchasing).
- [ ] Kiểm tra `GET /api/health` + luồng WebShop↔ERP (cập nhật trạng thái đơn web khi xuất kho).
- [ ] Backup trước khi cutover; theo dõi log lỗi + hiệu năng query trong tuần đầu.

---

## 8. KẾT LUẬN CỦA LEADER

| Khía cạnh | Đánh giá |
|---|---|
| **Mức độ hoàn thiện chức năng** | ⭐⭐⭐⭐ (4/5) — phủ rộng nghiệp vụ |
| **Chất lượng code** | ⭐⭐⭐⭐ (4/5) — type-safe, tổ chức tốt, router hơi lớn |
| **Bảo mật** | ⭐ (1/5) — **có backdoor + fallback tenant + RBAC không hiệu lực ở backend** |
| **Khả năng vận hành** | ⭐⭐⭐ (3/5) — deploy sẵn sàng nhưng thiếu migration, test, observability |
| **Mức độ sẵn sàng production** | ⭐⭐ (2/5) — **build được nhưng CHƯA an toàn để go-live** |

**Kết luận:** ERPVIET là một nền tảng có **tiềm năng nghiệp vụ cao và kiến trúc tốt**, nhưng đang ở trạng thái **"hoàn thiện về tính năng, chưa hoàn thiện về bảo mật và vận hành"**. Trước khi triển khai thực tế, **bắt buộc** phải xử lý xong Giai đoạn 0 (bảo mật) — ước tính 1–2 sprint tùy đội ngũ — sau đó mới an toàn để đưa lên production phục vụ khách hàng thật.

> Ghi chú: báo cáo này dựa trên khảo sát code tại commit hiện tại và các lệnh build/lint đã chạy thực tế. Mọi phát hiện về lỗ hổng đều kèm vị trí file cụ thể để đội ngũ dễ xử lý.
