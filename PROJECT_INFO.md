# ERPVIET - Project System Documentation

> **Đây là file thông tin toàn bộ hệ thống.** Dev mới (hoặc dev năm hệ thống sau này) hãy đọc file này trước khi mở rộng.

---

## 1. Tổng quan dự án

**ERPVIET** là một hệ thống ERP + WebShop đa tenant (multi-tenant SaaS) dành cho doanh nghiệp vừa và nhỏ tại Việt Nam, kết hợp:

1. **WebShop** — Cửa hàng thương mại điện tử công cộng (storefront) cho khách hàng cuối.
2. **SaaS ERP** — Hệ thống quản trị doanh nghiệp (ERP) cho doanh nghiệp: kho, mua hàng, bán hàng, kế toán, CRM, tài sản cố định, audit log, v.v.

### Công nghệ chính

| Layer | Công nghệ |
|-------|-----------|
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS + React Router v7 + i18next (react-i18next) |
| Backend | Node.js + Express (isomorphic — chạy trong cùng một process với Vite dev server) |
| Database | PostgreSQL (Supabase hoặc self-hosted) |
| Auth | JWT (Bearer token, 7 ngày) + bcrypt (10 rounds) |
| Dev Tool | TypeScript (`tsc --noEmit`), Vite build, ESLint (via Vite plugin) |

### Cấu trúc thư mục

```
ERPVIET/
├── server.ts                    # Entry point: Express + Vite middleware (dev) hoặc static (prod)
├── vite.config.ts              # Vite config với code splitting
├── tsconfig.json               # TS config (ES2022, bundler, path alias @/)
├── schema.sql                  # DB schema (DDL + indexes + multi-tenancy ALTER)
├── insertdata.sql              # Seed data (benchmark dataset)
├── .env                        # Environment variables
├── package.json                # Dependencies + scripts
├── src/
│   ├── api/                    # Express routers
│   │   ├── saasRouter.ts       # SaaS ERP backend API (~1072 lines)
│   │   └── shopRouter.ts       # WebShop frontend API (~618 lines)
│   ├── middleware/
│   │   ├── tenant.ts           # SaaS tenant middleware (JWT → company_id)
│   │   └── shopTenant.ts       # WebShop tenant middleware (slug/jwt → company_id)
│   ├── db/
│   │   └── index.ts            # PostgreSQL pool + query helper + auto-migrate
│   ├── services/               # Business logic (DB queries)
│   │   ├── shopProductService.ts
│   │   ├── shopOrderService.ts
│   │   ├── shopCustomerService.ts
│   │   ├── shopDataStore.ts    # WebShop types/interfaces
│   │   ├── procurementStore.ts # Procurement types + localStorage helpers
│   │   ├── inventoryService.ts # Inventory movement posting (transactional)
│   │   └── api.ts              # Axios instance for ERP SaaS frontend
│   ├── contexts/               # React contexts
│   │   ├── SaaSAuthContext.tsx # ERP auth (JWT token in localStorage)
│   │   ├── AuthContext.tsx     # WebShop auth
│   │   ├── CartContext.tsx     # WebShop cart
│   │   ├── LanguageContext.tsx # i18n language + translation management
│   │   ├── ThemeContext.tsx    # Dark/light mode
│   │   ├── ToastContext.tsx    # Toast notifications
│   │   └── ShopTenantContext.tsx
│   ├── layouts/
│   │   ├── SaaSLayout.tsx     # SaaS ERP layout (sidebar + topbar)
│   │   └── ShopLayout.tsx     # WebShop layout
│   ├── pages/                  # All route pages
│   │   ├── saas/              # SaaS ERP pages (17 pages)
│   │   └── *.tsx              # WebShop pages (catalog, product, cart, checkout, orders, etc.)
│   ├── components/              # Shared React components
│   ├── hooks/
│   ├── utils/
│   │   └── storage.ts         # localStorage keys (separate for WebShop vs ERP SaaS)
│   ├── i18n.ts                # i18next initialization (lazy load locale JSON)
│   ├── types.ts               # Shared TypeScript interfaces
│   └── App.tsx                # Main router (all routes defined here)
├── public/
│   └── locales/
│       ├── vi.json            # Vietnamese translations (~1,300 keys)
│       └── en.json            # English translations (placeholder text)
└── scripts/
    └── scan-translations.ts   # Translation key scanner CLI tool
```

