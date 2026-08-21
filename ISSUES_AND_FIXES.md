# 🛠️ ERPVIET — DANH SÁCH ISSUE & HƯỚNG DẪN FIX CHI TIẾT
### (Checklist triển khai — từng điểm: vị trí → việc cần làm → code cụ thể → cách kiểm tra)

> Kèm theo báo cáo `LEADER_EVALUATION.md`. Các đoạn code dưới đây đã được đối chiếu đúng với source hiện tại tại commit `67cec32`.

**Ký hiệu mức ưu tiên:** 🔴 Blocker (chặn deploy) · 🟠 High · 🟡 Medium · ⚪ Low

---

## 🔴 ISSUE #1 — Backdoor đăng nhập bằng mật khẩu demo

**Vị trí:** `src/api/saasRouter.ts`, hàm `POST /auth/login` (dòng ~145–155)

**Vấn đề:** Khi `bcrypt.compare` thất bại, code vẫn `isMatch = demoPasswords.includes(...)`. Nghĩa là **bất kỳ user nào** cũng đăng nhập được bằng `admin123` / `password123` / `web12345` / `techviet123`, bất kể mật khẩu thật trong DB.

**Fix — xóa nguyên block demo:**

```ts
// ❌ XÓA ĐOẠN NÀY (src/api/saasRouter.ts):
      // Demo passwords for backward compatibility with test data
      if (!isMatch) {
        const demoPasswords = [
          'password123',
          'admin123',
          'web12345',
          'techviet123',
        ];
        isMatch = demoPasswords.includes(cleanPass.toLowerCase());
      }

      if (!isMatch) { ... } // giữ lại nhánh 401 này
```

