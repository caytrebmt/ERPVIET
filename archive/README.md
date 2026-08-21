# Archive — Schema cũ (DEPRECATED)

Các file trong thư mục này **không còn được dùng** và **không được áp dụng** vào database.

Nguồn sự thật (source of truth) duy nhất cho schema là **`schema.sql`** ở thư mục gốc
(được `autoMigrateDatabase()` áp dụng cho DB mới). Các thay đổi delta từ nay quản lý
qua hệ thống migration có phiên bản trong `src/db/index.ts` (`runMigrations()` +
bảng `schema_migrations`).

| File | Lý do bỏ |
|---|---|
| `schema-optimized-deprecated.sql` | Tự nhận "ULTIMATE OPTIMIZED" (partitioning) nhưng cấu trúc **lệch** so với code hiện tại (bảng `companies` thiếu nhiều cột: `slug`, `subdomain`, `plan_type`...), chưa từng được auto-migrate. |
| `schema-fixes-helper-deprecated.sql` | Helper upsert company + trigger `updated_at`. Phần hữu ích đã được gộp/hiện thực hoá qua migration; không cần thiết giữ ở gốc. |
