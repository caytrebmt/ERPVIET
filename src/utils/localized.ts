/**
 * src/utils/localized.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Tập trung hoá 2 việc KHÔNG thuộc phạm vi của từ điển dịch thuật (i18next):
 *
 * 1. Chọn mã định dạng theo ngôn ngữ (Intl): ngày, số, tiền tệ.
 *      ❌ price.toLocaleString(chọn 'en-US' hay 'vi-VN' bằng tam phân)
 *      ✅ price.toLocaleString(getIntlLocale(isEnglish))
 *
 * 2. Chọn giá trị song ngữ lưu trong CSDL (name_en / name_vi, warranty_en…).
 *    Đây là dữ liệu do doanh nghiệp nhập, không phải chuỗi UI → không đưa vào
 *    từ điển `t()`, nhưng cũng không nên rải tam phân chọn ngôn ngữ khắp nơi.
 *      ❌ tam phân kiểm tra language rồi trả name_en / name_vi
 *      ✅ pickLocalized(language is 'en', product.name_en, product.name_vi)
 *
 * Bản dịch UI thật sự phải đi qua `t(key, 'Tiếng Việt')` để admin sửa được trong
 * Cài Đặt → Quản lý Dịch thuật.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** `true` khi đang ở tiếng Anh. Gom điều kiện kiểm tra ngôn ngữ về một chỗ. */
export const isEnglishLang = (language: string | undefined): boolean => Boolean(language) && `${language}`.toLowerCase().startsWith('en');

/** `en-US` khi đang ở tiếng Anh, ngược lại `vi-VN`. Dùng cho Intl / toLocaleString. */
export const getIntlLocale = (isEnglish: boolean): Intl.LocalesArgument => (isEnglish ? 'en-US' : 'vi-VN');

/** Chọn phiên bản ngôn ngữ của một TRƯỜNG DỮ LIỆU song ngữ trong DB. */
export function pickLocalized<T>(isEnglish: boolean, enValue: T, viValue: T): T {
  return isEnglish && enValue !== null && enValue !== undefined && `${enValue}` !== '' ? enValue : viValue;
}

/** Cùng helper nhưng nhận `language` trực tiếp từ LanguageContext (không cần viết tam phân ở nơi gọi). */
export const pickLocalizedByLang = <T>(language: string | undefined, enValue: T, viValue: T): T =>
  pickLocalized(isEnglishLang(language), enValue, viValue);

/** Fallback an toàn cho trường hợp bản dịch thiếu (giữ nguyên text tiếng Việt). */
export const orFallback = (value: string | null | undefined, fallback: string): string =>
  value && `${value}`.trim() ? `${value}` : fallback;