Sau khi xóa, luồng chỉ còn `bcrypt.compare` (hoặc fallback plaintext cho legacy — xem Issue #5, khuyến nghị bỏ luôn fallback plaintext).

**Kiểm tra:** đăng nhập `admin` với mật khẩu `admin123` → **phải bị 401**; chỉ mật khẩu thật (hash bcrypt) mới vào được.

---

## 🔴 ISSUE #2 — JWT secret có giá trị mặc định (tự ký được token)

**Vị trí:** 3 nơi cùng khai báo trùng lặp:
- `src/middleware/tenant.ts` (dòng 5)
- `src/middleware/shopTenant.ts` (dòng 5)
- `src/api/saasRouter.ts` (dòng 107)

```ts
const JWT_SECRET = process.env.JWT_SECRET_KEY || 'jwt-secret-webshop-2026';
```

**Vấn đề:** Nếu env chưa set, hệ thống dùng secret công khai trong source → kẻ tấn công tự ký JWT, giả mạo bất kỳ `userId`/`companyId`/`role`.

**Fix — tạo module config dùng chung, fail-fast:**

Tạo file mới `src/config.ts`:

```ts
// src/config.ts
const JWT_SECRET = process.env.JWT_SECRET_KEY;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    '[Config] JWT_SECRET_KEY is required and must be >= 32 characters. Set it in .env'
  );
}
export { JWT_SECRET };
```

Thay 3 chỗ khai báo bằng:

```ts
import { JWT_SECRET } from '../config';          // trong middleware
import { JWT_SECRET } from '../config';          // trong saasRouter
```

**Kiểm tra:** xóa `JWT_SECRET_KEY` khỏi `.env` rồi `npm run dev` → server phải **từ chối khởi động** kèm thông báo lỗi.

---

## 🔴 ISSUE #3 — Rò rỉ cross-tenant do fallback `company_id = 1` + nhầm lẫn super-admin khiến `/saas/tenants` hỏng

**Vị trí:**
- `src/middleware/tenant.ts` (dòng ~40–42):
```ts
    if (!companyId && !isSuperAdmin) {
      companyId = 1;
    }
```
- `src/middleware/shopTenant.ts` (dòng ~58–68): fallback `WHERE id = 1` khi không xác định được slug/JWT.
- `src/api/saasRouter.ts` `GET /tenants/list` (dòng ~993): query `SELECT ... FROM companies ORDER BY id DESC` — **KHÔNG filter `company_id`** → là thao tác toàn cục (super admin), không phải theo tenant.

**Vấn đề (3 phần):**
1. **Rò rỉ cross-tenant:** token hợp lệ nhưng thiếu `companyId` sẽ tự trỏ về tenant #1 → đọc/ghi nhầm dữ liệu doanh nghiệp khác.
2. **Super-admin là dead code:** JWT được ký với `role: 'ADMIN'` (dòng ~170) nhưng middleware kiểm tra `decoded.role === 'SUPER_ADMIN'` → `isSuperAdmin` **luôn = false** trong thực tế.
3. **Nếu chỉ "bỏ fallback + trả 403" thì trang `/saas/tenants` sẽ hỏng:** super admin toàn cục không có `companyId` sẽ bị 403 → **không tải được danh sách doanh nghiệp** (đúng lỗi đã gặp).

> **Nguyên tắc:** nhóm route `/saas/tenants` là chức năng **quản trị nền tảng (super admin)**, còn các route nghiệp vụ là **theo tenant**. Không được dùng chung một quy tắc cho cả hai.

---

### Fix 3a — Đánh dấu super admin trong DB

Thêm cột + gán cờ cho admin nền tảng (chỉ admin toàn hệ thống, KHÔNG phải admin của từng tenant):

```sql
ALTER TABLE sys_users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- admin nền tảng ERPACC (quản lý MỌI tenant)
UPDATE sys_users SET is_super_admin = TRUE WHERE username = 'admin';
```

> Admin tạo qua `/tenants/register` giữ `FALSE` — họ chỉ quản lý tenant của mình.

### Fix 3b — Ký `isSuperAdmin` vào JWT

`src/api/saasRouter.ts`, trong `/auth/login` (và `/auth/me`), thêm vào `userObj`:

```ts
is_super_admin: !!dbUser.is_super_admin,
```

Và đổi payload khi `jwt.sign`:

```ts
const token = jwt.sign(
  {
    userId: userObj.id,
    username: userObj.username,
    role: userObj.role_code,
    companyId: userObj.company_id,
    isSuperAdmin: !!dbUser.is_super_admin,   // 👈 thêm
  },
  JWT_SECRET,
  { expiresIn: '7d' }
);
```

### Fix 3c — `tenantMiddleware` đọc đúng cờ

`src/middleware/tenant.ts`, sửa:

```ts
// ❌ const isSuperAdmin = decoded.role === 'SUPER_ADMIN';
// ✅
const isSuperAdmin = decoded.isSuperAdmin === true;
```

Giữ nguyên việc bỏ fallback (super admin giờ được nhận diện đúng nên không bị chặn oan):

```ts
if (!companyId && !isSuperAdmin) {
  return res.status(403).json({
    ok: false,
    message: 'Không xác định được tenant cho tài khoản này',
  });
}
```

`src/middleware/shopTenant.ts`: bỏ khối default fallback `SELECT ... WHERE id = 1`; nếu không xác định được tenant và route yêu cầu tenant thì trả 404/400.

### Fix 3d — Middleware riêng cho super admin

`src/middleware/tenant.ts` (cùng file), thêm:

```ts
export function requireSuperAdmin(req: TenantRequest, res: Response, next: NextFunction) {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ ok: false, message: 'Chỉ quản trị viên nền tảng mới có quyền này' });
  }
  next();
}
```

### Fix 3e — Gắn `requireSuperAdmin` cho các route tenants TOÀN CỤC

`src/api/saasRouter.ts` (không áp cho `/tenants/me` — route đó là "thông tin công ty của chính mình"):

```ts
saasRouter.get('/tenants/list', tenantMiddleware, requireSuperAdmin, async (req, res) => { ... });
saasRouter.get('/tenants/:id', tenantMiddleware, requireSuperAdmin, async (req, res) => { ... });
saasRouter.patch('/tenants/:id', tenantMiddleware, requireSuperAdmin, async (req, res) => { ... });
saasRouter.post('/tenants/:id/pause', tenantMiddleware, requireSuperAdmin, async (req, res) => { ... });
saasRouter.post('/tenants/:id/upgrade', tenantMiddleware, requireSuperAdmin, async (req, res) => { ... });
```

Bổ sung import ở đầu file:

```ts
import { tenantMiddleware, requireSuperAdmin } from '../middleware/tenant';
```

> Bonus bảo mật: sửa được lỗ hổng **hiện tại** — trước đây bất kỳ ai có token (kể cả `sales1`) đều gọi được các endpoint quản lý doanh nghiệp này.

### Fix 3f — Chặn ở frontend

`src/types.ts` — thêm field vào `ErpUser`:

```ts
is_super_admin?: boolean;
```

`src/components/SaaSProtectedRoute.tsx` — thêm prop `superAdminOnly`:

```tsx
interface SaaSProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  superAdminOnly?: boolean;   // 👈 thêm
}
// sau khối check allowedRoles, thêm:
if (superAdminOnly && !erpUser?.is_super_admin) {
  return ( /* dùng lại giao diện 403 sẵn có */ );
}
```

`src/App.tsx` — route tenants:

```tsx
<SaaSProtectedRoute allowedRoles={["ADMIN"]} superAdminOnly>
```

`src/components/SaaSSidebar.tsx` — trong `isAllowedPath`, thêm đầu hàm:

```ts
const isAllowedPath = (path: string): boolean => {
  if (path === '/saas/tenants') return !!erpUser?.is_super_admin;   // 👈 thêm
  if (role === 'ADMIN') return true;
  // ...
};
```

---

### Bảng tổng kết quy tắc middleware (tránh nhầm lần sau)

| Nhóm route | Middleware | Quy tắc |
|---|---|---|
| Nghiệp vụ theo tenant (products, orders, inventory...) | `tenantMiddleware` | Phải có `companyId`; thiếu → 403 (không fallback) |
| **Quản lý doanh nghiệp** (`/tenants/list`, `/:id`, pause, upgrade) | `tenantMiddleware` **+ `requireSuperAdmin`** | Chỉ super admin toàn cục; query không filter company |
| `/tenants/me` (công ty của chính mình) | `tenantMiddleware` | Trả đúng `companyId` của mình |

**Kiểm tra:**
1. Token JWT thiếu `companyId` (role thường) → gọi API nghiệp vụ phải bị 403, không trả dữ liệu tenant #1.
2. Đăng nhập `admin` (đã `is_super_admin=TRUE`) → vào `/saas/tenants` tải được **toàn bộ** danh sách doanh nghiệp.
3. Đăng nhập admin thường của 1 tenant → không thấy menu "Quản lý Doanh nghiệp"; gọi `GET /api/saas/tenants/list` bị 403.

---

## 🔴 ISSUE #4 — RBAC chỉ ở frontend + permission bị hardcode

**Vị trí:**
- `src/api/saasRouter.ts` — `userObj.permissions` bị hardcode ở cả `/auth/login` và `/auth/me`:
```ts
permissions: dbUser.role_code === 'ADMIN' ? ['*'] : ['quotation:view', 'quotation:create', 'order:view', 'customer:view', 'product:view'],
```
- Backend endpoint **không kiểm tra permission**; việc chặn quyền chỉ ở React (`SaaSProtectedRoute`, `hasRole/hasPermission` trong `SaaSAuthContext.tsx`).

**Vấn đề:** Bảng `sys_role_permissions` trong DB không được dùng; user gọi trực tiếp API vẫn vượt quyền.

**Fix 4a — đọc permission thật từ DB:**

Thêm helper trong `src/api/saasRouter.ts`:

```ts
async function getPermissionsForUser(userId: number, roleCode: string): Promise<string[]> {
  if (roleCode === 'ADMIN') return ['*'];
  const res = await query(
    `SELECT COALESCE(array_agg(DISTINCT srp.permission_code), '{}') AS perms
       FROM sys_role_permissions srp
       JOIN sys_roles r ON r.id = srp.role_id
       JOIN sys_users u ON u.role_id = r.id
      WHERE u.id = $1`,
    [userId]
  );
  return res.rows[0]?.perms || [];
}
```

Thay dòng hardcode trong login và `/auth/me`:

```ts
permissions: await getPermissionsForUser(dbUser.id, dbUser.role_code || 'ADMIN'),
```

**Fix 4b — middleware authorize ở backend:**

```ts
// thêm vào src/middleware/tenant.ts (sau khi đã load permissions)
export function requirePermission(perm: string) {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    const perms: string[] = req.userPermissions || [];
    if (perms.includes('*') || perms.includes(perm)) return next();
    return res.status(403).json({ ok: false, message: `Không có quyền: ${perm}` });
  };
}
```

Trong `tenantMiddleware`, load và gắn `req.userPermissions` (query `sys_role_permissions` theo `decoded.userId`). Sau đó áp dụng cho các route nhạy cảm, ví dụ:

```ts
saasRouter.post('/products', tenantMiddleware, requirePermission('products:create'), async (req, res) => { ... });
```

> Lưu ý: hiện `sys_permissions` trong `schema.sql` mới chỉ seed cho module `products`. Cần **mở rộng seed** cho đủ các module (orders, inventory, customers, quotations, accounting...) để RBAC có ý nghĩa.

**Kiểm tra:** đăng nhập `sales1` → gọi `POST /api/saas/products` (không thuộc quyền) phải bị 403 ở tầng API, không chỉ bị chặn ở giao diện.

---

## 🔴 ISSUE #5 — Đăng ký tenant lưu mật khẩu DẠNG PLAINTEXT

**Vị trí:** `src/api/saasRouter.ts`, `POST /tenants/register` (dòng ~1044–1047):

```ts
INSERT INTO sys_users (..., password_hash, ...)
VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'vi')
```
với tham số thứ 4 là **`owner_password` (thô, chưa hash)**.

**Vấn đề:** Mật khẩu admin của tenant mới bị lưu plaintext trong DB; login khớp nhờ nhánh fallback `storedHash === cleanPass`.

**Fix:**

```ts
const passwordHash = await bcrypt.hash(owner_password, BCRYPT_ROUNDS); // BCRYPT_ROUNDS = 10 đã dùng sẵn ở user CRUD
const userResult = await client.query(
  `INSERT INTO sys_users (company_id, username, email, password_hash, full_name, phone, role_id, status, preferred_lang)
   VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', 'vi') RETURNING id`,
  [companyId, owner_email, owner_email, passwordHash, owner_name || owner_email, phone || null, roleId]
);
```

Đồng thời (khuyến nghị) **bỏ nhánh fallback plaintext** trong `/auth/login`:

```ts
// XÓA:
      } else {
        isMatch = storedHash === cleanPass || storedHash === cleanPass.toLowerCase();
      }
