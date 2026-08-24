import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { BarChart3, PieChart, TrendingUp, Users, Truck, ArrowUpDown, Calendar, Loader2, AlertCircle } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SaaSDateFilterBar, DateFilterValue } from '../../components/SaaSDateFilterBar';
import client from '../../api/client';

interface RevenueByCustomer {
  id: number;
  customerName: string;
  orderCount: number;
  totalRevenue: number;
  paidAmount: number;
  debtAmount: number;
}

interface PurchaseBySupplier {
  id: number;
  supplierName: string;
  stockInCount: number;
  totalPurchase: number;
  paidAmount: number;
  debtAmount: number;
}

interface StockMovement {
  id: number;
  sku: string;
  productName: string;
  unit: string;
  openingStock: number;
  stockIn: number;
  stockOut: number;
  closingStock: number;
  closingValue: number;
}

interface ReportData {
  period: { from: string; to: string };
  income: { revenue: number; cogs: number; grossProfit: number; expenses: number; netProfit: number; orderCount: number; outputVat: number };
  balance: { cash: number; receivables: number; inventory: number; assets: number; payables: number; liabilities: number; equity: number };
  customers: RevenueByCustomer[];
  suppliers: PurchaseBySupplier[];
  stockMovements: StockMovement[];
  accounting: { debitTotal: number; creditTotal: number; journalCount: number; balanced: boolean };
}

const emptyReport: ReportData = {
  period: { from: '', to: '' },
  income: { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, orderCount: 0, outputVat: 0 },
  balance: { cash: 0, receivables: 0, inventory: 0, assets: 0, payables: 0, liabilities: 0, equity: 0 },
  customers: [],
  suppliers: [],
  stockMovements: [],
  accounting: { debitTotal: 0, creditTotal: 0, journalCount: 0, balanced: true },
};

const money = (value: number) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;

