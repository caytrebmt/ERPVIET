// src/config.ts
// Tập trung các biến môi trường bắt buộc.
// JWT_SECRET luôn trả về `string` (không bao giờ undefined) để không gây lỗi
// overload ở jwt.sign / jwt.verify.

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET_KEY;

  // Production: bắt buộc phải có secret mạnh (>= 32 ký tự), nếu không thì dừng khởi động.
  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[Config] JWT_SECRET_KEY là bắt buộc trong production (tối thiểu 32 ký tự). ' +
        'Sinh bằng: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }

  // Môi trường dev: dùng secret tạm để server vẫn chạy được, kèm cảnh báo.
  console.warn(
    '[Config] CẢNH BÁO: JWT_SECRET_KEY chưa được thiết lập (hoặc < 32 ký tự). ' +
      'Đang dùng secret DEV tạm thời — KHÔNG dùng cho production.'
  );
  return 'dev-only-jwt-secret-erpviet-2026-not-for-production';
}

export const JWT_SECRET: string = getJwtSecret();