// Chỉ giữ nhánh bcrypt. Với dữ liệu legacy plaintext, chạy script 1 lần để hash lại.
```

**Kiểm tra:** đăng ký tenant mới → xem DB cột `password_hash` phải bắt đầu bằng `$2a$`/`$2b$`, không còn chuỗi thô.

---

## 🟠 ISSUE #6 — Dùng chung 1 hash bcrypt "ma thuật" cho mọi user seed/Google

**Vị trí:**
- `schema.sql` dòng ~406: cả 4 user `admin/accountant1/thukho1/sales1` đều dùng chung `'$2a$10$wT0C2c2E1v6cE8Xg8A3A8uQ4P0O6N9M8L7K6J5H4G3F2E1D0C'`.
- `src/api/saasRouter.ts` (Google callback, dòng ~1156) và `src/api/shopRouter.ts` (dòng ~487) cũng gán cùng hash này cho user mới.

**Vấn đề:** Mọi tài khoản seed dùng chung một mật khẩu không rõ giá trị; user tạo qua Google/OAuth thừa hưởng một mật khẩu "chung" không ai biết → vừa không an toàn vừa không login bằng password được.

**Fix:**

1. Sinh hash thật cho seed data (chạy 1 lần):
```bash
node -e "const b=require('bcryptjs');Promise.all(['admin123','ketoan123','thukho123','sales123'].map(p=>b.hash(p,10))).then(h=>h.forEach((x,i)=>console.log(i,x)))"
```
Rồi cập nhật `password_hash` trong `schema.sql` tương ứng từng user.

2. Với user tạo qua Google (không đăng nhập bằng password), **không đặt mật khẩu dùng chung** — đặt giá trị ngẫu nhiên không đăng nhập được:
```ts
import crypto from 'crypto';
const randomHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
```

**Kiểm tra:** từng user seed có hash riêng; user Google không thể đăng nhập bằng password cũ.

---

## 🟠 ISSUE #7 — 3 file schema mâu thuẫn, không có nguồn sự thật

**Vị trí:** `schema.sql` (2,807 dòng, 102 bảng, được auto-migrate) vs `schema - fix.sql` (851 dòng, tự nhận "ULTIMATE OPTIMIZED") vs `schema_fixes.sql` (69 dòng helper).

**Vấn đề:** `autoMigrateDatabase()` trong `src/db/index.ts` **chỉ áp dụng `schema.sql` + `insertdata.sql`**. Hai file còn lại nằm chết, cấu trúc lệch nhau (ví dụ bảng `companies` trong `schema - fix.sql` thiếu nhiều cột: `slug`, `subdomain`, `plan_type`...).

**Fix:**
1. **Chọn `schema.sql` làm nguồn sự thật** (đang là file được auto-migrate và khớp với code).
2. Gộp các phần hữu ích của `schema_fixes.sql` (upsert company, trigger `updated_at`) vào `schema.sql`, sau đó **xóa/đổi tên 2 file còn lại** sang thư mục `archive/` hoặc xóa hẳn.
3. Thêm chú thích đầu `schema.sql`: "SOURCE OF TRUTH — mọi thay đổi DB chỉ sửa ở đây".

**Kiểm tra:** chỉ còn 1 file schema; `grep -rl "CREATE TABLE" *.sql` chỉ ra đúng 1 file chính.

---

## 🟠 ISSUE #8 — Không có migration có phiên bản

**Vị trí:** `src/db/index.ts` — `autoMigrateDatabase()` đọc nguyên file SQL, `pool.query(sql)`, bỏ qua nếu thấy có dữ liệu. Schema thay đổi về sau được vá bằng `ensureProductImageSchema()` thủ công.

**Vấn đề:** Không track được version; deploy lên DB đã có dữ liệu sẽ không áp dụng được schema mới.

**Fix — tự tạo bảng version đơn giản (không cần thêm dependency):**

```ts
// src/db/index.ts
async function ensureMigrationsTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}

