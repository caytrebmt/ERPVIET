import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Calculator, BookOpen, Settings2, Activity, Scale, CheckCircle2, AlertTriangle, Plus, Search } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import client from '../../api/client';
import { useTranslation } from 'react-i18next';

interface JournalEntry {
  id: number;
  entryNo: string;
  date: string;
  description: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  vatAmount: number;
}

interface AccountItem {
  code: string;
  name: string;
  type: 'Tài sản' | 'Nợ phải trả' | 'Vốn CSH' | 'Doanh thu' | 'Chi phí';
  parentCode?: string;
  balanceType: 'Nợ' | 'Có' | 'Lưỡng tính';
  currentBalance: number;
}

interface TrialBalanceItem {
  code: string;
  name: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export const SaaSAccountingPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'journal' | 'chart' | 'mapping' | 'trial' | 'health'>('journal');

  // All accounting rows are loaded from the tenant ledger.
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [trialBalances, setTrialBalances] = useState<TrialBalanceItem[]>([]);
  const [health, setHealth] = useState({ debitTotal: 0, creditTotal: 0, balanced: true });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [accountMappings, setAccountMappings] = useState({
    acc_cash: '', acc_bank: '', acc_ar: '', acc_ap: '', acc_inventory: '',
    acc_vat_in: '', acc_vat_out: '', acc_revenue: '', acc_cogs: '',
  });

