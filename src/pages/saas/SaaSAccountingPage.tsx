import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Calculator, BookOpen, Settings2, Activity, Scale, CheckCircle2, AlertTriangle, Plus, Search } from 'lucide-react';
import { DataTable } from '../../components/DataTable';

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
  const [activeTab, setActiveTab] = useState<'journal' | 'chart' | 'mapping' | 'trial' | 'health'>('journal');

  // Journal Entries Data
  const [entries] = useState<JournalEntry[]>([
    {
      id: 1,
      entryNo: 'NKC-2026-001',
      date: '2026-07-28',
      description: 'Nhập hàng giấy A4 Double A từ NCC Double A Việt Nam theo PNK-001',
      debitAccount: '156 - Hàng hóa',
      creditAccount: '331 - Phải trả cho người bán',
      amount: 45000000,
      vatAmount: 4500000,
    },
    {
      id: 2,
      entryNo: 'NKC-2026-002',
      date: '2026-07-29',
      description: 'Xuất bán Laptop Dell Inspiron cho Công ty TechViet theo PXK-001',
      debitAccount: '131 - Phải thu của khách hàng',
      creditAccount: '511 - Doanh thu bán hàng',
      amount: 18000000,
      vatAmount: 1800000,
    },
    {
      id: 3,
      entryNo: 'NKC-2026-003',
      date: '2026-07-29',
      description: 'Ghi nhận Giá vốn hàng bán Laptop Dell cho PXK-001',
      debitAccount: '632 - Giá vốn hàng bán',
      creditAccount: '156 - Hàng hóa',
      amount: 15500000,
      vatAmount: 0,
    },
    {
      id: 4,
      entryNo: 'NKC-2026-004',
      date: '2026-07-29',
      description: 'Khách hàng TechViet thanh toán chuyển khoản tiền nợ',
      debitAccount: '112 - Tiền gửi ngân hàng',
      creditAccount: '131 - Phải thu của khách hàng',
      amount: 19800000,
      vatAmount: 0,
    },
  ]);

  // Chart of Accounts Data (Mẫu Hệ thống TK Kế toán TT200)
  const [accounts] = useState<AccountItem[]>([
    { code: '111', name: 'Tiền mặt tại quỹ', type: 'Tài sản', balanceType: 'Nợ', currentBalance: 245000000 },
    { code: '112', name: 'Tiền gửi Ngân hàng Vietcombank', type: 'Tài sản', balanceType: 'Nợ', currentBalance: 1250000000 },
    { code: '131', name: 'Phải thu của khách hàng', type: 'Tài sản', balanceType: 'Lưỡng tính', currentBalance: 480000000 },
    { code: '1331', name: 'Thuế GTGT được khấu trừ', type: 'Tài sản', balanceType: 'Nợ', currentBalance: 29600000 },
    { code: '156', name: 'Hàng hóa tồn kho', type: 'Tài sản', balanceType: 'Nợ', currentBalance: 3450000000 },
    { code: '331', name: 'Phải trả cho người bán', type: 'Nợ phải trả', balanceType: 'Lưỡng tính', currentBalance: 180000000 },
    { code: '3331', name: 'Thuế GTGT phải nộp', type: 'Nợ phải trả', balanceType: 'Có', currentBalance: 19660000 },
    { code: '411', name: 'Vốn đầu tư của chủ sở hữu', type: 'Vốn CSH', balanceType: 'Có', currentBalance: 3600000000 },
    { code: '511', name: 'Doanh thu bán hàng & dịch vụ', type: 'Doanh thu', balanceType: 'Có', currentBalance: 1285000000 },
    { code: '632', name: 'Giá vốn hàng bán', type: 'Chi phí', balanceType: 'Nợ', currentBalance: 940000000 },
  ]);

  // Account Mapping State
  const [accountMappings, setAccountMappings] = useState({
    acc_cash: '111 - Tiền mặt tại quỹ',
    acc_bank: '112 - Tiền gửi ngân hàng',
    acc_ar: '131 - Phải thu của khách hàng',
    acc_ap: '331 - Phải trả cho người bán',
    acc_inventory: '156 - Hàng hóa tồn kho',
    acc_vat_in: '1331 - Thuế GTGT được khấu trừ',
    acc_vat_out: '3331 - Thuế GTGT phải nộp',
    acc_revenue: '511 - Doanh thu bán hàng',
    acc_cogs: '632 - Giá vốn hàng bán',
  });

  // Trial Balance Data
  const [trialBalances] = useState<TrialBalanceItem[]>([
    { code: '111', name: 'Tiền mặt', openingDebit: 200000000, openingCredit: 0, periodDebit: 95000000, periodCredit: 50000000, closingDebit: 245000000, closingCredit: 0 },
    { code: '112', name: 'Tiền gửi Ngân hàng', openingDebit: 1000000000, openingCredit: 0, periodDebit: 450000000, periodCredit: 200000000, closingDebit: 1250000000, closingCredit: 0 },
    { code: '131', name: 'Phải thu khách hàng', openingDebit: 300000000, openingCredit: 0, periodDebit: 360000000, periodCredit: 180000000, closingDebit: 480000000, closingCredit: 0 },
    { code: '156', name: 'Hàng hóa', openingDebit: 3000000000, openingCredit: 0, periodDebit: 1390000000, periodCredit: 940000000, closingDebit: 3450000000, closingCredit: 0 },
    { code: '331', name: 'Phải trả người bán', openingDebit: 0, openingCredit: 150000000, periodDebit: 320000000, periodCredit: 350000000, closingDebit: 0, closingCredit: 180000000 },
  ]);

  const journalColumns: ColumnDef<JournalEntry>[] = [
    {
      accessorKey: 'entryNo',
      header: 'Số Bút Toán',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Ngày Ghi Sổ',
    },
    {
      accessorKey: 'description',
      header: 'Diễn Giải Bút Toán',
      cell: (info) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'debitAccount',
      header: 'Tài Khoản Nợ',
      cell: (info) => <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'creditAccount',
      header: 'Tài Khoản Có',
      cell: (info) => <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-bold">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Số Tiền Ghi Sổ',
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
      header: 'Số Tài Khoản',
      cell: (info) => <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Tên Tài Khoản Kế Toán',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'type',
      header: 'Loại TK',
    },
    {
      accessorKey: 'balanceType',
      header: 'Tính Chất Số Dư',
      cell: (info) => <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'currentBalance',
      header: 'Số Dư Hiện Tại',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-amber-500" /> Hệ Thống Kế Toán Doanh Nghiệp (TT200/TT133)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Nhật ký chung, Hệ thống tài khoản, Ánh xạ định khoản tự động, Bảng cân đối phát sinh & Đối soát sức khỏe kế toán (`/app/templates/accounting`).
          </p>
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
          <BookOpen className="h-4 w-4" /> Sổ Nhật Ký Chung ({entries.length})
        </button>

        <button
          onClick={() => setActiveTab('chart')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'chart' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Calculator className="h-4 w-4" /> Hệ Thống Tài Khoản ({accounts.length})
        </button>

        <button
          onClick={() => setActiveTab('mapping')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'mapping' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Settings2 className="h-4 w-4" /> Cấu Hình Ánh Xạ Định Khoản
        </button>

        <button
          onClick={() => setActiveTab('trial')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'trial' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Scale className="h-4 w-4" /> Bảng Cân Đối Số Phát Sinh
        </button>

        <button
          onClick={() => setActiveTab('health')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            activeTab === 'health' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Activity className="h-4 w-4" /> Kiểm Tra Sức Khỏe Kế Toán
        </button>
      </div>

      {/* Tab 1: General Ledger Journal */}
      {activeTab === 'journal' && (
        <DataTable columns={journalColumns} data={entries} searchPlaceholder="Tìm mã chứng từ, diễn giải bút toán..." />
      )}

      {/* Tab 2: Chart of Accounts */}
      {activeTab === 'chart' && (
        <DataTable columns={chartColumns} data={accounts} searchPlaceholder="Tìm mã tài khoản, tên tài khoản..." />
      )}

      {/* Tab 3: Account Mapping */}
      {activeTab === 'mapping' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs max-w-3xl">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Cấu Hình Ánh Xạ Tài Khoản Tự Động</h3>
            <p className="text-xs text-zinc-500 mt-1">
              Thiết lập các TK kế toán ngầm định khi tạo Phiếu Nhập kho, Phiếu Xuất kho, Bán hàng & Thu/Chi tiền nợ.
            </p>
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
              Lưu Cấu Hình Hạch Toán Tự Động
            </button>
          </div>
        </div>
      )}

      {/* Tab 4: Trial Balance */}
      {activeTab === 'trial' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 shadow-xs overflow-x-auto">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 uppercase">
            BẢNG CÂN ĐỐI SỐ PHÁT SINH (TRIAL BALANCE)
          </h3>
          <table className="w-full text-left text-xs border border-zinc-200 dark:border-zinc-800">
            <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold">
              <tr>
                <th className="p-2.5 border" rowSpan={2}>Mã TK</th>
                <th className="p-2.5 border" rowSpan={2}>Tên Tài Khoản</th>
                <th className="p-2.5 border text-center" colSpan={2}>Số Dư Đầu Kỳ</th>
                <th className="p-2.5 border text-center" colSpan={2}>Số Phát Sinh Trong Kỳ</th>
                <th className="p-2.5 border text-center" colSpan={2}>Số Dư Cuối Kỳ</th>
              </tr>
              <tr>
                <th className="p-2 border text-right">Nợ</th>
                <th className="p-2 border text-right">Có</th>
                <th className="p-2 border text-right">Nợ</th>
                <th className="p-2 border text-right">Có</th>
                <th className="p-2 border text-right">Nợ</th>
                <th className="p-2 border text-right">Có</th>
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
              <Activity className="h-5 w-5 text-emerald-500" /> Kết Quả Đối Soát Sức Khỏe Kế Toán & Tồn Kho
            </h3>
            <p className="text-xs text-zinc-500">
              Hệ thống tự động kiểm tra tính cân đối giữa Sổ cái Kế toán vs Sổ Kho Thực tế và Sổ Chi tiết Công nợ KH/NCC.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> ĐỐI SOÁT TỒN KHO & TK 156
                </div>
                <p className="text-zinc-700 dark:text-zinc-300">Tồn kho thực tế: <strong>3,450,000,000 đ</strong></p>
                <p className="text-zinc-700 dark:text-zinc-300">Sổ cái TK 156: <strong>3,450,000,000 đ</strong></p>
                <span className="inline-block px-2 py-0.5 rounded-xs bg-emerald-200 text-emerald-800 font-bold">KHỚP 100%</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> CÔNG NỢ KHÁCH HÀNG & TK 131
                </div>
                <p className="text-zinc-700 dark:text-zinc-300">Sổ nợ Khách hàng: <strong>480,000,000 đ</strong></p>
                <p className="text-zinc-700 dark:text-zinc-300">Sổ cái TK 131: <strong>480,000,000 đ</strong></p>
                <span className="inline-block px-2 py-0.5 rounded-xs bg-emerald-200 text-emerald-800 font-bold">KHỚP 100%</span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                  <CheckCircle2 className="h-4 w-4" /> CÂN ĐỐI BÚT TOÁN NỢ / CÓ
                </div>
                <p className="text-zinc-700 dark:text-zinc-300">Tổng Nợ: <strong>1,895,000,000 đ</strong></p>
                <p className="text-zinc-700 dark:text-zinc-300">Tổng Có: <strong>1,895,000,000 đ</strong></p>
                <span className="inline-block px-2 py-0.5 rounded-xs bg-emerald-200 text-emerald-800 font-bold">CÂN ĐỐI</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