export async function runMigrations() {
  await ensureMigrationsTable();
  const applied = new Set(
    (await pool.query('SELECT version FROM schema_migrations')).rows.map(r => r.version)
  );
  const migrations = [
    { version: 1, name: 'init', sql: fs.readFileSync(path.join(process.cwd(), 'migrations/001_init.sql'), 'utf8') },
    // thêm các bước tiếp theo tại đây
  ];
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    await pool.query('BEGIN');
    try {
      await pool.query(m.sql);
      await pool.query('INSERT INTO schema_migrations (version, name) VALUES ($1, $2)', [m.version, m.name]);
      await pool.query('COMMIT');
      console.log(`[Migration] applied ${m.version}_${m.name}`);
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  }
}
```

Chuyển nội dung `schema.sql` sang `migrations/001_init.sql` và gọi `runMigrations()` thay cho `autoMigrateDatabase()`. Bỏ luôn `ensureProductImageSchema()` (đưa vào migration).

**Kiểm tra:** chạy 2 lần liên tiếp → lần 2 không apply lại; bảng `schema_migrations` có bản ghi.

---

## 🟠 ISSUE #9 — Không giới hạn số lần đăng nhập (brute-force)

**Vị trí:** `POST /api/saas/auth/login` — không có rate-limit, không khóa tài khoản.

**Fix — dùng `express-rate-limit` (thêm dependency):**

```bash
npm i express-rate-limit
```

```ts
// src/api/saasRouter.ts
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,                  // tối đa 10 lần thử / IP
  message: { ok: false, message: 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau 15 phút.' },
});