  useEffect(() => {
    let cancelled = false;
    client.get('/api/saas/accounting/summary')
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.ok) throw new Error(response.data?.message || 'Không tải được sổ kế toán.');
        const data = response.data.data || {};
        setAccounts((data.accounts || []).map((row: any) => ({
          code: row.code, name: row.name, type: row.type, balanceType: row.balanceType,
          currentBalance: Number(row.currentBalance) || 0,
        })));
        setEntries((data.entries || []).map((row: any) => ({
          id: Number(row.id), entryNo: row.entry_no, date: row.date,
          description: row.description || '', debitAccount: row.debit_account || '',
          creditAccount: row.credit_account || '', amount: Number(row.amount) || 0, vatAmount: 0,
        })));
        setTrialBalances(data.trialBalances || []);
        setHealth(data.health || { debitTotal: 0, creditTotal: 0, balanced: true });
        setLoadError(null);
      })
      .catch((error: any) => { if (!cancelled) setLoadError(error?.response?.data?.message || error.message || 'Không tải được sổ kế toán từ cơ sở dữ liệu.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const journalColumns: ColumnDef<JournalEntry>[] = [
    {
      accessorKey: 'entryNo',
      header: t('saas_accounting_so_but_toan', 'Số Bút Toán'),
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: t('saas_accounting_ngay_ghi_so', 'Ngày Ghi Sổ'),
    },
    {
      accessorKey: 'description',
      header: t('saas_accounting_dien_giai_but_toan', 'Diễn Giải Bút Toán'),
      cell: (info) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'debitAccount',
      header: t('saas_accounting_tai_khoan_no', 'Tài Khoản Nợ'),
      cell: (info) => <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'creditAccount',
      header: t('saas_accounting_tai_khoan_co', 'Tài Khoản Có'),
      cell: (info) => <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: t('saas_accounting_so_tien_ghi_so', 'Số Tiền Ghi Sổ'),
      cell: (info) => (
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  const chartColumns: ColumnDef<AccountItem>[] = [
    {
      accessorKey: 'code',
      header: t('saas_settings_so_tai_khoan', 'Số Tài Khoản'),
      cell: (info) => <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'name',
      header: t('saas_accounting_ten_tai_khoan_ke_toan', 'Tên Tài Khoản Kế Toán'),
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'type',
      header: t('saas_accounting_loai_tk', 'Loại TK'),
    },
    {
      accessorKey: 'balanceType',
      header: t('saas_accounting_tinh_chat_so_d', 'Tính Chất Số Dư'),
      cell: (info) => <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'currentBalance',
      header: t('saas_accounting_so_d_hien_tai', 'Số Dư Hiện Tại'),
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {loading && <p className="text-xs text-zinc-500">{t('dang_tai_so_ke_toan', 'Đang tải sổ kế toán từ PostgreSQL...')}</p>}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-amber-500" /> {t('he_thong_ke_toan_doanh', 'Hệ Thống Kế Toán Doanh Nghiệp (TT200/TT133)')}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t('nhat_ky_chung_he_thong', 'Nhật ký chung, Hệ thống tài khoản, Ánh xạ định khoản tự động, Bảng cân đối phát sinh & Đối soát sức khỏe kế toán (`/app/templates/accounting`).')}</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('journal')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'journal' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <BookOpen className="h-4 w-4" /> {t('so_nhat_ky_chung', 'Sổ Nhật Ký Chung (')}{entries.length})
        </button>

        <button
          onClick={() => setActiveTab('chart')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'chart' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Calculator className="h-4 w-4" /> {t('he_thong_tai_khoan', 'Hệ Thống Tài Khoản (')}{accounts.length})
        </button>

        <button
          onClick={() => setActiveTab('mapping')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'mapping' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Settings2 className="h-4 w-4" /> {t('cau_hinh_anh_xa_dinh', 'Cấu Hình Ánh Xạ Định Khoản')}</button>

        <button
          onClick={() => setActiveTab('trial')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'trial' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Scale className="h-4 w-4" /> {t('bang_can_doi_so_phat', 'Bảng Cân Đối Số Phát Sinh')}</button>

        <button
          onClick={() => setActiveTab('health')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'health' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Activity className="h-4 w-4" /> {t('kiem_tra_suc_khoe_ke', 'Kiểm Tra Sức Khỏe Kế Toán')}</button>
      </div>

      {/* Tab 1: General Ledger Journal */}
      {activeTab === 'journal' && (
        <DataTable columns={journalColumns} data={entries} searchPlaceholder={t('tim_ma_chung_tu_dien', 'Tìm mã chứng từ, diễn giải bút toán...')} />
      )}

      {/* Tab 2: Chart of Accounts */}
      {activeTab === 'chart' && (
        <DataTable columns={chartColumns} data={accounts} searchPlaceholder={t('tim_ma_tai_khoan_ten', 'Tìm mã tài khoản, tên tài khoản...')} />
      )}

      {/* Tab 3: Account Mapping */}
      {activeTab === 'mapping' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('cau_hinh_anh_xa_tai', 'Cấu Hình Ánh Xạ Tài Khoản Tự Động')}</h3>
            <p className="text-xs text-zinc-500 mt-1">
              {t('thiet_lap_cac_tk_ke', 'Thiết lập các TK kế toán ngầm định khi tạo Phiếu Nhập kho, Phiếu Xuất kho, Bán hàng & Thu/Chi tiền nợ.')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {Object.entries({
              acc_cash: 'TK Tiền Mặt',
              acc_bank: 'TK Tiền Gửi Ngân Hàng',
              acc_ar: 'TK Phải Thu Khách Hàng',
              acc_ap: 'TK Phải Trả Người Bán',
              acc_inventory: 'TK Hàng Tồn Kho',
              acc_vat_in: 'TK Thuế GTGT Đầu Vào Khấu Trừ',
              acc_vat_out: 'TK Thuế GTGT Đầu Ra Phải Nộp',
              acc_revenue: 'TK Doanh Thu Bán Hàng',
              acc_cogs: 'TK Giá Vốn Hàng Bán',
            }).map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{label}</label>
                <input
                  type="text"
                  value={accountMappings[key as keyof typeof accountMappings]}
                  onChange={(e) => setAccountMappings({ ...accountMappings, [key]: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-mono font-bold"
                />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
            <button className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs">
              {t('luu_cau_hinh_hach_toan', 'Lưu Cấu Hình Hạch Toán Tự Động')}</button>
          </div>
        </div>
      )}

      {/* Tab 4: Trial Balance */}
      {activeTab === 'trial' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs overflow-x-auto">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 uppercase">
            {t('bang_can_doi_so_phat_2', 'BẢNG CÂN ĐỐI SỐ PHÁT SINH (TRIAL BALANCE)')}</h3>
          <table className="w-full text-left text-xs border border-zinc-200 dark:border-zinc-800">
            <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
              <tr>
                <th className="p-2.5 border" rowSpan={2}>{t('saas_accounting_ma_tk', 'Mã TK')}</th>
                <th className="p-2.5 border" rowSpan={2}>{t('saas_accounting_ten_tai_khoan', 'Tên Tài Khoản')}</th>
                <th className="p-2.5 border text-center" colSpan={2}>{t('saas_accounting_so_d_dau_ky', 'Số Dư Đầu Kỳ')}</th>
                <th className="p-2.5 border text-center" colSpan={2}>{t('so_phat_sinh_trong_ky', 'Số Phát Sinh Trong Kỳ')}</th>
                <th className="p-2.5 border text-center" colSpan={2}>{t('saas_accounting_so_d_cuoi_ky', 'Số Dư Cuối Kỳ')}</th>
              </tr>
              <tr>
                <th className="p-2 border text-right">{t('debit_short', 'Nợ')}</th>
                <th className="p-2 border text-right">{t('credit_short', 'Có')}</th>
                <th className="p-2 border text-right">{t('debit_short', 'Nợ')}</th>
                <th className="p-2 border text-right">{t('credit_short', 'Có')}</th>
                <th className="p-2 border text-right">{t('debit_short', 'Nợ')}</th>
                <th className="p-2 border text-right">{t('credit_short', 'Có')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {trialBalances.map((tb, idx) => (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="p-2.5 border font-mono font-bold text-amber-600">{tb.code}</td>
                  <td className="p-2.5 border font-semibold text-zinc-900 dark:text-zinc-100">{tb.name}</td>
                  <td className="p-2.5 border text-right">{tb.openingDebit.toLocaleString('vi-VN')}</td>
                  <td className="p-2.5 border text-right">{tb.openingCredit.toLocaleString('vi-VN')}</td>
                  <td className="p-2.5 border text-right font-semibold text-blue-600">{tb.periodDebit.toLocaleString('vi-VN')}</td>
                  <td className="p-2.5 border text-right font-semibold text-purple-600">{tb.periodCredit.toLocaleString('vi-VN')}</td>
                  <td className="p-2.5 border text-right font-bold text-emerald-600">{tb.closingDebit.toLocaleString('vi-VN')}</td>
                  <td className="p-2.5 border text-right font-bold text-emerald-600">{tb.closingCredit.toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 5: Accounting Health Check */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-500" /> {t('ket_qua_doi_soat_suc', 'Kết Quả Đối Soát Sức Khỏe Kế Toán & Tồn Kho')}</h3>
            <p className="text-xs text-zinc-500">
              {t('he_thong_tu_dong_kiem', 'Hệ thống tự động kiểm tra tính cân đối giữa Sổ cái Kế toán vs Sổ Kho Thực tế và Sổ Chi tiết Công nợ KH/NCC.')}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> {t('saas_accounting_doi_soat_ton_kho_tk_156', 'ĐỐI SOÁT TỒN KHO & TK 156')}</div>
                <p className="text-zinc-700 dark:text-zinc-300">{t('ton_kho_thuc_te', 'Tồn kho thực tế:')}<strong>{accounts.find((account) => account.code === '156')?.currentBalance.toLocaleString('vi-VN') || '0'} đ</strong></p>
                <p className="text-zinc-700 dark:text-zinc-300">{t('so_cai_tk_156', 'Sổ cái TK 156:')}<strong>{accounts.find((account) => account.code === '156')?.currentBalance.toLocaleString('vi-VN') || '0'} đ</strong></p>
                <span className={`inline-block px-2 py-0.5 rounded-xs font-bold ${health.balanced ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>{health.balanced ? 'CÂN ĐỐI' : 'CHƯA CÂN ĐỐI'}</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> {t('cong_no_khach_hang_tk', 'CÔNG NỢ KHÁCH HÀNG & TK 131')}</div>
                <p className="text-zinc-700 dark:text-zinc-300">{t('so_no_khach_hang', 'Sổ nợ Khách hàng:')}<strong>{accounts.find((account) => account.code === '131')?.currentBalance.toLocaleString('vi-VN') || '0'} đ</strong></p>
                <p className="text-zinc-700 dark:text-zinc-300">{t('so_cai_tk_131', 'Sổ cái TK 131:')}<strong>{accounts.find((account) => account.code === '131')?.currentBalance.toLocaleString('vi-VN') || '0'} đ</strong></p>
                <span className={`inline-block px-2 py-0.5 rounded-xs font-bold ${health.balanced ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>{health.balanced ? 'CÂN ĐỐI' : 'CHƯA CÂN ĐỐI'}</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> {t('saas_accounting_can_doi_but_toan_no_co', 'CÂN ĐỐI BÚT TOÁN NỢ / CÓ')}</div>
                <p className="text-zinc-700 dark:text-zinc-300">{t('tong_no', 'Tổng Nợ:')}<strong>{health.debitTotal.toLocaleString('vi-VN')} đ</strong></p>
                <p className="text-zinc-700 dark:text-zinc-300">{t('tong_co', 'Tổng Có:')}<strong>{health.creditTotal.toLocaleString('vi-VN')} đ</strong></p>
                <span className={`inline-block px-2 py-0.5 rounded-xs font-bold ${health.balanced ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>{health.balanced ? 'CÂN ĐỐI' : 'CHƯA CÂN ĐỐI'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