export const SaaSReportsPage: React.FC = () => {
  const [reportTab, setReportTab] = useState<'income' | 'balance' | 'customer' | 'supplier' | 'stock_movement'>('income');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: 'all', fromDate: '', toDate: '' });
  const [report, setReport] = useState<ReportData>(emptyReport);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (dateFilter.fromDate) params.set('from', dateFilter.fromDate);
    if (dateFilter.toDate) params.set('to', dateFilter.toDate);
    setLoading(true);
    setError(null);
    client.get(`/api/saas/reports/summary?${params.toString()}`)
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.ok) throw new Error(response.data?.message || 'Không tải được báo cáo.');
        setReport({ ...emptyReport, ...response.data.data });
      })
      .catch((requestError: any) => {
        if (!cancelled) setError(requestError?.response?.data?.message || requestError.message || 'Không tải được báo cáo từ cơ sở dữ liệu.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [dateFilter.fromDate, dateFilter.toDate]);

  const customerColumns: ColumnDef<RevenueByCustomer>[] = [
    { accessorKey: 'customerName', header: 'Tên Khách Hàng', cell: (info) => <span className="font-bold">{info.getValue() as string}</span> },
    { accessorKey: 'orderCount', header: 'Số Đơn' },
    { accessorKey: 'totalRevenue', header: 'Doanh Thu', cell: (info) => <span className="font-bold text-emerald-600">{money(info.getValue() as number)}</span> },
    { accessorKey: 'paidAmount', header: 'Đã Thanh Toán', cell: (info) => money(info.getValue() as number) },
    { accessorKey: 'debtAmount', header: 'Còn Nợ', cell: (info) => <span className="font-bold text-amber-600">{money(info.getValue() as number)}</span> },
  ];

  const supplierColumns: ColumnDef<PurchaseBySupplier>[] = [
    { accessorKey: 'supplierName', header: 'Nhà Cung Cấp', cell: (info) => <span className="font-bold">{info.getValue() as string}</span> },
    { accessorKey: 'stockInCount', header: 'Số Lần Nhập' },
    { accessorKey: 'totalPurchase', header: 'Tổng Giá Trị Mua', cell: (info) => <span className="font-bold text-purple-600">{money(info.getValue() as number)}</span> },
    { accessorKey: 'paidAmount', header: 'Đã Thanh Toán', cell: (info) => money(info.getValue() as number) },
    { accessorKey: 'debtAmount', header: 'Nợ Phải Trả', cell: (info) => <span className="font-bold text-red-600">{money(info.getValue() as number)}</span> },
  ];

  const stockColumns: ColumnDef<StockMovement>[] = [
    { accessorKey: 'sku', header: 'Mã SKU', cell: (info) => <span className="font-mono font-bold text-amber-600">{info.getValue() as string}</span> },
    { accessorKey: 'productName', header: 'Sản Phẩm' },
    { accessorKey: 'openingStock', header: 'Tồn Đầu Kỳ' },
    { accessorKey: 'stockIn', header: 'Nhập Trong Kỳ', cell: (info) => <span className="text-emerald-600">+{info.getValue() as number}</span> },
    { accessorKey: 'stockOut', header: 'Xuất Trong Kỳ', cell: (info) => <span className="text-red-600">-{info.getValue() as number}</span> },
    { accessorKey: 'closingStock', header: 'Tồn Cuối Kỳ', cell: (info) => <span className="font-bold">{info.getValue() as number} {info.row.original.unit}</span> },
    { accessorKey: 'closingValue', header: 'Giá Trị Tồn', cell: (info) => <span className="font-bold text-amber-600">{money(info.getValue() as number)}</span> },
  ];

  const tab = (key: typeof reportTab, icon: React.ReactNode, label: string) => (
    <button onClick={() => setReportTab(key)} className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${reportTab === key ? 'bg-amber-500 text-zinc-950' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2"><BarChart3 className="h-6 w-6 text-amber-500" /> Báo Cáo Tài Chính & Kinh Doanh</h2>
          <p className="text-xs text-zinc-500 mt-1">Số liệu được tổng hợp trực tiếp từ sổ bán hàng, mua hàng, kho và kế toán của tenant hiện tại.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300"><Calendar className="h-4 w-4 text-amber-500" />{report.period.from || '1900-01-01'} → {report.period.to || 'hôm nay'}</div>
      </div>

      <SaaSDateFilterBar onFilterChange={setDateFilter} />
      {error && <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
      {loading && <div className="flex items-center gap-2 text-xs text-zinc-500"><Loader2 className="h-4 w-4 animate-spin" /> Đang tải báo cáo thực từ PostgreSQL...</div>}

      <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-2">
        {tab('income', <TrendingUp className="h-4 w-4" />, 'KQ Kinh Doanh (P&L)')}
        {tab('balance', <PieChart className="h-4 w-4" />, 'Bảng Cân Đối')}
        {tab('stock_movement', <ArrowUpDown className="h-4 w-4" />, 'Xuất - Nhập - Tồn')}
        {tab('customer', <Users className="h-4 w-4" />, 'Doanh Thu Khách Hàng')}
        {tab('supplier', <Truck className="h-4 w-4" />, 'Mua Hàng Nhà Cung Cấp')}
      </div>

      {reportTab === 'income' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ['Doanh thu bán hàng', report.income.revenue, 'text-emerald-600'],
            ['Giá vốn hàng bán', report.income.cogs, 'text-red-600'],
            ['Lợi nhuận gộp', report.income.grossProfit, 'text-amber-600'],
            ['Lợi nhuận thuần', report.income.netProfit, 'text-blue-600'],
          ].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5"><p className="text-xs text-zinc-500">{label}</p><p className={`mt-2 text-xl font-bold ${color}`}>{money(Number(value))}</p></div>)}
          <div className="sm:col-span-2 lg:col-span-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 text-sm"><div className="flex justify-between"><span>Số đơn hàng đã ghi nhận</span><strong>{report.income.orderCount}</strong></div><div className="flex justify-between mt-2"><span>VAT đầu ra</span><strong>{money(report.income.outputVat)}</strong></div></div>
        </div>
      )}

      {reportTab === 'balance' && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[['Tổng tài sản', report.balance.assets], ['Tiền và tương đương tiền', report.balance.cash], ['Phải thu khách hàng', report.balance.receivables], ['Hàng tồn kho', report.balance.inventory], ['Nợ phải trả', report.balance.liabilities], ['Vốn chủ sở hữu', report.balance.equity]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex justify-between text-sm"><span>{label}</span><strong>{money(Number(value))}</strong></div>)}</div>}
      {reportTab === 'stock_movement' && <DataTable columns={stockColumns} data={report.stockMovements} searchPlaceholder="Tìm mã SKU, tên hàng hóa..." />}
      {reportTab === 'customer' && <DataTable columns={customerColumns} data={report.customers} searchPlaceholder="Tìm tên khách hàng..." />}
      {reportTab === 'supplier' && <DataTable columns={supplierColumns} data={report.suppliers} searchPlaceholder="Tìm tên nhà cung cấp..." />}

      <div className={`rounded-xl border px-4 py-3 text-xs ${report.accounting.balanced ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
        Đối soát bút toán: {report.accounting.balanced ? 'cân đối' : 'chưa cân đối'} · Nợ {money(report.accounting.debitTotal)} · Có {money(report.accounting.creditTotal)} · {report.accounting.journalCount} bút toán
      </div>
    </div>
  );
};
