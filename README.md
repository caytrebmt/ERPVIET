# 📘 HƯỚNG DẪN KẾT NỐI CƠ SỞ DỮ LIỆU SUPABASE & DEPLOY NETLIFY (FULL-STACK WEBSHOP & ERP SAAS)

---

## 🚀 1. TỔNG QUAN HỆ THỐNG & TÍNH NĂNG DEPLOY

Dự án **ERP-VIET Enterprise & WebShop E-Commerce** được thiết kế nguyên khối full-stack hiện đại:
* **Cửa hàng trực tuyến WebShop (`/`):** Xem sản phẩm, giỏ hàng, đặt hàng trực tuyến, tra cứu đơn hàng.
* **Hệ thống Quản trị ERP SaaS (`/saas`):** Đăng nhập phân quyền nhân viên (`/saas/login`), Dashboard, Quản lý đơn hàng, Kho bãi, Báo giá, Công nợ, Thuế GTGT VAT, Kế toán TT200 và Báo cáo tài chính.
* **Tự động thích ứng trên Netlify:** Chạy song song cả Giao diện Frontend Single Page App (SPA) và Backend API Node.js/Express serverless trên Netlify Functions.

---

## 🗄️ 2. KẾT NỐI CƠ SỞ DỮ LIỆU SUPABASE (POSTGRESQL)

Dự án sử dụng trình kết nối PostgreSQL `pg` thông minh tự động hỗ trợ kết nối SSL mã hóa tới **Supabase Cloud Database**.

### Các bước lấy thông số Supabase:
1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard) -> Chọn dự án của bạn (hoặc tạo dự án mới).
2. Vào **Project Settings** -> **Database**.
3. Tại phần **Connection String**, chọn tab **URI** (hoặc **Transaction Pooler** - Cổng `6543` thích hợp cho Serverless/Netlify):
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
4. Dán chuỗi này vào biến môi trường `SUPABASE_DATABASE_URL` hoặc `DATABASE_URL`.

### Cơ chế Auto-Migration tự động với Supabase:
* Khi biến `SUPABASE_DATABASE_URL` hoặc `DATABASE_URL` được khai báo, hệ thống sẽ tự động kết nối bằng SSL (`ssl: { rejectUnauthorized: false }`).
* Hệ thống tự động khởi tạo cấu trúc cơ sở dữ liệu song ngữ đầy đủ từ tệp `schema.sql` (bảng sản phẩm, danh mục, đơn hàng, hóa đơn VAT, sổ cái kế toán...).

---

## 🌐 3. HƯỚNG DẪN DEPLOY TRÊN NETLIFY (CHI TIẾT TỪ A-Z)

Dự án đã tích hợp sẵn tệp cấu hình chuẩn Netlify `netlify.toml`, Netlify Function (`netlify/functions/api.ts`) và quy tắc điều hướng `_redirects` giúp chạy hoàn hảo cả Frontend SPA lẫn Backend API trên Netlify.

### Step 1: Push mã nguồn lên GitHub / GitLab
```bash
git add .
git commit -m "Deploy WebShop & ERP SaaS with Supabase & Netlify Functions"
git push origin main
```

### Step 2: Tạo Site mới trên Netlify
1. Đăng nhập vào [Netlify Console](https://app.netlify.com).
2. Bấm **Add new site** -> **Import an existing project** -> Chọn **GitHub**.
3. Chọn Repository chứa dự án của bạn.

### Step 3: Cấu hình Build Settings trên Netlify
Netlify sẽ tự động nhận diện tệp `netlify.toml`. Vui lòng xác nhận các thông số:
* **Build command:** `npm run build`
* **Publish directory:** `dist`
* **Functions directory:** `netlify/functions`

### Step 4: Cấu hình Environment Variables (Biến Môi Trường) trên Netlify
Vào **Site settings** -> **Environment variables** -> Bấm **Add a variable** và thêm các biến:

| Tên biến (Key) | Giá trị (Value) | Mô tả |
|---|---|---|
| `SUPABASE_DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@...:6543/postgres` | Chuỗi kết nối Supabase Postgres |
| `VITE_SUPABASE_URL` | `https://[YOUR-REF].supabase.co` | URL REST API Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1Ni...` | Khoá Anon Key Supabase |
| `JWT_SECRET_KEY` | `erpacc-super-secret-jwt-key-2026` | Khóa mã hóa JWT xác thực ERP |
| `NODE_ENV` | `production` | Chế độ Production |
| `VITE_API_BASE_URL` | `/api` | Đường dẫn gốc API trên Netlify |

### Step 5: Đội ngũ & Kiểm thử sau khi Deploy
Bấm **Deploy site**.
Sau khi Netlify hoàn tất build:
* **Truy cập WebShop Bán Hàng:** `https://your-site.netlify.app/`
* **Truy cập Cổng Đăng Nhập ERP SaaS:** `https://your-site.netlify.app/saas/login` (Thử đăng nhập tài khoản `admin` / `admin123` hoặc `sales1`, `accountant1`...)
* **Kiểm tra API Health Check:** `https://your-site.netlify.app/api/health`

---

## ⚡ 4. LỆNH CHẠY & MÔI TRƯỜNG CỤC BỘ (LOCAL DEVELOPMENT)

```bash
# 1. Chạy chế độ Development trên máy máy local
npm run dev

# 2. Kiểm tra lỗi Typescript & Linter
npm run lint

# 3. Đóng gói kiểm thử bản Build Netlify
npm run build
```