saasRouter.post('/auth/login', loginLimiter, async (req, res) => { ... });
```

**Kiểm tra:** gửi sai mật khẩu >10 lần → bị 429.

---

## 🟠 ISSUE #10 — CORS mở toàn bộ + payload 50MB

**Vị trí:** `server.ts` (`app.use(cors())`, `express.json({limit:'50mb'})`) và `netlify/functions/api.ts` tương tự.

**Fix:**

```ts
// server.ts
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true, // true cho webshop public; cấu hình domain cụ thể cho SaaS
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
```

> Giữ `50mb` **chỉ** ở route xử lý upload ảnh Base64 nếu thực sự cần, không áp toàn cục.

**Kiểm tra:** origin lạ gọi API SaaS bị chặn CORS; payload >5MB bị reject.

---

## 🟡 ISSUE #11 — Logging quá mức (log mọi câu SQL)

**Vị trí:** `src/db/index.ts` — `query()`:
```ts
console.log(`[DB Query] executed in ${duration}ms, rows: ${res.rowCount}`);
```

**Fix — level-based, chỉ log khi debug hoặc query chậm:**

```ts
const DEBUG_QUERY = process.env.DEBUG_QUERY === 'true';
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 1000);

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (DEBUG_QUERY) console.log(`[DB] ${duration}ms ${text}`);
  else if (duration > SLOW_QUERY_MS) console.warn(`[DB Slow] ${duration}ms ${text}`);
  return res;
}
```

**Kiểm tra:** production không in dồn dập log SQL; query >1s vẫn được cảnh báo.

---

## 🟡 ISSUE #12 — i18n tiếng Anh chưa hoàn thiện (481/1402 key)

**Vị trí:** `public/locales/en.json` thiếu ~66% key; `missing-translations-report.md` ghi nhận 1,031 chuỗi hardcode.

**Fix:**
1. Chạy scanner để extract chuỗi hardcode:
```bash
npx tsx scripts/scan-translations.ts "src/**/*.tsx" --write
```
2. Đồng bộ key còn thiếu vào `en.json`:
```bash
npx tsx scripts/add-missing-keys.ts
```
3. Dịch các giá trị placeholder tiếng Anh trong `en.json`.

**Kiểm tra:** `Object.keys(vi).length === Object.keys(en).length`; chạy `scripts/find-missing-keys.cjs` cho kết quả rỗng.

---

## 🟡 ISSUE #13 — Dependency thừa / gây hiểu nhầm

**Vị trí:** `package.json`.

**Vấn đề:** `next-i18next`, `next-intl` (thư viện Next.js — dự án là Vite/React), `@google/genai` (không dùng ở đâu, dù `metadata.json` khai báo "SERVER_SIDE_GEMINI_API").

**Fix:**
```bash
npm uninstall next-i18next next-intl @google/genai
```
Và sửa `metadata.json` (bỏ `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`) nếu không thực sự dùng Gemini.

**Kiểm tra:** `npm run lint` + `npm run build` vẫn pass; `grep -r "next-intl\|next-i18next\|genai" src/` trả rỗng.

---

## 🟡 ISSUE #14 — File rác bị commit

**Vị trí (root):** `--extensions`, `-d`, `npx`, `i18n-replacements.json` (rỗng), `check_toasts.js`, `extract-strings.cjs`, `generate-report.cjs`, `codemods/`... (các artifact quá trình i18n).

**Fix:**
```bash
git rm --cached -- "--extensions" "-d" npx i18n-replacements.json
# rà soát các script tạm còn dùng hay không trước khi xóa
```

**Kiểm tra:** `git status` sạch; root chỉ còn file cần thiết.

---

## 🟡 ISSUE #15 — Tài liệu lệch code (doc drift)

**Vị trí:** `PROJECT_INFO.md`, `README.md`.

**Lệch thực tế:**
- Ghi "React 18 + React Router v6" → thực tế **React 19 + react-router-dom 7.11**.
- `saasRouter.ts` ghi ~1072 dòng → thực tế 1269.
- `vi.json` ghi ~1300 key → thực tế 1402.
- README hướng dẫn set `JWT_SECRET_KEY=erpacc-super-secret-jwt-key-2026` → **đây là secret "nổi tiếng", phải bỏ**.

**Fix:** cập nhật số liệu/phiên bản; ở README thay dòng JWT bằng hướng dẫn sinh secret ngẫu nhiên:
```bash
openssl rand -base64 48   # hoặc: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Kiểm tra:** đối chiếu lại số dòng `wc -l`, phiên bản `npm ls react react-router-dom`.

