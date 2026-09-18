import React, { useEffect, useState } from 'react';
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
  FileJson,
  ShoppingBag,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSaaSAuth } from '../../contexts/SaaSAuthContext';
import { SaaSTranslationsTab } from '../../components/SaaSTranslationsTab';
import { SaaSTranslationsJsonTab } from '../../components/SaaSTranslationsJsonTab';
import { SaaSUsersRbacTab } from '../../components/SaaSUsersRbacTab';
import client from '../../api/client';

type SettingsTabId = 'users_rbac' | 'translations' | 'translations_json' | 'company' | 'menu' | 'inventory' | 'api' | 'notifications' | 'backup';

// Các tab thuộc quản trị NỀN TẢNG (dữ liệu dùng chung toàn hệ thống) — chỉ
// quản trị viên nền tảng (super admin) nhìn thấy. Admin của tenant (khách
// hàng doanh nghiệp) CHỈ thấy cấu hình của chính tenant mình:
//   - translations / translations_json : Dịch thuật dùng chung (sửa sai là
//     hỏng giao diện MỌI tenant → chỉ nền tảng được phép)
//   - menu                             : Cấu hình menu DB (sys_menus toàn hệ thống)
//   - api                              : Kết nối API Backend (hạ tầng nền tảng)
const SUPER_ADMIN_ONLY_TABS: SettingsTabId[] = ['translations', 'translations_json', 'menu', 'api'];
const DEFAULT_MENU_GROUP = 'Khác';