---

## 2. Kiến trúc hệ thống

### 2.1 Kiến trúc isomorphic (monorepo đơn giản)

```
Browser (localhost:3000) → Vite Dev Server → Express Middleware
                                          → Proxy API calls to /api/shop/*, /api/saas/*
                                          → Serve React via Vite HMR

Production: Vite build → dist/ → Express serves static files + API
```

- **Dev mode**: Vite chạy làm middleware cho Express. Hot Reload hoạt động cho cả frontend và backend.
- **Prod mode**: `npm run build` → Vite bundle ra `dist/`, Express phục vụ static files và API cùng lúc (single server).
- **API endpoints**: `/api/shop/*` (WebShop) và `/api/saas/*` (ERP SaaS) chạy trực tiếp trên Express.

### 2.2 Multi-tenancy

- **Company model**: Mọi business table đều có `company_id` (tham chiếu đến `companies.id`).
- **Tenant resolution**:
  - **SaaS**: JWT token chứa `companyId` (decode trong `tenantMiddleware`). Super admin (role `ADMIN` ở cấp độ toàn hệ thống) bypass.
  - **WebShop**: Tenant slug từ URL path (`/shop/{slug}/...`), query param (`?tenant=`), header (`x-tenant-slug`), custom domain hoặc JWT. Storefront root chỉ dùng tenant được đánh dấu `is_default_shop = TRUE`; không fallback bằng ID hard-code.
- **Database isolation**: Mỗi query đều filter theo `company_id` hoặc `WHERE ($1::int IS NULL OR company_id = $1)`.
- **Auto-migrate**: Chỉ chạy `schema.sql` + `insertdata.sql` khi `AUTO_MIGRATE_DATABASE=true` và DB chưa có data.

### 2.3 Authentication & Authorization

- **JWT token**: Ký bởi `JWT_SECRET_KEY` (env), thời hạn 7 ngày.
- **Password hashing**: bcrypt với 10 rounds; API chỉ chấp nhận hash bcrypt và không trả hash/mật khẩu về trình duyệt.
- **Tài khoản nền tảng**: chỉ user được đánh dấu `is_super_admin = TRUE` mới có thể quản trị toàn bộ tenant; không có mật khẩu demo/backdoor.
- **Roles** (sys_roles):
  - `ADMIN` — Full permissions (wildcard `*` trong permissions array)
  - `SALES` — Bán hàng, CRM, trích dẫn
  - `ACCOUNTANT` — Kế toán, nợ công / nợ ngoại, VAT, tài sản
  - `WAREHOUSE` — Kho, nhập/xuất, kiểm kê
  - `PURCHASING` — Mua hàng, nhận hàng
- **Permission check**: `SaaSProtectedRoute` component kiểm tra `allowedRoles` prop, `hasRole()` và `hasPermission()` trong context.

### 2.4 i18n (Internationalization)

- **Thư viện**: `i18next` + `react-i18next`.
- **Ngôn ngữ**: `vi` (Vietnamese, default) và `en` (English).
- **Locale files**: `/public/locales/vi.json` và `/public/locales/en.json`.
- **Lazy loading**: `i18n.ts` khởi tạo với resources rỗng, sau đó fetch JSON files bất đồng bộ, rồi `addResourceBundle`. Tránh top-level await để Vite build không lỗi.
- **Dynamic translations**: `LanguageContext.tsx` cho phép thêm/sửa/xóa key dịch thời gian thực (qua API `/api/saas/translations`) và lưu vào `localStorage` cache (`saas_translation_dictionary`).
- **Quy tắc key**: Snake_case từ tiếng Việt, ví dụ: `"đăng nhập"` → `dang_nhap`, `"thành công"` → `thanh_cong`.
- **Tool scan**: `scripts/scan-translations.ts` — tự động quét TSX files, tạo key, ghi vào locale files.