---

## 🟡 ISSUE #16 — Thiếu `.env.example`

**Vị trí:** `.gitignore` đã cho phép `!.env.example` nhưng file không tồn tại.

**Fix — tạo `.env.example`:**

```dotenv
PORT=3000
NODE_ENV=development
# Sinh bằng: openssl rand -base64 48 (BẮT BUỘC, >= 32 ký tự)
JWT_SECRET_KEY=
# Chọn 1 trong 2:
SUPABASE_DATABASE_URL=postgresql://postgres.[REF]:[PASS]@...pooler.supabase.com:6543/postgres?pgbouncer=true
# DATABASE_URL=postgresql://user:pass@localhost:5432/erpacc_db
AUTO_MIGRATE_DATABASE=false
# Tùy chọn
CORS_ORIGINS=https://your-site.netlify.app
DEBUG_QUERY=false
SLOW_QUERY_MS=1000
```

**Kiểm tra:** `git add .env.example` được phép (không bị ignore).

---

## 🟡 ISSUE #17 — `rejectUnauthorized: false` khi kết nối DB

**Vị trí:** `src/db/index.ts` (cấu hình pool):
```ts
ssl: useSsl ? { rejectUnauthorized: false } : false,
```

**Vấn đề:** Tắt verify chứng chỉ SSL → dễ MITM. Chấp nhận được cho Supabase pooler, nhưng nên tường minh.

