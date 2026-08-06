import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type Language = 'vi' | 'en';

export interface TranslationItem {
  key: string;
  category: string;
  vi: string;
  en: string;
  isCustom?: boolean;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: string, defaultText?: string) => string;
  translationsList: TranslationItem[];
  updateTranslation: (key: string, vi: string, en: string, category?: string) => Promise<void>;
  deleteTranslation: (key: string) => Promise<void>;
  resetToDefaults: () => void;
  refreshTranslations: () => Promise<void>;
}

export const initialTranslationItems: TranslationItem[] = [
  // WEBSHOP STOREFRONT
  { key: 'nav_home', category: 'menu', vi: 'Trang chủ', en: 'Home' },
  { key: 'nav_cart', category: 'menu', vi: 'Giỏ hàng', en: 'Cart' },
  { key: 'nav_categories', category: 'menu', vi: 'Danh mục', en: 'Categories' },
  { key: 'nav_all_products', category: 'menu', vi: 'Tất cả sản phẩm', en: 'All Products' },
  { key: 'nav_account', category: 'menu', vi: 'Tài khoản', en: 'Account' },
  { key: 'nav_my_orders', category: 'menu', vi: 'Đơn hàng của tôi', en: 'My Orders' },
  { key: 'nav_my_profile', category: 'menu', vi: 'Hồ sơ cá nhân', en: 'My Profile' },
  { key: 'nav_login', category: 'menu', vi: 'Đăng nhập', en: 'Login' },
  { key: 'nav_register', category: 'menu', vi: 'Đăng ký', en: 'Register' },
  { key: 'nav_logout', category: 'menu', vi: 'Đăng xuất', en: 'Logout' },
  { key: 'search_product_placeholder', category: 'common', vi: 'Tìm tên sản phẩm, mã SKU...', en: 'Search products, SKU...' },
  { key: 'store_title', category: 'menu', vi: 'Cửa hàng', en: 'Store' },
  { key: 'erp_saas_admin', category: 'menu', vi: 'Trang Quản Trị ERP SaaS', en: 'ERP SaaS Admin Dashboard' },
  { key: 'verified_account', category: 'common', vi: 'Tài khoản đã xác thực', en: 'Verified Account' },
  { key: 'customer_code', category: 'common', vi: 'Mã KH', en: 'Customer ID' },
  { key: 'webshop_customer', category: 'common', vi: 'Khách hàng WebShop', en: 'WebShop Customer' },
  { key: 'profile_password', category: 'menu', vi: 'Hồ sơ cá nhân & Mật khẩu', en: 'Profile & Password' },
  { key: 'switch_light_mode', category: 'common', vi: 'Chuyển sang Giao diện Sáng', en: 'Switch to Light Mode' },
  { key: 'switch_dark_mode', category: 'common', vi: 'Chuyển sang Giao diện Tối', en: 'Switch to Dark Mode' },

  // WEBSHOP CATEGORIES
  { key: 'Điện tử', category: 'categories', vi: 'Điện tử', en: 'Electronics' },
  { key: 'Laptop', category: 'categories', vi: 'Laptop', en: 'Laptops' },
  { key: 'Văn phòng phẩm', category: 'categories', vi: 'Văn phòng phẩm', en: 'Office Supplies' },
  { key: 'Thực phẩm', category: 'categories', vi: 'Thực phẩm', en: 'Groceries & Food' },
  { key: 'Ô tô - Xe máy', category: 'categories', vi: 'Ô tô - Xe máy', en: 'Automotive & Motorbikes' },
  { key: 'Thời trang', category: 'categories', vi: 'Thời trang', en: 'Fashion' },
  { key: 'Gia dụng', category: 'categories', vi: 'Gia dụng', en: 'Home Appliances' },

  // FOOTER
  { key: 'footer_fast_delivery', category: 'footer', vi: 'GIAO HÀNG', en: 'FAST DELIVERY' },
  { key: 'footer_delivery_desc', category: 'footer', vi: 'Giao hàng nhanh chóng trong nội thành', en: 'Fast & reliable urban delivery' },
  { key: 'footer_quality_assured', category: 'footer', vi: 'CHẤT LƯỢNG ĐẢM BẢO', en: 'QUALITY ASSURED' },
  { key: 'footer_quality_desc', category: 'footer', vi: 'Sản phẩm chính hãng', en: '100% genuine guaranteed products' },
  { key: 'footer_vat_invoices', category: 'footer', vi: 'HOÁ ĐƠN ĐẦY ĐỦ', en: 'VAT INVOICES' },
  { key: 'footer_vat_desc', category: 'footer', vi: 'Hỗ trợ xuất hóa đơn VAT cho mọi đơn hàng', en: 'Supports official VAT e-invoicing for all orders' },
  { key: 'footer_webshop_desc', category: 'footer', vi: 'Hệ thống webshop mang lại trải nghiệm mua sắm nhanh chóng, chính xác.', en: 'Modern e-commerce platform integrated directly with enterprise ERPACC SaaS.' },
  { key: 'footer_contact_us', category: 'footer', vi: 'LIÊN HỆ VỚI CHÚNG TÔI', en: 'CONTACT US' },
  { key: 'footer_address', category: 'footer', vi: 'Đường Số 0102, Quận 1, TP. Hồ Chí Minh', en: 'District 1, Ho Chi Minh City, Vietnam' },
  { key: 'footer_support_policies', category: 'footer', vi: 'CHÍNH SÁCH HỖ TRỢ', en: 'SUPPORT POLICIES' },
  { key: 'footer_shopping_guide', category: 'footer', vi: 'Hướng dẫn mua hàng', en: 'Shopping Guide' },
  { key: 'footer_shipping_policy', category: 'footer', vi: 'Chính sách vận chuyển & giao nhận', en: 'Shipping & Delivery Policy' },
  { key: 'footer_payment_methods', category: 'footer', vi: 'Phương thức thanh toán bảo mật', en: 'Secure Payment Methods' },
  { key: 'footer_privacy_policy', category: 'footer', vi: 'Chính sách bảo mật thông tin khách hàng', en: 'Privacy Policy' },
  { key: 'footer_copyright', category: 'footer', vi: '© 2026 WebShop. Tất cả quyền được bảo lưu.', en: '© 2026 WebShop. All rights reserved.' },
  
  // USER MANAGEMENT & RBAC MATRIX
  { key: 'users_rbac', category: 'saas', vi: 'Người Dùng & Phân Quyền Matrix', en: 'Users & RBAC Matrix' },
  { key: 'rbac_matrix_title', category: 'saas', vi: 'Ma Trận Cấp Quyền Vai Trò (RBAC Matrix)', en: 'Role-Based Access Control Matrix' },
  { key: 'add_user_account', category: 'saas', vi: 'Thêm Tài Khoản Mới', en: 'Add New User Account' },
  { key: 'create_custom_role', category: 'saas', vi: 'Thêm Vai Trò Tùy Chỉnh', en: 'Create Custom Role' },

  // COMMON
  { key: 'app_title', category: 'common', vi: 'Hệ Thống ERPACC & Webshop', en: 'ERPACC & Webshop System' },
  { key: 'search_placeholder', category: 'common', vi: 'Tìm kiếm dữ liệu...', en: 'Search data...' },
  { key: 'actions', category: 'common', vi: 'Thao tác', en: 'Actions' },
  { key: 'status', category: 'common', vi: 'Trạng thái', en: 'Status' },
  { key: 'save', category: 'common', vi: 'Lưu thay đổi', en: 'Save Changes' },
  { key: 'cancel', category: 'common', vi: 'Hủy bỏ', en: 'Cancel' },
  { key: 'delete', category: 'common', vi: 'Xóa', en: 'Delete' },
  { key: 'edit', category: 'common', vi: 'Chỉnh sửa', en: 'Edit' },
  { key: 'add_new', category: 'common', vi: 'Thêm mới', en: 'Add New' },
  { key: 'export_excel', category: 'common', vi: 'Xuất Excel', en: 'Export Excel' },
  { key: 'import_excel', category: 'common', vi: 'Nhập từ Excel', en: 'Import Excel' },
  { key: 'print_pdf', category: 'common', vi: 'In phiếu PDF', en: 'Print PDF' },
  { key: 'filter', category: 'common', vi: 'Bộ lọc', en: 'Filter' },
  { key: 'refresh', category: 'common', vi: 'Tải lại', en: 'Refresh' },
  { key: 'notes', category: 'common', vi: 'Ghi chú', en: 'Notes' },
  { key: 'date', category: 'common', vi: 'Ngày tháng', en: 'Date' },
  { key: 'total_amount', category: 'common', vi: 'Tổng tiền', en: 'Total Amount' },
  
  // MENU
  { key: 'menu_dashboard', category: 'menu', vi: 'Tổng quan (Dashboard)', en: 'Dashboard Overview' },
  { key: 'menu_quotations', category: 'menu', vi: 'Báo giá khách hàng', en: 'Customer Quotations' },
  { key: 'menu_sales_orders', category: 'menu', vi: 'Đơn hàng bán', en: 'Sales Orders' },
  { key: 'menu_web_orders', category: 'menu', vi: 'Đơn hàng WebShop', en: 'WebShop Orders' },
  { key: 'menu_customers', category: 'menu', vi: 'Quản lý Khách hàng', en: 'Customer Management' },
  { key: 'menu_suppliers', category: 'menu', vi: 'Nhà cung cấp', en: 'Suppliers' },
  { key: 'menu_products', category: 'menu', vi: 'Sản phẩm & Hàng hóa', en: 'Products & Items' },
  { key: 'menu_categories_uom', category: 'menu', vi: 'Danh mục & Đơn vị tính', en: 'Categories & UOM' },
  { key: 'menu_inventory', category: 'menu', vi: 'Quản lý kho hàng', en: 'Warehouse Inventory' },
  { key: 'menu_warehouses', category: 'menu', vi: 'Địa điểm Kho bãi', en: 'Warehouse Locations' },
  { key: 'menu_stock_in', category: 'menu', vi: 'Nhập kho (Stock In)', en: 'Stock In Receipt' },
  { key: 'menu_stock_out', category: 'menu', vi: 'Xuất kho (Stock Out)', en: 'Stock Out Issue' },
  { key: 'menu_stocktaking', category: 'menu', vi: 'Kiểm kê Kho & Lệch kho', en: 'Stocktaking & Discrepancies' },
  { key: 'menu_finance_invoices', category: 'menu', vi: 'Hóa đơn & Thu chi', en: 'Invoices & Cashbook' },
  { key: 'menu_debt', category: 'menu', vi: 'Sổ Công nợ & Thu chi', en: 'Debts & Cash Flow' },
  { key: 'menu_vat', category: 'menu', vi: 'Kê Khai Thuế GTGT (VAT)', en: 'VAT Tax Filings' },
  { key: 'menu_accounting', category: 'menu', vi: 'Hệ Thống Kế Toán (TT200)', en: 'Accounting Ledger (TT200)' },
  { key: 'menu_reports', category: 'menu', vi: 'Báo cáo & Phân tích', en: 'Reports & Analytics' },
  { key: 'menu_settings', category: 'menu', vi: 'Cài đặt Hệ thống', en: 'System Settings' },
  { key: 'menu_translations', category: 'menu', vi: 'Quản lý Dịch thuật System', en: 'System Translations' },

  // DASHBOARD
  { key: 'dash_revenue', category: 'dashboard', vi: 'Tổng doanh thu', en: 'Total Revenue' },
  { key: 'dash_orders', category: 'dashboard', vi: 'Tổng số đơn hàng', en: 'Total Orders' },
  { key: 'dash_debt', category: 'dashboard', vi: 'Tổng công nợ phải thu', en: 'Total Accounts Receivable' },
  { key: 'dash_low_stock', category: 'dashboard', vi: 'Cảnh báo sắp hết hàng', en: 'Low Stock Alert' },

  // PRODUCTS & INVENTORY
  { key: 'sku', category: 'products', vi: 'Mã hàng (SKU)', en: 'Item SKU' },
  { key: 'product_name', category: 'products', vi: 'Tên hàng hóa / sản phẩm', en: 'Product Name' },
  { key: 'category', category: 'products', vi: 'Danh mục', en: 'Category' },
  { key: 'uom', category: 'products', vi: 'Đơn vị tính', en: 'Unit of Measure (UOM)' },
  { key: 'cost_price', category: 'products', vi: 'Giá vốn', en: 'Cost Price' },
  { key: 'selling_price', category: 'products', vi: 'Giá bán niêm yết', en: 'Selling Price' },
  { key: 'web_price', category: 'products', vi: 'Giá bán WebShop', en: 'WebShop Price' },
  { key: 'stock_quantity', category: 'products', vi: 'Số lượng tồn kho', en: 'Stock Quantity' },
  { key: 'min_stock', category: 'products', vi: 'Tồn kho tối thiểu', en: 'Min Stock Level' },

  // FINANCE & ACCOUNTING
  { key: 'invoice_no', category: 'finance', vi: 'Số hóa đơn', en: 'Invoice Number' },
  { key: 'payment_status', category: 'finance', vi: 'Trạng thái thanh toán', en: 'Payment Status' },
  { key: 'paid', category: 'finance', vi: 'Đã thanh toán', en: 'Paid' },
  { key: 'unpaid', category: 'finance', vi: 'Chưa thanh toán', en: 'Unpaid' },
  { key: 'partial_paid', category: 'finance', vi: 'Thanh toán một phần', en: 'Partially Paid' },
  { key: 'vat_amount', category: 'finance', vi: 'Tiền thuế GTGT', en: 'VAT Amount' },
  { key: 'chart_account', category: 'accounting', vi: 'Tài khoản kế toán (TT200)', en: 'Account Code (TT200)' },
  { key: 'debit', category: 'accounting', vi: 'Ghi Nợ (Debit)', en: 'Debit' },
  { key: 'credit', category: 'accounting', vi: 'Ghi Có (Credit)', en: 'Credit' },
];

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language') as Language;
    return saved === 'en' ? 'en' : 'vi';
  });

  const [translationsList, setTranslationsList] = useState<TranslationItem[]>(() => {
    const saved = localStorage.getItem('saas_translation_dictionary');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Error parsing stored translations', e);
      }
    }
    return initialTranslationItems;
  });

  const [activeDictionary, setActiveDictionary] = useState<Record<string, string>>({});

  // Rebuild dictionary object based on selected language
  const buildDictionary = useCallback((list: TranslationItem[], lang: Language) => {
    const dict: Record<string, string> = {};
    list.forEach((item) => {
      dict[item.key] = lang === 'en' ? (item.en || item.vi) : (item.vi || item.en);
    });
    return dict;
  }, []);

  const refreshTranslations = useCallback(async () => {
    try {
      const res = await fetch(`/api/saas/translations/all`);
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.data) && data.data.length > 0) {
          setTranslationsList(data.data);
          localStorage.setItem('saas_translation_dictionary', JSON.stringify(data.data));
          localStorage.setItem('saas_translation_dictionary_updated_at', String(Date.now()));
        }
      }
    } catch (e) {
      // Fallback to local state if offline/server error
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_language', language);
    setActiveDictionary(buildDictionary(translationsList, language));
  }, [language, translationsList, buildDictionary]);

  useEffect(() => {
    // Storefront visitors can use the bundled/local dictionary immediately.
    // Loading the entire ERP translation table on every visit was unnecessary.
    if (!window.location.pathname.startsWith('/saas')) return;

    const refreshedAt = Number(localStorage.getItem('saas_translation_dictionary_updated_at') || 0);
    if (Date.now() - refreshedAt < 60 * 60 * 1000) return;
    refreshTranslations();
  }, [refreshTranslations]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === 'vi' ? 'en' : 'vi'));
  };

  const t = (key: string, defaultText?: string): string => {
    return activeDictionary[key] || defaultText || key;
  };

  const updateTranslation = async (key: string, vi: string, en: string, category: string = 'common') => {
    const existingIndex = translationsList.findIndex((item) => item.key === key);
    let updated: TranslationItem[];

    if (existingIndex >= 0) {
      updated = [...translationsList];
      updated[existingIndex] = { ...updated[existingIndex], vi, en, category };
    } else {
      updated = [{ key, category, vi, en, isCustom: true }, ...translationsList];
    }

    setTranslationsList(updated);
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(updated));

    // Also persist to API if available
    try {
      await fetch('/api/saas/translations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, category, vi, en }),
      });
    } catch (e) {
      // Fallback saved locally
    }
  };

  const deleteTranslation = async (key: string) => {
    const updated = translationsList.filter((item) => item.key !== key);
    setTranslationsList(updated);
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(updated));

    try {
      await fetch(`/api/saas/translations/${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      // Fallback deleted locally
    }
  };

  const resetToDefaults = () => {
    setTranslationsList(initialTranslationItems);
    localStorage.setItem('saas_translation_dictionary', JSON.stringify(initialTranslationItems));
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        translationsList,
        updateTranslation,
        deleteTranslation,
        resetToDefaults,
        refreshTranslations,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