---

## 3. Các nghiệp vụ (Business Modules)

### 3.1 MASTER DATA MANAGEMENT

**Bảng liên quan**: `companies`, `branches`, `departments`, `sys_users`, `sys_roles`, `categories`, `brands`, `uom`, `products`, `price_lists`, `warehouses`, `customers`, `customer_groups`, `suppliers`, `supplier_prices`

#### Company & Tenant
- **Đăng ký tenant mới**: `POST /api/saas/tenants/register` — kiểm tra email/MST duy nhất rồi tạo company + workspace ERP + WebShop riêng + head office branch + BGD department + admin tenant (transactional). Tài khoản này luôn `is_super_admin = FALSE`.
- **Google Auth tenant creation**: `POST /api/saas/auth/google/callback` — nếu user chưa có công ty, tạo mới dựa trên `company_info`.
- **Quản lý tenant**: `GET/PATCH/POST /api/saas/tenants/*` — xem, sửa, tạm dừng, nâng cấp gói (free/starter/professional/enterprise).
- **Gói dịch vụ**: `plan_type` trong `companies`, `subscription_status` (trial/active/canceled), `trial_ends_at` (14 ngày dùng thử).

#### Sản phẩm (Products)
- **Master**: `products` table với `name_vi`, `name_en`, `sku`, `barcode`, `code` (slug), `category_id`, `brand_id`, `uom_id`, `cost_price`, `selling_price`, `web_price`, `stock_quantity`, `min_stock`, `max_stock`, `is_active`, `is_web_visible`.
- **Images**: `product_images` (multiple, `is_primary`, `sort_order`).
- **Variants**: `product_variants` (kích thước, màu sắc).
- **Attributes**: `product_attributes` (thuộc tính tùy chỉnh).
- **Giá bán**: `web_price` = giá bán web (cho khách online), `selling_price` = giá ERP (cho khách doanh nghiệp), `cost_price` = giá vốn.
- **API**: `GET /api/saas/products` (multilingual, company-scoped), `GET /api/shop/catalog` (WebShop catalog).

#### Danh mục & Đơn vị
- **Categories**: `categories` — có `parent_id` (hierarchical), `name_vi`, `name_en`, `sort_order`. WebShop tự động group theo category.
- **UOM (Đơn vị đo)**: `uom` — `code`, `name_vi`, `name_en`, `is_fractional`.

#### Khách hàng (Customers)
- **ERP customers**: `customers` — `group_id` (membership), `tax_code`, `phone`, `email`, `address`, `credit_limit`, `payment_terms_days`.
- **WebShop customers**: `web_customers` — riêng biệt, có `password_hash` (bcrypt), `is_active`. JWT signed với role `web_customer`.
- **Customer groups**: `customer_groups` — phân nhóm khách hàng (VIP, thường, doanh nghiệp).

#### Nhà cung cấp (Suppliers)
- `suppliers` — `code`, `name`, `tax_code`, `phone`, `email`, `address`, `bank_account`, `bank_name`, `payment_terms`.
- **Supplier prices**: `supplier_prices` — bảng giá theo nhà cung cấp cho từng sản phẩm.

#### Kho (Warehouses)
- `warehouses` — `name_vi`, `name_en`, `location`, `is_active`.
- **Vị trí kho**: `warehouse_locations` (kệ, ngăn).
- **Tồn kho**: `stock_balances` (per warehouse, per product, per batch).
- **Batch/Serial**: `batches` (exp_date, manufacture_date), `serial_numbers` (status: SOLD/DEFECTIVE/TRANSIT).