**Fix:** chỉ tắt verify cho đúng host Supabase, còn lại yêu cầu verify:
```ts
const sslConfig = isSupabase
  ? { rejectUnauthorized: false }              // Supabase pooler dùng SNI, không verify CN được
  : useSsl
    ? { rejectUnauthorized: true }             // DB khác: bắt buộc verify
    : false;
```

**Kiểm tra:** kết nối Supabase vẫn chạy; DB self-host có SSL đúng chứng chỉ vẫn kết nối.

---

## 🟡 ISSUE #18 — Procurement (PR) lưu localStorage, chưa có endpoint DB

**Vị trí:** `src/services/procurementStore.ts` — key `erp_procurement_prs_v1`; PROJECT_INFO ghi rõ "lưu tạm cho đến khi có DB endpoint".

**Vấn đề:** Dữ liệu yêu cầu mua hàng mất khi đổi thiết bị/trình duyệt, không multi-user.

**Fix (đề xuất):** thêm route dựa trên bảng `purchase_requests` đã có sẵn trong `schema.sql`:
```ts
saasRouter.get('/purchasing/requests', tenantMiddleware, async (req, res) => {
  const r = await query('SELECT * FROM purchase_requests WHERE company_id = $1 ORDER BY id DESC', [req.companyId]);
  res.json({ ok: true, data: r.rows });
});
saasRouter.post('/purchasing/requests', tenantMiddleware, async (req, res) => {
  // INSERT ... RETURNING *, thay thế localStorage
});
```
Rồi đổi `SaaSPurchasingPage` gọi API thay vì `procurementStore`.

