import React from "react";
import { Mail, Phone, MapPin, ShieldCheck, RefreshCw, Truck, FileText } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

const Footer: React.FC = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-white dark:bg-gray-900 text-[#111827] dark:text-gray-100 border-t border-gray-200 dark:border-gray-800 mt-auto transition-colors duration-200">
      {/* Guarantees bar */}
      <div className="bg-gray-50 dark:bg-gray-950/40 py-6 border-b border-gray-200 dark:border-gray-800 transition-colors duration-200">
        <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <Truck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-900 dark:text-gray-200">
              {t("footer_fast_delivery", "GIAO HÀNG")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("footer_delivery_desc", "Giao hàng nhanh chóng trong nội thành")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-900 dark:text-gray-200">
              {t("footer_quality_assured", "CHẤT LƯỢNG ĐẢM BẢO")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("footer_quality_desc", "Sản phẩm chính hãng")}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 sm:col-span-2 lg:col-span-1">
            <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h4 className="font-semibold text-xs uppercase tracking-wider text-gray-900 dark:text-gray-200">
              {t("footer_vat_invoices", "HOÁ ĐƠN ĐẦY ĐỦ")}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("footer_vat_desc", "Hỗ trợ xuất hóa đơn VAT cho mọi đơn hàng")}
            </p>
          </div>
        </div>
      </div>

      {/* Main footer content */}
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-xs">
              W
            </div>
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white flex items-center uppercase">
              WebShop <span className="text-indigo-600 dark:text-indigo-400 ml-1">SaaS</span>
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
            {t("footer_webshop_desc", "Hệ thống webshop mang lại trải nghiệm mua sắm nhanh chóng, chính xác.")}
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 tracking-wider text-xs uppercase">
            {t("footer_contact_us", "LIÊN HỆ VỚI CHÚNG TÔI")}
          </h3>
          <ul className="space-y-3 text-xs text-gray-500 dark:text-gray-400">
            <li className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>{t("footer_address", "Đường Số 0102, Quận 1, TP. Hồ Chí Minh")}</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>028 3930 1234 / 0909 123 456</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>support@erpviet.com</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4 tracking-wider text-xs uppercase">
            {t("footer_support_policies", "CHÍNH SÁCH HỖ TRỢ")}
          </h3>
          <ul className="space-y-2 text-xs text-gray-500 dark:text-gray-400">
            <li><a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("footer_shopping_guide", "Hướng dẫn mua hàng")}</a></li>
            <li><a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("footer_shipping_policy", "Chính sách vận chuyển & giao nhận")}</a></li>
            <li><a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("footer_payment_methods", "Phương thức thanh toán bảo mật")}</a></li>
            <li><a href="#" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{t("footer_privacy_policy", "Chính sách bảo mật thông tin khách hàng")}</a></li>
          </ul>
        </div>
      </div>

      {/* Bottom copyright */}
      <div className="bg-gray-50 dark:bg-gray-950/30 border-t border-gray-200 dark:border-gray-800 py-4 text-center text-xs text-gray-400 dark:text-gray-500 transition-colors duration-200">
        <p>{t("footer_copyright", "© 2026 WebShop. Tất cả quyền được bảo lưu.")}</p>
      </div>
    </footer>
  );
};

export default Footer;
export {};