### 3.2 INVENTORY MANAGEMENT (QUẢN LÝ KHO)

#### Nguyên tắc tính toán tồn kho
- **FIFO cost layers**: `fifo_cost_layers` — lưu chi phí theo lô hàng theo thứ tự vào trước ra trước. Index: `idx_fifo_product_received`.
- **Tồn kho thực tế**: `stock_balances` — số lượng tồn tại tại mỗi kho.
- **Chuyển động kho**: `stock_movements` (`movement_type`: NHAP_KHO/XUAT_KHO/KIEM_KE_DIEU_CHINH) → `stock_movement_items`.

#### Các loại chứng từ kho
| Loại | Code prefix | Ghi chú |
|------|-------------|---------|
| Nhập kho | `NK-{timestamp}` | Tăng tồn, tăng giá vốn |
| Xuất kho | `XK-{timestamp}` | Giảm tồn, giảm giá vốon |
| Kiểm kê | `DC-{timestamp}` | Điều chỉnh tồn (có thể tăng/giảm) |

#### API & Service
- **Post movement**: `POST /api/saas/inventory/movements` → `postInventoryMovement()` trong `inventoryService.ts` — dùng transaction (BEGIN/COMMIT/ROLLBACK), cập nhật `stock_balances`, `stock_movement_items`, và `products.stock_quantity`.
- **XNT (Xuất nhập tồn)**: `GET /api/saas/inventory/xnt` — báo cáo cộng đọng tính đến ngày.
- **Balances**: `GET /api/saas/inventory/balances` — tồn kho hiện tại.
- **Movements**: `GET /api/saas/inventory/movements` — lịch sử giao dịch.

#### Trang UI
- **Kho**: `SaaSWarehousesPage` — quản lý kho, vị trí.
- **Nhập kho**: `SaaSStockInPage` — tạo phiếu nhập kho (NK).
- **Xuất kho**: `SaaSStockOutPage` — tạo phiếu xuất kho (XK).
- **Kiểm kê**: `SaaSStocktakingPage` — kiểm kê tồn (DC).
- **Tồn kho**: `SaaSInventoryPage` — báo cáo tồn kho, XNT.

### 3.3 PROCUREMENT (MUA HÀNG)

#### Quy trình mua hàng (4 bước)
```
1. Purchase Request (PR)     → 2. Request for Quotation (RFQ)
                              → 3. Supplier Quotations
                              → 4. Purchase Order (PO)
                              → 5. Goods Receipt Note (GRN/NK)
```

#### Quy trình chi tiết

**Bước 1: Purchase Request (PR)**
- `purchase_requests` — yêu cầu mua hàng từ phòng ban.
- Fields: `code`, `department_id`, `request_date`, `required_date`, `priority` (THUONG/CAO/KHAN_CAP), `reason`, `status` (CHO_DUYET/DA_DUYET/DA_TAO_RFQ/DA_TAO_PO/TU_CHOI).
- Tạo từ UI `SaaSPurchasingPage` (tab PR). Lưu trữ tạm thời trong localStorage (`erp_procurement_prs_v1`) cho đến khi có DB endpoint.

**Bước 2: RFQ (Request for Quotation)**
- `purchase_rfqs` — gửi RFQ đến nhiều nhà cung cấp.
- Fields: `code`, `pr_id`, `created_date`, `deadline_date`, `status` (CHO_BAO_GIA/DA_NHAN_BAO_GIA/DA_CHON_NCC/HUY).

**Bước 3: Supplier Quotations**
- `supplier_quotations` — báo giá từ nhà cung cấp.
- `supplier_quotation_items` — chi tiết từng sản phẩm.

**Bước 4: Purchase Order (PO)**
- `purchase_orders` — đơn đặt hàng sau khi chọn NCC.
- Fields: `code`, `pr_code`, `rfq_code`, `supplier_id`, `order_date`, `expected_delivery`, `payment_terms`, `status` (DRAFT/CHO_DUYET/DA_DUYET/DANG_GIAO/DA_NHAP_KHO/HUY).
- `purchase_order_items` — chi tiết PO.