**Kiểm tra:** tạo PR ở máy A, mở máy B vẫn thấy (lưu DB).

---

## 🟡 ISSUE #19 — Chưa có test & CI/CD

**Vị trí:** không có script `test`, không có file test, không có thư mục `.github/workflows`.

**Fix:**
1. Thêm script:
```json
"test": "vitest run"
```
2. Viết tối thiểu các smoke test (Vitest + Supertest):
   - Login đúng/sai mật khẩu (đảm bảo demo-password bị chặn).
   - Tenant isolation: token thiếu companyId bị 403.
   - Luồng inventory movement có cập nhật `stock_balances`.
3. Thêm CI (`.github/workflows/ci.yml`):
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

**Kiểm tra:** push lên GitHub → workflow chạy xanh.

---

## ✅ CHECKLIST TỔNG HỢP (theo thứ tự triển khai)

| # | Issue | Mức | Trạng thái |
|---|---|---|---|
| 1 | Gỡ backdoor demo-password | 🔴 | ✅ Xong |
| 2 | JWT secret fail-fast (bỏ mặc định) | 🔴 | ✅ Xong |
| 3 | Tenant isolation (bỏ fallback id=1) + tách middleware super-admin cho `/saas/tenants` | 🔴 | ✅ Xong |
| 4 | RBAC backend (đọc `sys_role_permissions` + `requirePermission`) | 🔴 | ✅ Xong (infra + load permission; cần mở rộng seed permission + gắn cho từng route) |
| 5 | Hash mật khẩu khi đăng ký tenant (bỏ plaintext) | 🔴 | ✅ Xong |
| 6 | Tách hash bcrypt riêng cho từng seed user + Google | 🟠 | ✅ Xong |
| 7 | Hợp nhất 3 file schema thành 1 | 🟠 | ✅ Xong (archive 2 file, `schema.sql` là source of truth) |
| 8 | Migration có versioning | 🟠 | ✅ Xong (`runMigrations` + `schema_migrations`) |
| 9 | Rate-limit login | 🟠 | ✅ Xong |
| 10 | CORS whitelist + giảm payload limit | 🟠 | ✅ Xong |
| 11 | Logging level-based | 🟡 | ✅ Xong |
| 12 | Hoàn thiện `en.json` | 🟡 | ⏳ Cần dịch thủ công (fallback vi đã có) |
| 13 | Gỡ dependency thừa | 🟡 | ✅ Xong |
| 14 | Dọn file rác | 🟡 | ✅ Xong |
| 15 | Đồng bộ tài liệu + bỏ secret mẫu trong README | 🟡 | ✅ Xong |
| 16 | Tạo `.env.example` | 🟡 | ✅ Xong |
| 17 | Siết SSL verify | 🟡 | ✅ Xong |
| 18 | Đưa procurement ra khỏi localStorage | 🟡 | ✅ Xong (bảng `procurement_lists` JSONB + API + đổi 2 trang frontend) |
| 19 | Thêm test + CI/CD | 🟡 | ✅ Xong (vitest + 8 test + CI workflow) |

---

> **Đề xuất:** 6 issue 🔴 phải đóng **trước khi go-live**. Nếu bạn muốn, tôi có thể **triển khai trực tiếp** các fix bảo mật (Issue #1–#6) ngay trên branch này và chạy lại `lint`/`build` để xác nhận.
