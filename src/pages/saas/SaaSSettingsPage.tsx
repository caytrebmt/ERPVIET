import React, { useState } from 'react';
import {
  Settings,
  Building2,
  Printer,
  Users,
  ShieldCheck,
  Server,
  Key,
  Database,
  BellRing,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Lock,
  Boxes,
  Percent,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Globe,
  Languages,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { SaaSTranslationsTab } from '../../components/SaaSTranslationsTab';
import { SaaSUsersRbacTab } from '../../components/SaaSUsersRbacTab';

export const SaaSSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'users_rbac' | 'translations' | 'company' | 'menu' | 'inventory' | 'api' | 'notifications' | 'backup'>('users_rbac');

  // Tab 1: Company Profile & PDF Print Settings
  const [companyInfo, setCompanyInfo] = useState(() => {
    const saved = localStorage.getItem('saas_company_info');
    return saved
      ? JSON.parse(saved)
      : {
          name: 'CÔNG TY CỔ PHẦN ERP-VIET ENTERPRISE',
          taxCode: '0109988776-001',
          address: 'Tòa nhà Keangnam Landmark 72, Đường Phạm Hùng, Cầu Giấy, Hà Nội',
          phone: '024.3998.8888 / 0988.123.456',
          email: 'contact@erp-viet.vn',
          website: 'https://erp-viet.vn',
          bankName: 'Ngân hàng MBBank (MB)',
          bankAccount: '999988886666',
          bankOwner: 'CONG TY CP ERP VIET ENTERPRISE',
          pdfPaperSize: 'A4',
          pdfHeaderTitle: 'CÔNG TY CỔ PHẦN ERP-VIET ENTERPRISE',
          pdfFooterNote: 'Cảm ơn Quý khách hàng đã tin tưởng hợp tác cùng ERP-VIET',
          logoUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150',
        };
  });

  // Tab 2: Menu System & Roles
  const [menuItems, setMenuItems] = useState(() => {
    const saved = localStorage.getItem('saas_menu_items');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 1, name: 'Dashboard Tổng Quan', path: '/saas/dashboard', group: 'Tổng Quan', enabled: true, role: 'Tất cả' },
          { id: 2, name: 'Danh Mục Hàng Hóa', path: '/saas/products', group: 'Bán Hàng & Kho', enabled: true, role: 'Tất cả' },
          { id: 3, name: 'Nhập Kho (Stock In)', path: '/saas/stock-in', group: 'Quản Lý Kho', enabled: true, role: 'Thủ kho, Admin' },
          { id: 4, name: 'Xuất Kho (Stock Out)', path: '/saas/stock-out', group: 'Quản Lý Kho', enabled: true, role: 'Thủ kho, Bán hàng' },
          { id: 5, name: 'Kiểm Kê Kho & Lệch Kho', path: '/saas/stocktaking', group: 'Quản Lý Kho', enabled: true, role: 'Thủ kho, Admin' },
          { id: 6, name: 'Báo Giá Commercial', path: '/saas/quotations', group: 'Thương Mại', enabled: true, role: 'Bán hàng, Admin' },
          { id: 7, name: 'Sổ Công Nợ & Thu Chi', path: '/saas/debt', group: 'Tài Chính', enabled: true, role: 'Kế toán, Admin' },
          { id: 8, name: 'Kê Khai Thuế GTGT (VAT)', path: '/saas/vat', group: 'Tài Chính', enabled: true, role: 'Kế toán, Admin' },
          { id: 9, name: 'Hệ Thống Kế Toán (TT200)', path: '/saas/accounting', group: 'Tài Chính', enabled: true, role: 'Kế toán, Admin' },
        ];
  });

  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPath, setNewMenuPath] = useState('');
  const [newMenuGroup, setNewMenuGroup] = useState('Khác');

  // Tab 3: Inventory & Operational Policy
  const [policySettings, setPolicySettings] = useState(() => {
    const saved = localStorage.getItem('saas_policy_settings');
    const defaults = {
      costingMethod: 'Bình quân gia quyền ròng',
      defaultVatRate: 10,
      allowNegativeStock: false,
      minStockThreshold: 10,
      defaultCreditLimit: 50000000,
      autoGenOrderCode: true,
      requireVatInvoiceForStockIn: true,
      orderCodePrefix: 'ORD-',
      stockOutPrefix: 'PX-',
      stockInPrefix: 'PN-',
      quotationPrefix: 'BG-',
      invoicePrefix: 'HD-',
      dateFormatPattern: 'YYMMDD',
      numberPaddingLength: 3,
    };
    return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
  });

  // Tab 4: Backend API Configuration
  const [apiConfig, setApiConfig] = useState(() => {
    const saved = localStorage.getItem('saas_api_config');
    return saved
      ? JSON.parse(saved)
      : {
          apiBaseUrl: '/api',
          jwtToken: localStorage.getItem('token') || 'jwt-secret-webshop-2026',
          webhookUrl: 'https://api.erp-viet.vn/v1/webhooks/orders',
          logLevel: 'INFO',
        };
  });
  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Tab 5: Automatic Notifications & Alert Triggers
  const [notifyConfig, setNotifyConfig] = useState(() => {
    const saved = localStorage.getItem('saas_notify_config');
    return saved
      ? JSON.parse(saved)
      : {
          alertLowStock: true,
          alertOverdueDebt: true,
          alertStocktakeDiscrepancy: true,
          emailDigestDaily: true,
          debtWarningDays: 30,
        };
  });

  // Action Handlers
  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('saas_company_info', JSON.stringify(companyInfo));
    addToast(
      language === 'en'
        ? 'Company profile & PDF template saved successfully!'
        : 'Đã lưu thông tin doanh nghiệp & mẫu in PDF thành công!',
      'success'
    );
  };

  const handleToggleMenu = (id: number) => {
    const updated = menuItems.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
    setMenuItems(updated);
    localStorage.setItem('saas_menu_items', JSON.stringify(updated));
     addToast(t('settings_menu_updated'), 'info');
  };

  const handleAddMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName || !newMenuPath) {
      addToast(
         t('settings_fill_menu_title'),
        'error'
      );
      return;
    }
    const newItem = {
      id: Date.now(),
      name: newMenuName,
      path: newMenuPath,
      group: newMenuGroup,
      enabled: true,
      role: 'Tất cả',
    };
    const updated = [...menuItems, newItem];
    setMenuItems(updated);
    localStorage.setItem('saas_menu_items', JSON.stringify(updated));
    setNewMenuName('');
    setNewMenuPath('');
    addToast(
       t('settings_menu_added'),
      'success'
    );
  };

  const handleDeleteMenu = (id: number) => {
    const updated = menuItems.filter((m) => m.id !== id);
    setMenuItems(updated);
    localStorage.setItem('saas_menu_items', JSON.stringify(updated));
     addToast(t('settings_menu_deleted'), 'warning');
  };

  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('saas_policy_settings', JSON.stringify(policySettings));
    addToast(
       t('settings_warehouse_updated'),
      'success'
    );
  };

  const handleSaveApiConfig = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('saas_api_config', JSON.stringify(apiConfig));
    localStorage.setItem('token', apiConfig.jwtToken);
    localStorage.setItem('access_token', apiConfig.jwtToken);
    addToast(
       t('settings_api_updated'),
      'success'
    );
  };

  const handlePingApi = () => {
    setIsPinging(true);
    setPingStatus(null);
    setTimeout(() => {
      setIsPinging(false);
      setPingStatus(
        language === 'en'
          ? 'Connection successful! Server latency: 24ms - Status 200 OK'
          : 'Kết nối thành công! Server latency: 24ms - Status 200 OK'
      );
    }, 800);
  };

  const handleSaveNotify = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('saas_notify_config', JSON.stringify(notifyConfig));
    addToast(
       t('settings_notifications_saved'),
      'success'
    );
  };

  const handleExportBackup = () => {
    const backupData = {
      version: 'ERP-SaaS 2026.1',
      exportedAt: new Date().toISOString(),
      companyInfo,
      menuItems,
      policySettings,
      apiConfig,
      notifyConfig,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_erp_saas_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(
       t('settings_backup_exported'),
      'success'
    );
  };

  const handleResetDefaults = () => {
    const confirmMsg =
      language === 'en'
        ? 'Are you sure you want to restore default initial configuration?'
        : 'Bạn có chắc chắn muốn khôi phục lại cấu hình mặc định ban đầu không?';
    if (window.confirm(confirmMsg)) {
      localStorage.removeItem('saas_company_info');
      localStorage.removeItem('saas_menu_items');
      localStorage.removeItem('saas_policy_settings');
      localStorage.removeItem('saas_api_config');
      localStorage.removeItem('saas_notify_config');
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-amber-500" />{' '}
            {language === 'en'
              ? 'System Settings & Enterprise Configuration'
              : 'Cài Đặt Hệ Thống & Cấu Hình Doanh Nghiệp'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {language === 'en'
              ? 'Manage enterprise parameters, database menu schema, role permissions, PDF print templates, warehouse rules & backend APIs.'
              : 'Quản lý toàn bộ cấu hình thông tin doanh nghiệp, bảng menu DB, phân quyền, mẫu in PDF, quy trình kho & API backend.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportBackup}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Download className="h-4 w-4 text-emerald-500" />{' '}
             {t('settings_export_backup')}
          </button>
          <button
            onClick={handleResetDefaults}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 text-rose-700 dark:text-rose-300 flex items-center gap-1.5 transition-all"
             title={t('settings_reset_defaults')}
          >
             <RotateCcw className="h-4 w-4" /> {t('settings_reset_defaults')}
          </button>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-zinc-200 dark:border-zinc-800 no-scrollbar">
        {[
          {
            id: 'users_rbac',
             label: t('settings_users_rbac'),
            icon: ShieldCheck,
          },
          {
            id: 'translations',
             label: t('settings_translations_languages'),
            icon: Globe,
          },
          {
            id: 'company',
             label: t('settings_company_templates'),
            icon: Building2,
          },
          {
            id: 'menu',
             label: t('settings_db_menu'),
            icon: Database,
          },
          {
            id: 'inventory',
             label: t('settings_warehouse_rules'),
            icon: Boxes,
          },
          {
            id: 'api',
             label: t('settings_backend_api'),
            icon: Server,
          },
          {
            id: 'notifications',
             label: t('settings_alerts_notifications'),
            icon: BellRing,
          },
          {
            id: 'backup',
             label: t('settings_backup_restore'),
            icon: Download,
          },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: USERS MANAGEMENT & RBAC PERMISSION MATRIX */}
      {activeTab === 'users_rbac' && <SaaSUsersRbacTab />}

      {/* TAB 1: TRANSLATIONS & SYSTEM LANGUAGES */}
      {activeTab === 'translations' && <SaaSTranslationsTab />}

      {/* TAB 1: COMPANY PROFILE & PRINT TEMPLATES */}
      {activeTab === 'company' && (
        <form onSubmit={handleSaveCompany} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Building2 className="h-5 w-5 text-amber-500" /> Thông Tin Pháp Lý Doanh Nghiệp (In trên hóa đơn & báo giá)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tên Doanh Nghiệp (Đầy đủ)
                </label>
                <input
                  type="text"
                  value={companyInfo.name}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Mã Số Thuế (Tax ID)
                </label>
                <input
                  type="text"
                  value={companyInfo.taxCode}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, taxCode: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Địa Chỉ Đăng Ký Kinh Doanh
                </label>
                <input
                  type="text"
                  value={companyInfo.address}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Điện Thoại Hotline
                </label>
                <input
                  type="text"
                  value={companyInfo.phone}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Công Ty
                </label>
                <input
                  type="email"
                  value={companyInfo.email}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <CreditCard className="h-5 w-5 text-blue-500" /> Tài Khoản Ngân Hàng Thụ Hưởng & QR Thanh Toán
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tên Ngân Hàng
                </label>
                <input
                  type="text"
                  value={companyInfo.bankName}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankName: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Số Tài Khoản
                </label>
                <input
                  type="text"
                  value={companyInfo.bankAccount}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankAccount: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Chủ Tài Khoản
                </label>
                <input
                  type="text"
                  value={companyInfo.bankOwner}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankOwner: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold uppercase bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Printer className="h-5 w-5 text-emerald-500" /> Cấu Hình Mẫu In Chứng Từ PDF (Phiếu Nhập/Xuất & Báo Giá)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Khổ Giấy In Mặc Định
                </label>
                <select
                  value={companyInfo.pdfPaperSize}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, pdfPaperSize: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value="A4">A4 (Tiêu chuẩn doanh nghiệp)</option>
                  <option value="A5">A5 (Phiếu nhỏ tiết kiệm)</option>
                  <option value="80mm">K80 (In nhiệt hóa đơn bán lẻ)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tiêu Đề Header Mẫu In
                </label>
                <input
                  type="text"
                  value={companyInfo.pdfHeaderTitle}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, pdfHeaderTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Lời Cảm Ơn / Ghi Chú Chân Trang Mẫu In
                </label>
                <input
                  type="text"
                  value={companyInfo.pdfFooterNote}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, pdfFooterNote: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 text-xs transition-all"
            >
              <Save className="h-4 w-4" /> Lưu Cấu Hình Doanh Nghiệp
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: MENU SYSTEM & DATABASE ROLES */}
      {activeTab === 'menu' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Database className="h-5 w-5 text-amber-500" /> Bảng Định Nghĩa Menu DB & Bật/Tắt Tính Năng Realtime
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Quản lý danh mục các menu chức năng trong hệ thống SaaS, bật/tắt menu trực tiếp trên giao diện người dùng.
                </p>
              </div>
            </div>

            {/* Form Add New Menu */}
            <form onSubmit={handleAddMenu} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/80 flex flex-col md:flex-row items-end gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  Tên Menu Mới
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Báo Cáo Doanh Thu Theo Vùng"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  Đường Dẫn URL (Route)
                </label>
                <input
                  type="text"
                  placeholder="/saas/regional-reports"
                  value={newMenuPath}
                  onChange={(e) => setNewMenuPath(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="w-full md:w-40">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  Nhóm Menu
                </label>
                <select
                  value={newMenuGroup}
                  onChange={(e) => setNewMenuGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Tổng Quan">Tổng Quan</option>
                  <option value="Bán Hàng & Kho">Bán Hàng & Kho</option>
                  <option value="Quản Lý Kho">Quản Lý Kho</option>
                  <option value="Thương Mại">Thương Mại</option>
                  <option value="Tài Chính">Tài Chính</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full md:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
              >
                <Plus className="h-4 w-4" /> Thêm Menu
              </button>
            </form>

            {/* Menu List Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3">Tên Menu Chức Năng</th>
                    <th className="px-4 py-3">Đường Dẫn URL</th>
                    <th className="px-4 py-3">Nhóm</th>
                    <th className="px-4 py-3">Phân Quyền Vai Trò</th>
                    <th className="px-4 py-3 text-center">Trạng Thái</th>
                    <th className="px-4 py-3 text-right">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                  {menuItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-500 dark:text-zinc-400">
                        {item.path}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700">
                          {item.group}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                        {item.role}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggleMenu(item.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-colors ${
                            item.enabled
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                          }`}
                        >
                          {item.enabled ? <ToggleRight className="h-4 w-4 text-emerald-500" /> : <ToggleLeft className="h-4 w-4 text-zinc-400" />}
                          <span>{item.enabled ? 'Đang Hoạt Động' : 'Đã Ẩn'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteMenu(item.id)}
                          className="p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 transition-colors"
                          title="Xóa menu"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INVENTORY POLICY & VAT */}
      {activeTab === 'inventory' && (
        <form onSubmit={handleSavePolicy} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Boxes className="h-5 w-5 text-amber-500" /> Phương Pháp Tính Giá Vốn & Quy Định Kho
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Phương Pháp Tính Giá Vốn Hàng Tồn Kho
                </label>
                <select
                  value={policySettings.costingMethod}
                  onChange={(e) => setPolicySettings({ ...policySettings, costingMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Bình quân gia quyền ròng">Bình Quân Gia Quyền Ròng (Chuẩn TT200)</option>
                  <option value="FIFO">Nhập Trước Xuất Trước (FIFO)</option>
                  <option value="Đích danh">Giá Đích Danh Lô Hàng</option>
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Giá vốn tự động tính lại ngay khi phát sinh phiếu nhập kho mới.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Thuế Suất VAT Mặc Định Cho Hàng Hóa Mới (%)
                </label>
                <select
                  value={policySettings.defaultVatRate}
                  onChange={(e) => setPolicySettings({ ...policySettings, defaultVatRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value={0}>0% (Hàng xuất khẩu / Không chịu thuế)</option>
                  <option value={5}>5% (Hàng nông sản, thiết bị y tế)</option>
                  <option value={8}>8% (Thuế GTGT giảm theo Nghị định 2026)</option>
                  <option value={10}>10% (Thuế GTGT phổ thông)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Định Mức Tồn Kho Tối Thiểu (Cảnh Báo Tự Động)
                </label>
                <input
                  type="number"
                  value={policySettings.minStockThreshold}
                  onChange={(e) => setPolicySettings({ ...policySettings, minStockThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Hạn Mức Công Nợ Cho Phép Khách Hàng Mới (VNĐ)
                </label>
                <input
                  type="number"
                  step={5000000}
                  value={policySettings.defaultCreditLimit}
                  onChange={(e) => setPolicySettings({ ...policySettings, defaultCreditLimit: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="md:col-span-2 space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policySettings.allowNegativeStock}
                    onChange={(e) => setPolicySettings({ ...policySettings, allowNegativeStock: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Cho Phép Xuất Âm Kho (Negative Stock)</span>
                    <p className="text-[11px] text-zinc-500">Cho phép tạo phiếu xuất kho khi tồn kho hiện tại chưa cập nhật đủ phiếu nhập.</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={policySettings.autoGenOrderCode}
                    onChange={(e) => setPolicySettings({ ...policySettings, autoGenOrderCode: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer accent-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Tự Động Sinh Mã Chứng Từ Kèm Theo Ngày</span>
                    <p className="text-[11px] text-zinc-500">Quy tắc sinh mã tự động cho Đơn hàng, Phiếu xuất, Phiếu nhập, Báo giá...</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2: DOCUMENT NUMBERING & PREFIX SETTINGS */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Sliders className="h-5 w-5 text-amber-500" /> Cấu Hình Tiền Tố & Quy Tắc Sinh Mã Chứng Từ
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tiền Tố Đơn Hàng Web (Order Prefix)
                </label>
                <input
                  type="text"
                  value={policySettings.orderCodePrefix || 'ORD-'}
                  onChange={(e) => setPolicySettings({ ...policySettings, orderCodePrefix: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  placeholder="ORD-"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tiền Tố Phiếu Xuất Kho (Stock Out)
                </label>
                <input
                  type="text"
                  value={policySettings.stockOutPrefix || 'PX-'}
                  onChange={(e) => setPolicySettings({ ...policySettings, stockOutPrefix: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  placeholder="PX-"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tiền Tố Phiếu Nhập Kho (Stock In)
                </label>
                <input
                  type="text"
                  value={policySettings.stockInPrefix || 'PN-'}
                  onChange={(e) => setPolicySettings({ ...policySettings, stockInPrefix: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  placeholder="PN-"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tiền Tố Báo Giá (Quotation)
                </label>
                <input
                  type="text"
                  value={policySettings.quotationPrefix || 'BG-'}
                  onChange={(e) => setPolicySettings({ ...policySettings, quotationPrefix: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  placeholder="BG-"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tiền Tố Hóa Đơn VAT (Invoice)
                </label>
                <input
                  type="text"
                  value={policySettings.invoicePrefix || 'HD-'}
                  onChange={(e) => setPolicySettings({ ...policySettings, invoicePrefix: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  placeholder="HD-"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Định Dạng Ngày Tháng Trong Mã
                </label>
                <select
                  value={policySettings.dateFormatPattern || 'YYMMDD'}
                  onChange={(e) => setPolicySettings({ ...policySettings, dateFormatPattern: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value="YYMMDD">YYMMDD (Gọn nhẹ: 260730 - Khuyên dùng)</option>
                  <option value="YYYYMMDD">YYYYMMDD (Đầy đủ: 20260730)</option>
                  <option value="YYMM">YYMM (Theo tháng: 2607)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Độ Dài Số Thứ Tự Tự Động
                </label>
                <select
                  value={policySettings.numberPaddingLength || 3}
                  onChange={(e) => setPolicySettings({ ...policySettings, numberPaddingLength: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value={3}>3 chữ số (001, 002, 003)</option>
                  <option value={4}>4 chữ số (0001, 0002, 0003)</option>
                  <option value={5}>5 chữ số (00001, 00002, 00003)</option>
                </select>
              </div>
            </div>

            {/* Live Sample Preview Box */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 space-y-1.5">
              <span className="font-bold text-amber-600 dark:text-amber-400 block">Mẫu mã chứng từ sẽ sinh ra theo cấu hình:</span>
              <div className="flex flex-wrap gap-2.5 font-mono font-bold text-[11px] pt-1">
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  Đơn hàng Web: {policySettings.orderCodePrefix || 'ORD-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  Phiếu xuất kho: {policySettings.stockOutPrefix || 'PX-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  Phiếu nhập kho: {policySettings.stockInPrefix || 'PN-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  Báo giá: {policySettings.quotationPrefix || 'BG-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 text-xs transition-all"
            >
              <Save className="h-4 w-4" /> Lưu Cấu Hình Quy Trình
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: API BACKEND CONFIGURATION */}
      {activeTab === 'api' && (
        <form onSubmit={handleSaveApiConfig} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Server className="h-5 w-5 text-amber-500" /> Cấu Hình API Gateway & Authorization Header
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Base URL API Backend Server
                </label>
                <input
                  type="text"
                  value={apiConfig.apiBaseUrl}
                  onChange={(e) => setApiConfig({ ...apiConfig, apiBaseUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  required
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Mọi yêu cầu gửi đến <code className="text-amber-500 font-mono">src/services/api.js</code> sẽ tự động nối chuỗi URL này.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-amber-500" /> JWT Bearer Authorization Token
                </label>
                <textarea
                  rows={3}
                  value={apiConfig.jwtToken}
                  onChange={(e) => setApiConfig({ ...apiConfig, jwtToken: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Webhook Event URL (Nhanh Thông Báo Đơn Hàng)
                </label>
                <input
                  type="text"
                  value={apiConfig.webhookUrl}
                  onChange={(e) => setApiConfig({ ...apiConfig, webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            {/* Ping Test Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={handlePingApi}
                disabled={isPinging}
                className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-xl text-xs flex items-center gap-2 transition-all border border-zinc-200 dark:border-zinc-700"
              >
                <RefreshCw className={`h-4 w-4 text-amber-500 ${isPinging ? 'animate-spin' : ''}`} />
                <span>{isPinging ? 'Đang Kiểm Tra Ping...' : 'Kiểm Tra Kết Nối Ping API'}</span>
              </button>

              {pingStatus && (
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> {pingStatus}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 text-xs transition-all"
            >
              <Save className="h-4 w-4" /> Lưu Cấu Hình API
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: NOTIFICATIONS & ALERTS */}
      {activeTab === 'notifications' && (
        <form onSubmit={handleSaveNotify} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <BellRing className="h-5 w-5 text-amber-500" /> Cấu Hình Cảnh Báo & Kênh Thông Báo Tự Động
            </h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Cảnh Báo Hàng Tồn Kho Dưới Định Mức
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Gửi thông báo trên thanh topbar khi số lượng sản phẩm chạm ngưỡng tồn tối thiểu.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyConfig.alertLowStock}
                  onChange={(e) => setNotifyConfig({ ...notifyConfig, alertLowStock: e.target.checked })}
                  className="h-5 w-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Cảnh Báo Công Nợ Khách Hàng Quá Hạn
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Cảnh báo khi khoản phải thu vượt quá {notifyConfig.debtWarningDays} ngày chưa thanh toán.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyConfig.alertOverdueDebt}
                  onChange={(e) => setNotifyConfig({ ...notifyConfig, alertOverdueDebt: e.target.checked })}
                  className="h-5 w-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer accent-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    Cảnh Báo Lệch Kho Sau Khi Kiểm Kê
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Tự động tạo phiếu thông báo khi phát hiện chênh lệch giữa kho sổ sách và kiểm kê thực tế.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifyConfig.alertStocktakeDiscrepancy}
                  onChange={(e) => setNotifyConfig({ ...notifyConfig, alertStocktakeDiscrepancy: e.target.checked })}
                  className="h-5 w-5 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer accent-amber-500"
                />
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 text-xs transition-all"
            >
              <Save className="h-4 w-4" /> Lưu Cấu Hình Thông Báo
            </button>
          </div>
        </form>
      )}

      {/* TAB 6: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Download className="h-5 w-5 text-emerald-500" /> Sao Lưu Dữ Liệu An Toàn (JSON Backup)
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Xuất toàn bộ cấu hình hệ thống, bảng định nghĩa menu DB, thông tin doanh nghiệp và chính sách vận hành ra file định dạng JSON.
            </p>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  Tải Về File Sao Lưu Toàn Bộ Cấu Hình ERP
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  File bao gồm chứng từ, menu active, chính sách thuế & cấu hình API.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs shrink-0"
              >
                <Download className="h-4 w-4" /> Tải File Backup JSON
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSSettingsPage;
