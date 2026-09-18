import React, { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Building2,
  Plus,
  Eye,
  Pause,
  Play,
  Crown,
  Settings,
  X,
  ExternalLink,
  Copy,
  CheckCircle2,
  Clock,
  Ban,
  Loader2,
  ShieldCheck,
  Users,
  Warehouse,
  ShoppingBag,
  Calendar,
} from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import client from '../../api/client';
import { getIntlLocale, pickLocalized } from '../../utils/localized';

export interface TenantDetail {
  id: number;
  code: string;
  name_vi: string;
  name_en?: string;
  tax_code: string;
  email?: string;
  phone?: string;
  address?: string;
  slug: string;
  subdomain?: string;
  plan_type: 'free' | 'starter' | 'professional' | 'enterprise';
  subscription_status: 'trial' | 'active' | 'past_due' | 'canceled' | 'suspended';
  trial_ends_at?: string;
  settings?: Record<string, any>;
  max_users: number;
  max_warehouses: number;
  is_paused: boolean;
  onboarding_completed: boolean;
  created_at: string;
  owner_user_id?: number;
  webshop_slug?: string;
  webshop_name_vi?: string;
}

const PLAN_CONFIG: Record<string, { viCopy: string; labelEn: string; color: string; icon: any }> = {
  free: { viCopy: 'Miễn phí', labelEn: 'Free', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30', icon: ShieldCheck },
  starter: { viCopy: 'Starter', labelEn: 'Starter', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30', icon: ShieldCheck },
  professional: { viCopy: 'Professional', labelEn: 'Professional', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Crown },
  enterprise: { viCopy: 'Enterprise', labelEn: 'Enterprise', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: Crown },
};

const STATUS_CONFIG: Record<string, { viCopy: string; labelEn: string; color: string; icon: any }> = {
  trial: { viCopy: 'Dùng thử', labelEn: 'Trial', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: Clock },
  active: { viCopy: 'Đang hoạt động', labelEn: 'Active', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: CheckCircle2 },
  past_due: { viCopy: 'Quá hạn', labelEn: 'Past Due', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  canceled: { viCopy: 'Đã hủy', labelEn: 'Canceled', color: 'bg-gray-500/10 text-gray-600 border-gray-500/30', icon: Ban },
  suspended: { viCopy: 'Đã tạm dừng', labelEn: 'Suspended', color: 'bg-red-500/10 text-red-600 border-red-500/30', icon: Ban },
};

export const SaaSTenantsPage: React.FC = () => {
  const { language, t } = useLanguage();
  const { showToast } = useToast();
  const isEn = language === 'en';

  const [tenants, setTenants] = useState<TenantDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/saas/tenants/list');
      if (res.data?.ok) {
        setTenants(res.data.data || []);
      }
    } catch {
      showToast(t('khong_the_tai_danh_sach', 'Không thể tải danh sách doanh nghiệp'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handlePauseToggle = async (tenant: TenantDetail) => {
    setActionLoading(`pause-${tenant.id}`);
    try {
      await client.post(`/api/saas/tenants/${tenant.id}/pause`, { paused: !tenant.is_paused });
      showToast(
        !tenant.is_paused
          ? (t('saas_tenants_da_tam_d_ng_doanh_nghiep', 'Đã tạm dừng doanh nghiệp'))
          : (t('da_kich_hoat_lai_doanh', 'Đã kích hoạt lại doanh nghiệp')),
        'success'
      );
      loadTenants();
    } catch {
      showToast(t('saas_tenants_thao_tac_that_bai', 'Thao tác thất bại'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgrade = async (tenant: TenantDetail, plan: string) => {
    setActionLoading(`upgrade-${tenant.id}`);
    try {
      await client.post(`/api/saas/tenants/${tenant.id}/upgrade`, { plan_type: plan });
      showToast(t('da_nang_cap_len_goi', 'Đã nâng cấp lên gói {{plan}}', { plan: plan }), 'success');
      loadTenants();
    } catch {
      showToast(t('saas_tenants_nang_cap_that_bai', 'Nâng cấp thất bại'), 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const openDetail = async (tenant: TenantDetail) => {
    try {
      const res = await client.get(`/api/saas/tenants/${tenant.id}`);
      if (res.data?.ok && res.data.data) {
        setSelectedTenant(res.data.data);
      } else {
        setSelectedTenant(tenant);
      }
      setShowDetailModal(true);
    } catch {
      setSelectedTenant(tenant);
      setShowDetailModal(true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast(t('saas_tenants_da_sao_chep', 'Đã sao chép!'), 'success');
  };

  const columns: ColumnDef<TenantDetail>[] = [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 60,
    },
    {
      accessorKey: 'name_vi',
      header: t('saas_register_company_name', 'Tên doanh nghiệp'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{row.original.name_vi}</p>
            <p className="text-[10px] text-gray-500 truncate">{row.original.name_en}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'code',
      header: t('ma_code', 'Mã'),
      cell: ({ row }) => (
        <span className="font-mono text-[10px] text-gray-600 dark:text-gray-400">{row.original.code}</span>
      ),
    },
    {
      accessorKey: 'slug',
      header: t('slug', 'Slug'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <code className="text-[10px] bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
            {row.original.slug}
          </code>
          <button onClick={() => copyToClipboard(row.original.slug)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: 'plan_type',
      header: t('goi_plan', 'Gói'),
      cell: ({ row }) => {
        const plan = row.original.plan_type;
        const config = PLAN_CONFIG[plan] || PLAN_CONFIG.free;
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${config.color}`}>
            <Icon className="w-3 h-3" />
            {pickLocalized(isEn, config.labelEn, config.viCopy)}
          </span>
        );
      },
    },
    {
      accessorKey: 'subscription_status',
      header: t('status', 'Trạng thái'),
      cell: ({ row }) => {
        const status = row.original.subscription_status;
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
        const Icon = config.icon;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${config.color}`}>
            <Icon className="w-3 h-3" />
            {pickLocalized(isEn, config.labelEn, config.viCopy)}
          </span>
        );
      },
    },
    {
      accessorKey: 'is_paused',
      header: t('saas_tenants_tam_d_ng', 'Tạm dừng'),
      cell: ({ row }) => (
        row.original.is_paused ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 text-[10px] font-bold">
            <Ban className="w-3 h-3" />
            {t('saas_tenants_da_tam_d_ng', 'Đã tạm dừng')}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3" />
            {t('saas_settings_dang_hoat_dong', 'Đang hoạt động')}
          </span>
        )
      ),
    },
    {
      accessorKey: 'max_users',
      header: t('saas_tenants_ng_oi_dung', 'Người dùng'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Users className="w-3.5 h-3.5" />
          {row.original.max_users}
        </div>
      ),
    },
    {
      accessorKey: 'max_warehouses',
      header: t('kho_warehouses', 'Kho'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Warehouse className="w-3.5 h-3.5" />
          {row.original.max_warehouses}
        </div>
      ),
    },
    {
      accessorKey: 'trial_ends_at',
      header: t('saas_tenants_han_dung_thu', 'Hạn dùng thử'),
      cell: ({ row }) => {
        if (!row.original.trial_ends_at) return <span className="text-xs text-gray-400">-</span>;
        const date = new Date(row.original.trial_ends_at);
        const isExpired = date < new Date();
        return (
          <div className="flex items-center gap-1 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span className={isExpired ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-400'}>
              {date.toLocaleDateString(getIntlLocale(isEn))}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'created_at',
      header: t('crm_date', 'Ngày tạo'),
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">
          {new Date(row.original.created_at).toLocaleDateString(getIntlLocale(isEn))}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('actions', 'Thao tác'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => openDetail(row.original)}
            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 cursor-pointer"
            title={t('saas_tenants_xem_chi_tiet', 'Xem chi tiết')}
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <a
            href={`/shop/${row.original.webshop_slug || row.original.slug}`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 cursor-pointer"
            title={t('mo_webshop_cua_doanh_nghiep', 'Mở WebShop của doanh nghiệp này')}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={() => handlePauseToggle(row.original)}
            disabled={!!actionLoading}
            className="p-1.5 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 text-amber-600 cursor-pointer disabled:opacity-50"
            title={row.original.is_paused ? (t('saas_tenants_kich_hoat', 'Kích hoạt')) : (t('saas_tenants_tam_d_ng', 'Tạm dừng'))}
          >
            {actionLoading === `pause-${row.original.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : row.original.is_paused ? (
              <Play className="w-3.5 h-3.5" />
            ) : (
              <Pause className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={() => {
              const newPlan = row.original.plan_type === 'enterprise' ? 'professional' : 'enterprise';
              handleUpgrade(row.original, newPlan);
            }}
            disabled={!!actionLoading}
            className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 cursor-pointer disabled:opacity-50"
            title={t('saas_tenants_doi_goi', 'Đổi gói')}
          >
            {actionLoading === `upgrade-${row.original.id}` ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Crown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
            {t('saas_tenants_quan_ly_doanh_nghiep', 'Quản lý Doanh nghiệp')}
          </h2>
          <p className="text-xs text-gray-500">
            {t('quan_ly_doanh_nghiep_dang', 'Quản lý doanh nghiệp đăng ký, gói dịch vụ, trạng thái thuê bao và phân quyền truy cập')}
          </p>
        </div>
        <button
          onClick={() => window.open('/saas/register', '_blank')}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('dang_ky_doanh_nghiep_register', 'Đăng ký Doanh nghiệp')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {t('saas_tenants_tong_doanh_nghiep', 'Tổng doanh nghiệp')}
              </p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">{tenants.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {t('saas_settings_dang_hoat_dong', 'Đang hoạt động')}
              </p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                {tenants.filter((t) => t.subscription_status === 'active' && !t.is_paused).length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {t('saas_tenants_dung_thu', 'Dùng thử')}
              </p>
              <p className="text-2xl font-extrabold text-blue-600 mt-1">
                {tenants.filter((t) => t.subscription_status === 'trial').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                {t('saas_tenants_tam_d_ng', 'Tạm dừng')}
              </p>
              <p className="text-2xl font-extrabold text-red-600 mt-1">
                {tenants.filter((t) => t.is_paused || t.subscription_status === 'suspended').length}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <Ban className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <DataTable
          columns={columns}
          data={tenants}
          searchPlaceholder={t('saas_tenants_tim_kiem_doanh_nghiep', 'Tìm kiếm doanh nghiệp...')}
          pageSize={10}
          actionButton={
            <button
              onClick={() => window.open('/saas/register', '_blank')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t('dang_ky_doanh_nghiep_register_2', 'Đăng ký Doanh nghiệp')}
            </button>
          }
          enableRowSelection={false}
        />
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-gray-100">{selectedTenant.name_vi}</h3>
                  <p className="text-xs text-gray-500">{selectedTenant.name_en}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    {t('saas_tenants_thong_tin_c_ban', 'Thông tin cơ bản')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('ma_code', 'Mã')}</span>
                      <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">{selectedTenant.code}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('saas_register_tax_code', 'Mã số thuế')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTenant.tax_code}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('email_2', 'Email')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTenant.email || '-'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('saas_tenants_dien_thoai', 'Điện thoại')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTenant.phone || '-'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('saas_tenants_dia_chi', 'Địa chỉ')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-right max-w-[60%]">{selectedTenant.address || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider">
                    {t('saas_tenants_thue_bao', 'Thuê bao')}
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('goi_plan', 'Gói')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{selectedTenant.plan_type}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('status', 'Trạng thái')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{selectedTenant.subscription_status}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('saas_tenants_han_dung_thu', 'Hạn dùng thử')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {selectedTenant.trial_ends_at ? new Date(selectedTenant.trial_ends_at).toLocaleDateString(getIntlLocale(isEn)) : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('saas_tenants_tam_d_ng', 'Tạm dừng')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTenant.is_paused ? (t('co_yes', 'Có')) : (t('saas_tenants_khong', 'Không'))}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">{t('saas_tenants_hoan_tat_thiet_lap', 'Hoàn tất thiết lập')}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTenant.onboarding_completed ? (t('saas_purchasing_hoan_tat', 'Hoàn tất')) : (t('saas_tenants_ch_a_hoan_tat', 'Chưa hoàn tất'))}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                  {t('saas_tenants_gioi_han_tai_nguyen', 'Giới hạn & Tài nguyên')}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <div>
                      <p className="text-[10px] text-gray-500">{t('saas_tenants_toi_da_ng_oi_dung', 'Tối đa người dùng')}</p>
                      <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{selectedTenant.max_users}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center gap-3">
                    <Warehouse className="w-5 h-5 text-amber-500" />
                    <div>
                      <p className="text-[10px] text-gray-500">{t('saas_tenants_toi_da_kho', 'Tối đa kho')}</p>
                      <p className="text-sm font-extrabold text-gray-900 dark:text-gray-100">{selectedTenant.max_warehouses}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Settings */}
              {selectedTenant.settings && Object.keys(selectedTenant.settings).length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">
                    {t('saas_tenants_cau_hinh', 'Cấu hình')}
                  </h4>
                  <pre className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-[10px] text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedTenant.settings, null, 2)}
                  </pre>
                </div>
              )}

              {/* Links — the tenant's OWN WebShop (webshop_slug), on the
                  current origin, never a hard-coded localhost URL. */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {(() => {
                  const webshopPath = `/shop/${selectedTenant.webshop_slug || selectedTenant.slug}`;
                  const webshopUrl = `${window.location.origin}${webshopPath}`;
                  return (
                    <>
                      <a
                        href={webshopPath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('saas_tenants_mo_webshop', 'Mở WebShop')}
                      </a>
                      <button
                        onClick={() => copyToClipboard(webshopUrl)}
                        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {t('saas_tenants_sao_chep_url', 'Sao chép URL')}
                      </button>
                      <code className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1.5 rounded-lg break-all">
                        {webshopUrl}
                      </code>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