**Bướch 5: Nhận hàng (GRN)**
- Tạo phiếu nhập kho (NK) tương ứng với PO.
- `purchase_receipts` + `purchase_receipt_items`.

#### API
- `GET /api/saas/purchasing/orders` — danh sách PO.
- `GET /api/saas/purchasing/requests` — danh sách PR.

#### Trang UI
- `SaaSPurchasingPage` — giao diện quản lý PR/RFQ/PO/Stock In trong một tab.

### 3.4 SALES (BÁN HÀNG)

#### Quy trình bán hàng
```
1. Quotation (Báo giá) → 2. Sales Order (Đơn bán) → 3. Delivery (Giao hàng) → 4. Invoice (Hóa đơn) → 5. Payment (Thu tiền)
```

#### Sales Orders
- `sales_orders` — `code`, `customer_id`, `sales_rep_id`, `order_date`, `status` (DRAFT/CHO_DUYET/DA_XAC_NHAN/HOAN_THANH/HUY), `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `payment_status`.
- `sales_order_items` — chiết khấu, thuế từng dòng.

#### Deliveries
- `sales_deliveries` — phiếu giao hàng.
- `sales_delivery_items`.

#### Returns
- `sales_returns` + `sales_return_items`.

#### Commissions
- `sales_commissions` — hoa hơn theo doanh số, có `is_paid` flag.

#### API
- `GET /api/saas/orders` — đơn bán hàng.
- `GET /api/saas/quotations` — báo giá.

#### Trang UI
- `SaaSQuotationsPage` — quản lý báo giá.
- Các trang khác (orders, deliveries) đang trong quá trình phát triển.

### 3.5 ACCOUNTING (KẾ TOÁN)

#### Hệ thống tài khoản
- `chart_of_accounts` — danh mục tài khoản theo chuẩn kế toán Việt Nam (111/131/133/138/211/221/222/...5111/5112/...33311/33312/...).
- `fiscal_years` — năm tài chính.
- `accounting_periods` — kỳ sổ sách (đóng/mở kỳ).

#### Sổ nhật ký (Journal Entries)
- `journal_entries` — chứng từ ghi sổ (reference_type: INVOICE/RECEIPT/ORDER).
- `journal_entry_lines` — dòng bằng/bỉ/bằng (account_code, partner_id, debit_amount, credit_amount).
- Đảm bảo cân đối: tổng debit = tổng credit.

#### Hóa đơn (Invoices)
- `invoices` — `code`, `order_id`, `customer_id`, `invoice_date`, `due_date`, `status` (DA_PHAT_HANH/QUA_HAN/HUY), tiền tệ.
- `invoice_items`.

#### Thu / Chi (Receipts & Payments)
- `receipts_payments` — chứng từ thu (PT) / chi (PC).
- `partner_type`: KHACH_HANG/NHA_CUNG_CAP.
- `payment_method`: TIEN_MAT/CHUYEN_KHOAN.
- `voucher_type`: THU/CHI.

#### VAT
- `vat_declarations` — khai báo thuế GTGT.
- `idx_vat_declarations_period`.

#### Ngân hàng
- `bank_accounts` — tài khoản ngân hàng (gl_account_code).

#### API & Trang UI
- `SaaSDebtPage` — công nợ khách hàng/nhà cung cấp.
- `SaaSVATPage` — khai báo VAT.
- `SaaSAccountingPage` — sổ nhật ký, tổng hợp.
- `SaaSReportsPage` — báo cáo tài chính.

### 3.6 CRM (QUẢN LÝ KHÁCH HÀNG TIỀM NĂNG)

#### Leads
- `crm_leads` — `code`, `company_name`, `contact_name`, `phone`, `email`, `source` (WEBSITE/CALL/REFERRAL/OTHER), `estimated_revenue`, `status` (LIEN_HE/TIEM_NANG/CHUYEN_DOI/THANH_CONG/THAT_BAI).

#### Opportunities
- `crm_opportunities` — cơ hội bán hàng.
- `crm_contacts` — liên hệ.
- `crm_activities` — hoạt động (CALL/EMAIL/MEETING).

#### API
- `GET /api/saas/crm/leads`
- `GET /api/saas/crm/opportunities`

#### Trang UI
- `SaaSCRMPage` — quản lý leads, opportunities, activities.

### 3.7 FIXED ASSETS (TÀI SẢN CỐ ĐỊNH)

- `fixed_assets` — `code`, `name_vi`, `name_en`, `category_id`, `department_id`, `purchase_date`, `purchase_cost`, `useful_life_years`, `depreciation_method` (LINEAR/HALF_YEAR), `status`.
- `asset_depreciations` — theo dõi khấu hao lũy thỉnh.

#### API
- `GET /api/saas/assets` — danh sách tài sản + tổng khấu hao.

#### Trang UI
- `SaaSAssetsPage`.

### 3.8 WEBSHOP E-COMMERCE (CỬA HÀNG ĐIỆN TỬ)

#### Flow chính
```
Trang chủ → Danh sách sản phẩm → Chi tiết SP → Thêm vào giỏ → Thanh toán → Đặt hàng → Theo dõi
```

#### Components/Pages
| Page | Mô tả | Auth? |
|------|-------|-------|
| `CatalogPage` | Trang chủ webshop (danh sách SP, banner, filter) | Không |
| `ProductPage` | Chi tiết sản phẩm (gallery, specs, reviews) | Không |
| `CartPage` | Giỏ hàng (cập nhật số lượng, xóa item) | Không (guest cart) |
| `CheckoutPage` | Thanh toán (thông tin giao hàng, phương thức thanh toán) | Không |
| `OrderSuccessPage` | Xác nhận đặt hàng thành công | Không |
| `OrdersPage` | Lịch sử đơn hàng của khách hàng | Có |
| `OrderDetailPage` | Chi tiết đơn hàng + trạng thái ERP | Có |
| `LoginPage` | Đăng nhập webshop | Không |
| `RegisterPage` | Đăng ký webshop | Không |
| `GoogleCallbackPage` | Xử lý OAuth Google | Không |
| `AccountPage` | Quản lý tài khoản cá nhân | Có |

#### WebShop API (shopRouter.ts)
- `/api/shop/categories` — danh sách categories.
- `/api/shop/admin/products` — CRUD sản phẩm (ERP → WebShop sync).
- `/api/shop/catalog` — catalog cho WebShop (filter theo category/search/price).
- `/api/shop/products/*` — chi tiết sản phẩm.
- `/api/shop/banners` — banner trang chủ.
- `/api/shop/promotions` — mã giảm giá.
- `/api/shop/cart/*` — CRUD giỏ hàng (guest cart qua `session_key`).
- `/api/shop/cart/apply-promo` — áp dụng mã giảm giá.
- `/api/shop/auth/*` — login/register/google OAuth.
- `/api/shop/orders/*` — CRUD đơn hàng, tracking.
- `/api/shop/orders/:code/erp-status` — cập nhật trạng thái ERP (được gọi từ SaaS warehouse flow).
- `/api/shop/admin/customers` — quản lý khách hàng web.
- `/api/shop/admin/orders` — quản lý đơn hàng web.
- `/api/shop/tenant/info` — thông tin tenant (slug, name, settings).

#### Data flow: WebShop ↔ ERP
- Khi ERP tạo phiếu xuất kho (XK) cho đơn web, gọi `POST /api/shop/orders/:code/erp-status` để cập nhật trạng thái đơn hàng web (`CHO_XAC_NHAN` → `DA_XAC_NHAN`).

### 3.9 QUẢN LÝ NGƯỜI DÙNG & BẢO MẬT

#### User Management (SaaS)
- `sys_users` — `username`, `email`, `password_hash`, `full_name`, `phone`, `role_id`, `department_id`, `branch_id`, `company_id`, `status`, `preferred_lang`.
- `sys_login_history` — log đăng nhập (IP, thời gian, trạng thái).
- `sys_user_sessions` — session hiện tại (refresh token).
- RBAC: `sys_roles` → `sys_role_permissions` → `sys_permissions`.

#### Audit Logs
- `sys_audit_logs` — log hành động của user (entity_name, entity_id, action, old_values, new_values).
- `sys_audit_details` — chi tiết từng trường thay đổi.

#### Notifications
- `notifications` — thông báo hệ thống (title_vi, title_en, content_vi, content_en, is_read, link_url).
- Có 2 loại thông báo động:
  1. Đơn hàng webshop mới (kể từ `web_orders` với status `CHO_XAC_NHAN`).
  2. Cảnh báo tồn kho thấp (sản phẩm có `stock_quantity <= min_stock`).

#### API
- `GET /api/saas/notifications`
- `GET /api/saas/users`
- `POST/PUT/DELETE /api/saas/users/:id`
- `GET /api/saas/audit-logs`

#### Trang UI
- `SaaSSettingsPage` — quản lý user, role, phân quyền, cài đặt hệ thống.

### 3.10 TRANSLATION MANAGEMENT

- `sys_translations` — `lang_code` (vi/en), `translation_key`, `translation_value`, `category`.
- Có 2 cách quản lý:
  1. **File JSON** (source of truth): `/public/locales/vi.json`, `/public/locales/en.json`.
  2. **Database** (custom overrides): `sys_translations` table — dùng cho dynamic translations từ UI.
- API:
  - `GET /api/saas/translations/all` — lấy tất cả translations từ DB.
  - `POST /api/saas/translations` — thêm/sửa translation.
  - `DELETE /api/saas/translations/:key` — xóa.
  - `GET /api/saas/translations/json` — lấy toàn bộ file JSON.
  - `PUT /api/saas/translations/json` — cập nhật file JSON trực tiếp.
- `LanguageContext.tsx` tự động merge giữa i18n resources và DB translations.

---

## 4. Chạy dự án

### 4.1 Cài đặt

```bash
npm install
```

### 4.2 Chạy dev server

```bash
npm run dev
# Server chạy tại http://localhost:3000
# Vite HMR cho frontend, Express middleware cho backend
```

### 4.3 Build production

```bash
npm run build
# Vite bundle ra dist/, TypeScript check
```

### 4.4 Kiểm tra code

```bash
npx tsc --noEmit     # TypeScript type check
npx vite build       # Build + bundle
```

### 4.5 Environment variables (.env)

```
PORT=3000
NODE_ENV=development
AUTO_MIGRATE_DATABASE=false    # Đặt true để chạy schema.sql + insertdata.sql
JWT_SECRET_KEY=your-secret-key  # Khóa JWT (dùng chung WebShop + SaaS)
DATABASE_URL=postgresql://...  # PostgreSQL connection string
SUPABASE_DATABASE_URL=postgresql://...  # Ưu tiên Supabase
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=erpacc_db
```

### 4.6 Database setup

1. Tạo database PostgreSQL.
2. Copy `schema.sql` và `insertdata.sql` vào thư mục gốc.
3. Set `AUTO_MIGRATE_DATABASE=true` trong `.env`.
4. Chạy `npm run dev` — server sẽ tự động apply schema + seed data.

---

## 5. Translation scanner tool

### Công dụ: `scripts/scan-translations.ts`

**Mục đích**: Tự động tìm chuỗi hardcode tiếng Việt trong TSX files, tạo translation keys, ghi vào `vi.json`/`en.json`.

**Cú pháp**:

```bash
# Quét và preview (không ghi)
npx tsx scripts/scan-translations.ts "src/pages/saas/SaaSWebOrdersPage.tsx"

# Quét và ghi keys vào locale files
npx tsx scripts/scan-translations.ts "src/pages/saas/*.tsx" --write

# Quét nhiều patterns
npx tsx scripts/scan-translations.ts "src/pages/saas/SaaS*.tsx" --write
```

**Cách hoạt động**:
1. Parse TSX bằng TypeScript compiler API.
2. Tìm string literals tiếng Việt trong JSX text và string arguments.
3. Loại trùng các chuỗi data (comparison strings, option values, API payloads, template literals với `${}`).
4. Bỏ qua chuỗi đã được wrap trong `t(...)`.
5. Tạo key snake_case từ tiếng Việt (ví dụ: "Đơn hàng mới" → `don_hang_moi`).
6. Deduplication: cùng một chuỗi luôn được gán cùng một key duy nhất.
7. Với `--write`, thêm key vào cả `vi.json` (giá trị tiếng Việt) và `en.json` (placeholder tiếng Anh).

**Quy tắc key naming**:
- Chữ thường, snake_case.
- Bỏ dấu tiếng Việt.
- Ví dụ: `"Thành công"` → `thanh_cong`, `"Đơn hàng mới"` → `don_hang_moi`.

---

## 6. Storage keys

### WebShop (localStorage)
| Key | Mô tụng |
|-----|---------|
| `erp_shop_access_token` | JWT token WebShop customer |
| `erp_shop_refresh_token` | Refresh token |
| `erp_shop_current_user` | Thông tin khách hàng đăng nhập |
| `erp_shop_guest_cart_id` | Cart session ID (guest) |
| `app_language` | Ngôn ngữ hiện tại (vi/en) |
| `saas_translation_dictionary` | Cache translation dictionary |

### ERP SaaS (localStorage)
| Key | Mô tả |
|-----|------|
| `erp_saas_access_token` | JWT token ERP user |
| `erp_saas_user` | Thông tin ERP user |
| `saas_sidebar_collapsed` | Trạng thái collapse sidebar |
| `saas_translation_dictionary_updated_at` | Timestamp làm mới translations |

---

## 7. Quy tắc phát triển

### 7.1 Thêm trang SaaS mới

1. **Tạo page component** trong `src/pages/saas/`:
   - Import `{ useTranslation }` từ `react-i18next`.
   - Dùng `const { t } = useTranslation()` để dịch chuỗi UI.
   - Dùng hook `useSaaSAuth` để check role/permission.
   - Dùng hook `useToast` để hiện thông báo.

2. **Thêm route** trong `src/App.tsx`:
   - Lazy import với `import("./pages/saas/YourPage").then(m => ({ default: m.YourPage }))`.
   - Bọc trong `<SaaSProtectedRoute allowedRoles={[...]}>`.
   - Title dùng `t('layout_your_page_key')`.

3. **Kiểm tra API**: Nếu cần endpoint mới, thêm vào `src/api/saasRouter.ts` với middleware `tenantMiddleware`.

4. **Dịch chuỗi**: Chạy `npx tsx scripts/scan-translations.ts "src/pages/saas/YourPage.tsx" --write` để tự động tạo keys.

### 7.2 Thêm API endpoint mới

1. Định nghĩa trong `src/api/saasRouter.ts` hoặc `src/api/shopRouter.ts`.
2. Dùng `tenantMiddleware` để lấy `companyId`.
3. Dùng helper `query()` từ `src/db/index.ts` (có log query time).
4. Trả về format chuẩn: `{ ok: true/false, data: ..., message: ... }`.

### 7.3 Thêm bảng DB mới

1. Thêm `CREATE TABLE` trong `schema.sql`.
2. Thêm `ALTER TABLE ... ADD COLUMN IF NOT EXISTS company_id` trong phần multi-tenancy.
3. Thêm index `CREATE INDEX IF NOT EXISTS idx_..._company ON table(company_id)`.