export const SaaSSettingsPage: React.FC = () => {
  const { addToast } = useToast();
  const { language, t } = useLanguage();
  const isEn = language === 'en';
  const { erpUser } = useSaaSAuth();
  const isSuperAdmin = !!erpUser?.is_super_admin;
  const canSeeTab = (tab: SettingsTabId) => isSuperAdmin || !SUPER_ADMIN_ONLY_TABS.includes(tab);
  const [activeTab, setActiveTab] = useState<SettingsTabId>('users_rbac');
  // Phòng chống deep-link/trạng thái cũ: tab nền tảng bị ẩn thì trả về tab
  // người dùng của tenant.
  const effectiveTab: SettingsTabId = canSeeTab(activeTab) ? activeTab : 'users_rbac';

  // Tab 1: Company Profile & PDF Print Settings. Values are loaded from the
  // current tenant; no browser-local copy is used as the source of truth.
  const [companyInfo, setCompanyInfo] = useState<any>({
    name: '', taxCode: '', address: '', phone: '', email: '', website: '',
    bankName: '', bankAccount: '', bankOwner: '', pdfPaperSize: 'A4',
    pdfHeaderTitle: '', pdfFooterNote: '', logoUrl: '', settings: {},
  });
  const [companyLoading, setCompanyLoading] = useState(true);


  // Tab 2: Menu System & Roles. The system menu is read from sys_menus.
  const [menuItems, setMenuItems] = useState<any[]>([]);


  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuPath, setNewMenuPath] = useState('');
  const [newMenuGroup, setNewMenuGroup] = useState(DEFAULT_MENU_GROUP);

  // Tab 3: Inventory & Operational Policy. Defaults are only placeholders
  // until the tenant settings response fills the form.
  const [policySettings, setPolicySettings] = useState<any>({
    costingMethod: '', defaultVatRate: 0, allowNegativeStock: false, minStockThreshold: 0,
    defaultCreditLimit: 0, autoGenOrderCode: false, requireVatInvoiceForStockIn: false,
    orderCodePrefix: '', stockOutPrefix: '', stockInPrefix: '', quotationPrefix: '', invoicePrefix: '',
    dateFormatPattern: '', numberPaddingLength: 0,
  });


  // Tab 4: Backend API Configuration. Never persist bearer tokens in settings.
  const [apiConfig, setApiConfig] = useState<any>({ apiBaseUrl: '/api', jwtToken: '', webhookUrl: '', logLevel: 'INFO' });

  const [pingStatus, setPingStatus] = useState<string | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Tab 5: Automatic Notifications & Alert Triggers.
  const [notifyConfig, setNotifyConfig] = useState<any>({ alertLowStock: false, alertOverdueDebt: false, alertStocktakeDiscrepancy: false, emailDigestDaily: false, debtWarningDays: 0 });


  useEffect(() => {
    client.get('/api/saas/tenants/me')
      .then((response) => {
        if (!response.data?.ok || !response.data.data) throw new Error(response.data?.message || 'Không tải được thông tin doanh nghiệp.');
        const data = response.data.data;
        const settings = data.settings || {};
        setCompanyInfo({
          ...data,
          name: data.name_vi || '', taxCode: data.tax_code || '', address: data.address || '',
          phone: data.phone || '', email: data.email || '', website: data.website || '',
          bankName: settings.bankName || '', bankAccount: settings.bankAccount || '', bankOwner: settings.bankOwner || '',
          pdfPaperSize: settings.pdfPaperSize || 'A4', pdfHeaderTitle: settings.pdfHeaderTitle || data.name_vi || '',
          pdfFooterNote: settings.pdfFooterNote || '', logoUrl: data.logo_url || '', settings,
        });
        if (settings.policy) setPolicySettings((current: any) => ({ ...current, ...settings.policy }));
        if (settings.notifications) setNotifyConfig((current: any) => ({ ...current, ...settings.notifications }));
        if (settings.api) setApiConfig((current: any) => ({ ...current, ...settings.api, jwtToken: '' }));
      })
      .catch((error: any) => addToast(error?.response?.data?.message || error.message || 'Không tải được thông tin doanh nghiệp.', 'error'))
      .finally(() => setCompanyLoading(false));
  }, []);

  // sys_menus là bảng menu TOÀN HỆ THỐNG — endpoint chỉ mở cho super admin.
  // Tenant không cần gọi (tab "Cấu hình menu" bị ẩn với tenant).
  useEffect(() => {
    if (!isSuperAdmin) return;
    client.get('/api/saas/menus')
      .then((response) => {
        if (!response.data?.ok) return;
        setMenuItems((response.data.data || []).map((item: any) => ({
          id: Number(item.id), name: item.title || '', path: item.path || '', group: 'Hệ thống', enabled: true, role: 'Tất cả',
        })));
      })
      .catch(() => undefined);
  }, [isSuperAdmin]);

  // Action Handlers
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.patch('/api/saas/tenants/me', {
        name_vi: companyInfo.name, tax_code: companyInfo.taxCode, address: companyInfo.address,
        phone: companyInfo.phone, email: companyInfo.email, website: companyInfo.website,
        settings: { ...(companyInfo.settings || {}), bankName: companyInfo.bankName, bankAccount: companyInfo.bankAccount, bankOwner: companyInfo.bankOwner, pdfPaperSize: companyInfo.pdfPaperSize, pdfHeaderTitle: companyInfo.pdfHeaderTitle, pdfFooterNote: companyInfo.pdfFooterNote, logoUrl: companyInfo.logoUrl },
      });
      addToast(t('da_luu_thong_tin_doanh', 'Đã lưu thông tin doanh nghiệp vào PostgreSQL!'), 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || error.message || 'Không thể lưu thông tin doanh nghiệp.', 'error'); }
  };

  const handleToggleMenu = (id: number) => {
    const updated = menuItems.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m));
    setMenuItems(updated);
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
     addToast(t('settings_menu_deleted'), 'warning');
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.patch('/api/saas/tenants/me', { settings: { ...(companyInfo.settings || {}), policy: policySettings } });
      setCompanyInfo((current: any) => ({ ...current, settings: { ...(current.settings || {}), policy: policySettings } }));
      addToast(t('settings_warehouse_updated'), 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể lưu quy trình kho.', 'error'); }
  };

  const handleSaveApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.patch('/api/saas/tenants/me', { settings: { ...(companyInfo.settings || {}), api: { apiBaseUrl: apiConfig.apiBaseUrl, webhookUrl: apiConfig.webhookUrl, logLevel: apiConfig.logLevel } } });
      setCompanyInfo((current: any) => ({ ...current, settings: { ...(current.settings || {}), api: { apiBaseUrl: apiConfig.apiBaseUrl, webhookUrl: apiConfig.webhookUrl, logLevel: apiConfig.logLevel } } }));
      addToast(t('settings_api_updated'), 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể lưu cấu hình API.', 'error'); }
  };

  const handlePingApi = async () => {
    setIsPinging(true);
    setPingStatus(null);
    const startedAt = performance.now();
    try {
      await client.get('/api/saas/tenants/me');
      setPingStatus(t('ket_noi_thanh_cong_do', 'Kết nối thành công. Độ trễ máy chủ: {{startedat}}ms', { startedat: Math.round(performance.now() - startedAt) }));
    } catch (error: any) {
      setPingStatus(error?.response?.data?.message || (t('ket_noi_that_bai_connection', 'Kết nối thất bại.')));
    } finally { setIsPinging(false); }
  };

  const handleSaveNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await client.patch('/api/saas/tenants/me', { settings: { ...(companyInfo.settings || {}), notifications: notifyConfig } });
      setCompanyInfo((current: any) => ({ ...current, settings: { ...(current.settings || {}), notifications: notifyConfig } }));
      addToast(t('settings_notifications_saved'), 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể lưu cấu hình thông báo.', 'error'); }
  };

  const handleExportBackup = () => {
    // Tenant chỉ được xuất dữ liệu của CHÍNH TENANT MÌNH: không kèm định
    // nghĩa menu toàn hệ thống (menuItems) hay cấu hình API nền tảng (apiConfig).
    const backupData = isSuperAdmin
      ? {
          version: 'ERP-SaaS 2026.1',
          exportedAt: new Date().toISOString(),
          companyInfo,
          menuItems,
          policySettings,
          apiConfig,
          notifyConfig,
        }
      : {
          version: 'ERP-SaaS 2026.1',
          exportedAt: new Date().toISOString(),
          companyInfo,
          policySettings,
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
      t('ban_co_chac_chan_muon', 'Bạn có chắc chắn muốn khôi phục lại cấu hình mặc định ban đầu không?');
    if (window.confirm(confirmMsg)) {
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Settings className="h-6 w-6 text-amber-500" />{' '}
            {t('cai_dat_he_thong_cau', 'Cài Đặt Hệ Thống & Cấu Hình Doanh Nghiệp')}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t('quan_ly_toan_bo_cau', 'Quản lý toàn bộ cấu hình thông tin doanh nghiệp, bảng menu DB, phân quyền, mẫu in PDF, quy trình kho & API backend.')}
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

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Sidebar Navigation */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-6">
            {/* Group 1: Quản Trị & Nhân Sự */}
            <div>
              <h3 className="px-3 text-[11px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                {t('saas_settings_quan_tri_nhan_su', 'Quản Trị & Nhân Sự')}
              </h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('users_rbac')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'users_rbac'
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {t('settings_users_rbac')}
                </button>
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => setActiveTab('translations')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        activeTab === 'translations'
                          ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <Globe className="h-4 w-4 shrink-0" />
                      {t('settings_translations_languages')}
                    </button>
                    <button
                      onClick={() => setActiveTab('translations_json')}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                        activeTab === 'translations_json'
                          ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      <FileJson className="h-4 w-4 shrink-0" />
                      {t('saas_settings_trinh_dich_thuat_json', 'Trình Dịch Thuật JSON')}
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Group 2: Hệ Thống & Doanh Nghiệp */}
            <div>
              <h3 className="px-3 text-[11px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                {t('saas_settings_he_thong_doanh_nghiep', 'Hệ Thống & Doanh Nghiệp')}
              </h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('company')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'company'
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  {t('settings_company_templates')}
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab('menu')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'menu'
                        ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Database className="h-4 w-4 shrink-0" />
                    {t('settings_db_menu')}
                  </button>
                )}
              </nav>
            </div>

            {/* Group 3: Nghiệp Vụ & Kết Nối */}
            <div>
              <h3 className="px-3 text-[11px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                {t('saas_settings_nghiep_vu_ket_noi', 'Nghiệp Vụ & Kết Nối')}
              </h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('inventory')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'inventory'
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Boxes className="h-4 w-4 shrink-0" />
                  {t('settings_warehouse_rules')}
                </button>
                {isSuperAdmin && (
                  <button
                    onClick={() => setActiveTab('api')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                      activeTab === 'api'
                        ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Server className="h-4 w-4 shrink-0" />
                    {t('settings_backend_api')}
                  </button>
                )}
              </nav>
            </div>

            {/* Group 4: Vận Hành & Dữ Liệu */}
            <div>
              <h3 className="px-3 text-[11px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
                {t('saas_settings_van_hanh_du_lieu', 'Vận Hành & Dữ Liệu')}
              </h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('notifications')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'notifications'
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <BellRing className="h-4 w-4 shrink-0" />
                  {t('settings_alerts_notifications')}
                </button>
                <button
                  onClick={() => setActiveTab('backup')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                    activeTab === 'backup'
                      ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Download className="h-4 w-4 shrink-0" />
                  {t('settings_backup_restore')}
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown */}
        <div className="lg:hidden">
          <select
            value={effectiveTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
            className="w-full px-3 py-2.5 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 cursor-pointer"
          >
            <optgroup label={t('saas_settings_quan_tri_nhan_su', 'Quản Trị & Nhân Sự')}>
              <option value="users_rbac">{t('settings_users_rbac')}</option>
              {isSuperAdmin && (
                <>
                  <option value="translations">{t('settings_translations_languages')}</option>
                  <option value="translations_json">{t('saas_settings_trinh_dich_thuat_json', 'Trình Dịch Thuật JSON')}</option>
                </>
              )}
            </optgroup>
            <optgroup label={t('saas_settings_he_thong_doanh_nghiep', 'Hệ Thống & Doanh Nghiệp')}>
              <option value="company">{t('settings_company_templates')}</option>
              {isSuperAdmin && <option value="menu">{t('settings_db_menu')}</option>}
            </optgroup>
            <optgroup label={t('saas_settings_nghiep_vu_ket_noi', 'Nghiệp Vụ & Kết Nối')}>
              <option value="inventory">{t('settings_warehouse_rules')}</option>
              {isSuperAdmin && <option value="api">{t('settings_backend_api')}</option>}
            </optgroup>
            <optgroup label={t('saas_settings_van_hanh_du_lieu', 'Vận Hành & Dữ Liệu')}>
              <option value="notifications">{t('settings_alerts_notifications')}</option>
              <option value="backup">{t('settings_backup_restore')}</option>
            </optgroup>
          </select>
        </div>

        {/* Main Content Panel */}
        <div className="min-w-0">
          {/* TAB 0: USERS MANAGEMENT & RBAC PERMISSION MATRIX */}
          {effectiveTab === 'users_rbac' && <SaaSUsersRbacTab />}

          {/* TAB 1: TRANSLATIONS & SYSTEM LANGUAGES */}
          {effectiveTab === 'translations' && <SaaSTranslationsTab />}

          {/* TAB 1b: JSON TRANSLATION EDITOR */}
          {effectiveTab === 'translations_json' && <SaaSTranslationsJsonTab />}

          {/* TAB 1: COMPANY PROFILE & PRINT TEMPLATES */}
          {effectiveTab === 'company' && (
              <form onSubmit={handleSaveCompany} className="space-y-6">
            {companyLoading && <p className="text-xs text-zinc-500">{t('dang_tai_thong_tin_doanh', 'Đang tải thông tin doanh nghiệp từ PostgreSQL...')}</p>}

            {/* WebShop storefront of THIS tenant — every business opens and
                shares its own shop URL; products/orders stay tenant-scoped. */}
            {!companyLoading && companyInfo?.webshop?.url && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
                      {t('webshop_cua_doanh_nghiep_ban', 'WebShop của doanh nghiệp bạn')}
                    </h3>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {companyInfo.webshop.name_vi || companyInfo.webshop.name_en || 'WebShop'}
                    </p>
                    <code className="block text-[11px] font-mono text-emerald-800 dark:text-emerald-200 mt-1 break-all">
                      {`${window.location.origin}${companyInfo.webshop.url}`}
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={companyInfo.webshop.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t('saas_tenants_mo_webshop', 'Mở WebShop')}
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${companyInfo.webshop.url}`);
                      addToast(t('da_sao_chep_url_webshop', 'Đã sao chép URL WebShop!'), 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {t('saas_tenants_sao_chep_url', 'Sao chép URL')}
                  </button>
                </div>
              </div>
            )}

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Building2 className="h-5 w-5 text-amber-500" /> {t('thong_tin_phap_ly_doanh', 'Thông Tin Pháp Lý Doanh Nghiệp (In trên hóa đơn & báo giá)')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('ten_doanh_nghiep_day_du', 'Tên Doanh Nghiệp (Đầy đủ)')}</label>
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
                  {t('ma_so_thue_tax_id', 'Mã Số Thuế (Tax ID)')}</label>
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
                  {t('saas_settings_dia_chi_d_ng_ky_kinh_doanh', 'Địa Chỉ Đăng Ký Kinh Doanh')}</label>
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
                  {t('saas_settings_dien_thoai_hotline', 'Điện Thoại Hotline')}</label>
                <input
                  type="text"
                  value={companyInfo.phone}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-medium bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_register_company_email', 'Email Công Ty')}</label>
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
              <CreditCard className="h-5 w-5 text-blue-500" /> {t('tai_khoan_ngan_hang_thu', 'Tài Khoản Ngân Hàng Thụ Hưởng & QR Thanh Toán')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_settings_ten_ngan_hang', 'Tên Ngân Hàng')}</label>
                <input
                  type="text"
                  value={companyInfo.bankName}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankName: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_settings_so_tai_khoan', 'Số Tài Khoản')}</label>
                <input
                  type="text"
                  value={companyInfo.bankAccount}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, bankAccount: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_settings_chu_tai_khoan', 'Chủ Tài Khoản')}</label>
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
              <Printer className="h-5 w-5 text-emerald-500" /> {t('cau_hinh_mau_in_chung', 'Cấu Hình Mẫu In Chứng Từ PDF (Phiếu Nhập/Xuất & Báo Giá)')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_settings_kho_giay_in_m_c_dinh', 'Khổ Giấy In Mặc Định')}</label>
                <select
                  value={companyInfo.pdfPaperSize}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, pdfPaperSize: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value="A4">{t('a4_tieu_chuan_doanh_nghiep', 'A4 (Tiêu chuẩn doanh nghiệp)')}</option>
                  <option value="A5">{t('a5_phieu_nho_tiet_kiem', 'A5 (Phiếu nhỏ tiết kiệm)')}</option>
                  <option value="80mm">{t('k80_in_nhiet_hoa_don', 'K80 (In nhiệt hóa đơn bán lẻ)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_settings_tieu_de_header_m_u_in', 'Tiêu Đề Header Mẫu In')}</label>
                <input
                  type="text"
                  value={companyInfo.pdfHeaderTitle}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, pdfHeaderTitle: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('loi_cam_on_ghi_chu', 'Lời Cảm Ơn / Ghi Chú Chân Trang Mẫu In')}</label>
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
              <Save className="h-4 w-4" /> {t('saas_settings_l_u_cau_hinh_doanh_nghiep', 'Lưu Cấu Hình Doanh Nghiệp')}</button>
          </div>
        </form>
      )}

      {/* TAB 2: MENU SYSTEM & DATABASE ROLES */}
      {effectiveTab === 'menu' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Database className="h-5 w-5 text-amber-500" /> {t('bang_dinh_nghia_menu_db', 'Bảng Định Nghĩa Menu DB & Bật/Tắt Tính Năng Realtime')}</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {t('quan_ly_danh_muc_cac', 'Quản lý danh mục các menu chức năng trong hệ thống SaaS, bật/tắt menu trực tiếp trên giao diện người dùng.')}</p>
              </div>
            </div>

            {/* Form Add New Menu */}
            <form onSubmit={handleAddMenu} className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/80 flex flex-col md:flex-row items-end gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  {t('saas_settings_ten_menu_moi', 'Tên Menu Mới')}</label>
                <input
                  type="text"
                  placeholder={t('vi_du_bao_cao_doanh', 'Ví dụ: Báo Cáo Doanh Thu Theo Vùng')}
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  {t('duong_dan_url_route', 'Đường Dẫn URL (Route)')}</label>
                <input
                  type="text"
                  placeholder={t('saas_regional_reports', '/saas/regional-reports')}
                  value={newMenuPath}
                  onChange={(e) => setNewMenuPath(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="w-full md:w-40">
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">
                  {t('saas_settings_nhom_menu', 'Nhóm Menu')}</label>
                <select
                  value={newMenuGroup}
                  onChange={(e) => setNewMenuGroup(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Tổng Quan">{t('saas_settings_tong_quan', 'Tổng Quan')}</option>
                  <option value="Bán Hàng & Kho">{t('saas_settings_ban_hang_kho', 'Bán Hàng & Kho')}</option>
                  <option value="Quản Lý Kho">{t('saas_settings_quan_ly_kho', 'Quản Lý Kho')}</option>
                  <option value="Thương Mại">{t('saas_settings_th_ng_mai', 'Thương Mại')}</option>
                  <option value="Tài Chính">{t('saas_settings_tai_chinh', 'Tài Chính')}</option>
                  <option value="Khác">{t('api_fallback_brand', 'Khác')}</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full md:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-2xs shrink-0"
              >
                <Plus className="h-4 w-4" /> {t('saas_settings_them_menu', 'Thêm Menu')}</button>
            </form>

            {/* Menu List Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3">{t('saas_settings_ten_menu_chuc_n_ng', 'Tên Menu Chức Năng')}</th>
                    <th className="px-4 py-3">{t('saas_settings_d_ong_d_n_url', 'Đường Dẫn URL')}</th>
                    <th className="px-4 py-3">{t('saas_settings_nhom', 'Nhóm')}</th>
                    <th className="px-4 py-3">{t('saas_settings_phan_quyen_vai_tro', 'Phân Quyền Vai Trò')}</th>
                    <th className="px-4 py-3 text-center">{t('status', 'Trạng Thái')}</th>
                    <th className="px-4 py-3 text-right">{t('actions', 'Thao Tác')}</th>
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
                          title={t('saas_settings_xoa_menu', 'Xóa menu')}
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
      {effectiveTab === 'inventory' && (
        <form onSubmit={handleSavePolicy} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Boxes className="h-5 w-5 text-amber-500" /> {t('saas_settings_phuongphaptinhgiavon', 'Phương Pháp Tính Giá Vốn & Quy Định Kho')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('phuong_phap_tinh_gia_von', 'Phương Pháp Tính Giá Vốn Hàng Tồn Kho')}</label>
                <select
                  value={policySettings.costingMethod}
                  onChange={(e) => setPolicySettings({ ...policySettings, costingMethod: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value="Bình quân gia quyền ròng">{t('binh_quan_gia_quyen_rong', 'Bình Quân Gia Quyền Ròng (Chuẩn TT200)')}</option>
                  <option value="FIFO">{t('nhap_truoc_xuat_truoc_fifo', 'Nhập Trước Xuất Trước (FIFO)')}</option>
                  <option value="Đích danh">{t('saas_settings_gia_dich_danh_lo_hang', 'Giá Đích Danh Lô Hàng')}</option>
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {t('gia_von_tu_dong_tinh', 'Giá vốn tự động tính lại ngay khi phát sinh phiếu nhập kho mới.')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('thue_suat_vat_mac_dinh', 'Thuế Suất VAT Mặc Định Cho Hàng Hóa Mới (%)')}</label>
                <select
                  value={policySettings.defaultVatRate}
                  onChange={(e) => setPolicySettings({ ...policySettings, defaultVatRate: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value={0}>{t('vat_0_export_non_taxable', '0% (Hàng xuất khẩu / Không chịu thuế)')}</option>
                  <option value={5}>{t('vat_5_agricultural_medical', '5% (Hàng nông sản, thiết bị y tế)')}</option>
                  <option value={8}>{t('vat_8_reduced_2026', '8% (Thuế GTGT giảm theo Nghị định 2026)')}</option>
                  <option value={10}>{t('vat_10_standard', '10% (Thuế GTGT phổ thông)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('dinh_muc_ton_kho_toi', 'Định Mức Tồn Kho Tối Thiểu (Cảnh Báo Tự Động)')}</label>
                <input
                  type="number"
                  value={policySettings.minStockThreshold}
                  onChange={(e) => setPolicySettings({ ...policySettings, minStockThreshold: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('han_muc_cong_no_cho', 'Hạn Mức Công Nợ Cho Phép Khách Hàng Mới (VNĐ)')}</label>
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
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{t('cho_phep_xuat_am_kho', 'Cho Phép Xuất Âm Kho (Negative Stock)')}</span>
                    <p className="text-[11px] text-zinc-500">{t('cho_phep_tao_phieu_xuat', 'Cho phép tạo phiếu xuất kho khi tồn kho hiện tại chưa cập nhật đủ phiếu nhập.')}</p>
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
                    <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{t('tu_dong_sinh_ma_chung', 'Tự Động Sinh Mã Chứng Từ Kèm Theo Ngày')}</span>
                    <p className="text-[11px] text-zinc-500">{t('quy_tac_sinh_ma_tu', 'Quy tắc sinh mã tự động cho Đơn hàng, Phiếu xuất, Phiếu nhập, Báo giá...')}</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2: DOCUMENT NUMBERING & PREFIX SETTINGS */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Sliders className="h-5 w-5 text-amber-500" /> {t('cau_hinh_tien_to_quy', 'Cấu Hình Tiền Tố & Quy Tắc Sinh Mã Chứng Từ')}</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('tien_to_don_hang_web', 'Tiền Tố Đơn Hàng Web (Order Prefix)')}</label>
                <input
                  type="text"
                  value={policySettings.orderCodePrefix || 'ORD-'}
                  onChange={(e) => setPolicySettings({ ...policySettings, orderCodePrefix: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  placeholder={t('ord', 'ORD-')}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('tien_to_phieu_xuat_kho', 'Tiền Tố Phiếu Xuất Kho (Stock Out)')}</label>
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
                  {t('tien_to_phieu_nhap_kho', 'Tiền Tố Phiếu Nhập Kho (Stock In)')}</label>
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
                  {t('tien_to_bao_gia_quotation', 'Tiền Tố Báo Giá (Quotation)')}</label>
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
                  {t('tien_to_hoa_don_vat', 'Tiền Tố Hóa Đơn VAT (Invoice)')}</label>
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
                  {t('dinh_dang_ngay_thang_trong', 'Định Dạng Ngày Tháng Trong Mã')}</label>
                <select
                  value={policySettings.dateFormatPattern || 'YYMMDD'}
                  onChange={(e) => setPolicySettings({ ...policySettings, dateFormatPattern: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value="YYMMDD">{t('yymmdd_gon_nhe_260730_khuyen', 'YYMMDD (Gọn nhẹ: 260730 - Khuyên dùng)')}</option>
                  <option value="YYYYMMDD">{t('yyyymmdd_day_du_20260730', 'YYYYMMDD (Đầy đủ: 20260730)')}</option>
                  <option value="YYMM">{t('yymm_theo_thang_2607', 'YYMM (Theo tháng: 2607)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_settings_do_dai_so_thu_tu_tu_dong', 'Độ Dài Số Thứ Tự Tự Động')}</label>
                <select
                  value={policySettings.numberPaddingLength || 3}
                  onChange={(e) => setPolicySettings({ ...policySettings, numberPaddingLength: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                >
                  <option value={3}>{t('padding_3_digits_sample', '3 chữ số (001, 002, 003)')}</option>
                  <option value={4}>{t('padding_4_digits_sample', '4 chữ số (0001, 0002, 0003)')}</option>
                  <option value={5}>{t('padding_5_digits_sample', '5 chữ số (00001, 00002, 00003)')}</option>
                </select>
              </div>
            </div>

            {/* Live Sample Preview Box */}
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 space-y-1.5">
              <span className="font-bold text-amber-600 dark:text-amber-400 block">{t('mau_ma_chung_tu_se', 'Mẫu mã chứng từ sẽ sinh ra theo cấu hình:')}</span>
              <div className="flex flex-wrap gap-2.5 font-mono font-bold text-[11px] pt-1">
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  {t('don_hang_web', 'Đơn hàng Web:')}{policySettings.orderCodePrefix || 'ORD-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  {t('phieu_xuat_kho', 'Phiếu xuất kho:')}{policySettings.stockOutPrefix || 'PX-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  {t('phieu_nhap_kho', 'Phiếu nhập kho:')}{policySettings.stockInPrefix || 'PN-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
                <span className="px-2.5 py-1 bg-white dark:bg-zinc-800 border border-amber-500/30 rounded-lg shadow-2xs">
                  {t('bao_gia', 'Báo giá:')}{policySettings.quotationPrefix || 'BG-'}{policySettings.dateFormatPattern === 'YYYYMMDD' ? '20260730' : (policySettings.dateFormatPattern === 'YYMM' ? '2607' : '260730')}-{(1).toString().padStart(policySettings.numberPaddingLength || 3, '0')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-xl shadow-md shadow-amber-500/20 flex items-center gap-2 text-xs transition-all"
            >
              <Save className="h-4 w-4" /> {t('saas_settings_l_u_cau_hinh_quy_trinh', 'Lưu Cấu Hình Quy Trình')}</button>
          </div>
        </form>
      )}

      {/* TAB 4: API BACKEND CONFIGURATION */}
      {effectiveTab === 'api' && (
        <form onSubmit={handleSaveApiConfig} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Server className="h-5 w-5 text-amber-500" /> {t('cau_hinh_api_gateway_authorization', 'Cấu Hình API Gateway & Authorization Header')}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('base_url_api_backend_server', 'Base URL API Backend Server')}</label>
                <input
                  type="text"
                  value={apiConfig.apiBaseUrl}
                  onChange={(e) => setApiConfig({ ...apiConfig, apiBaseUrl: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                  required
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  {t('moi_yeu_cau_gui_den', 'Mọi yêu cầu gửi đến')}<code className="text-amber-500 font-mono">{t('src_services_api_js', 'src/services/api.js')}</code> {t('se_tu_dong_noi_chuoi', 'sẽ tự động nối chuỗi URL này.')}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                  <Key className="h-3.5 w-3.5 text-amber-500" /> {t('jwt_bearer_authorization_token', 'JWT Bearer Authorization Token')}</label>
                <textarea
                  rows={3}
                  value={apiConfig.jwtToken}
                  onChange={(e) => setApiConfig({ ...apiConfig, jwtToken: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('webhook_event_url_nhanh_thong', 'Webhook Event URL (Nhanh Thông Báo Đơn Hàng)')}</label>
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
              <Save className="h-4 w-4" /> {t('saas_settings_l_u_cau_hinh_api', 'Lưu Cấu Hình API')}</button>
          </div>
        </form>
      )}

      {/* TAB 5: NOTIFICATIONS & ALERTS */}
      {effectiveTab === 'notifications' && (
        <form onSubmit={handleSaveNotify} className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <BellRing className="h-5 w-5 text-amber-500" /> {t('cau_hinh_canh_bao_kenh', 'Cấu Hình Cảnh Báo & Kênh Thông Báo Tự Động')}</h3>

            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                    {t('canh_bao_hang_ton_kho', 'Cảnh Báo Hàng Tồn Kho Dưới Định Mức')}</span>
                  <span className="text-[11px] text-zinc-500">
                    {t('gui_thong_bao_tren_thanh', 'Gửi thông báo trên thanh topbar khi số lượng sản phẩm chạm ngưỡng tồn tối thiểu.')}</span>
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
                    {t('canh_bao_cong_no_khach', 'Cảnh Báo Công Nợ Khách Hàng Quá Hạn')}</span>
                  <span className="text-[11px] text-zinc-500">
                    {t('canh_bao_khi_khoan_phai', 'Cảnh báo khi khoản phải thu vượt quá')}{notifyConfig.debtWarningDays} {t('ngay_chua_thanh_toan', 'ngày chưa thanh toán.')}</span>
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
                    {t('canh_bao_lech_kho_sau', 'Cảnh Báo Lệch Kho Sau Khi Kiểm Kê')}</span>
                  <span className="text-[11px] text-zinc-500">
                    {t('tu_dong_tao_phieu_thong', 'Tự động tạo phiếu thông báo khi phát hiện chênh lệch giữa kho sổ sách và kiểm kê thực tế.')}</span>
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
              <Save className="h-4 w-4" /> {t('saas_settings_l_u_cau_hinh_thong_bao', 'Lưu Cấu Hình Thông Báo')}</button>
          </div>
        </form>
      )}

      {/* TAB 6: BACKUP & RESTORE */}
      {effectiveTab === 'backup' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <Download className="h-5 w-5 text-emerald-500" /> {t('sao_luu_du_lieu_an', 'Sao Lưu Dữ Liệu An Toàn (JSON Backup)')}</h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              {t('xuat_toan_bo_cau_hinh', 'Xuất toàn bộ cấu hình hệ thống, bảng định nghĩa menu DB, thông tin doanh nghiệp và chính sách vận hành ra file định dạng JSON.')}</p>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  {t('tai_ve_file_sao_luu', 'Tải Về File Sao Lưu Toàn Bộ Cấu Hình ERP')}</p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  {t('file_bao_gom_chung_tu', 'File bao gồm chứng từ, menu active, chính sách thuế & cấu hình API.')}</p>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs shrink-0"
              >
                <Download className="h-4 w-4" /> {t('saas_settings_tai_file_backup_json', 'Tải File Backup JSON')}</button>
            </div>
          </div>
         </div>
       )}
      </div>
    </div>
  </div>
  );
};

export default SaaSSettingsPage;
