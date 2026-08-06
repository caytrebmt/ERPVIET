import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { BarChart3, PieChart, FileText, TrendingUp, Users, Truck, ArrowUpDown, Calendar } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SaaSDateFilterBar, DateFilterValue } from '../../components/SaaSDateFilterBar';

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

export const SaaSReportsPage: React.FC = () => {
  const [reportTab, setReportTab] = useState<'income' | 'balance' | 'customer' | 'supplier' | 'stock_movement'>('income');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: 'all', fromDate: '', toDate: '' });

  // Sample data for Customer Revenue
  const [customerRevenues] = useState<RevenueByCustomer[]>([
    {
      id: 1,
      customerName: 'Công ty TNHH Giải Pháp Công Nghệ Việt',
      orderCount: 12,
      totalRevenue: 480000000,
      paidAmount: 435000000,
      debtAmount: 45000000,
    },
    {
      id: 2,
      customerName: 'Nguyễn Văn Minh (Cửa hàng Tin Học)',
      orderCount: 8,
      totalRevenue: 185000000,
      paidAmount: 172500000,
      debtAmount: 12500000,
    },
    {
      id: 3,
      customerName: 'Trần Thị Thu Hà',
      orderCount: 3,
      totalRevenue: 28000000,
      paidAmount: 28000000,
      debtAmount: 0,
    },
  ]);

  // Sample data for Supplier Purchase
  const [supplierPurchases] = useState<PurchaseBySupplier[]>([
    {
      id: 1,
      supplierName: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
      stockInCount: 15,
      totalPurchase: 650000000,
      paidAmount: 530000000,
      debtAmount: 120000000,
    },
    {
      id: 2,
      supplierName: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
      stockInCount: 9,
      totalPurchase: 420000000,
      paidAmount: 360000000,
      debtAmount: 60000000,
    },
  ]);

  // Sample data for Stock Movement
  const [stockMovements] = useState<StockMovement[]>([
    {
      id: 1,
      sku: 'SP001',
      productName: 'Laptop Dell Inspiron 15 3520',
      unit: 'Cái',
      openingStock: 10,
      stockIn: 20,
      stockOut: 15,
      closingStock: 15,
      closingValue: 232500000,
    },
    {
      id: 2,
      sku: 'VT001',
      productName: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
      unit: 'Ream',
      openingStock: 100,
      stockIn: 200,
      stockOut: 180,
      closingStock: 120,
      closingValue: 6240000,
    },
  ]);

  const customerColumns: ColumnDef<RevenueByCustomer>[] = [
    {
      accessorKey: 'customerName',
      header: 'Tên Khách Hàng',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'orderCount',
      header: 'Số Đơn Xuất',
      cell: (info) => `${info.getValue() as number} đơn`,
    },
    {
      accessorKey: 'totalRevenue',
      header: 'Doanh Thu Thu Được',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'paidAmount',
      header: 'Đã Thanh Toán',
      cell: (info) => `${(info.getValue() as number).toLocaleString('vi-VN')} đ`,
    },
    {
      accessorKey: 'debtAmount',
      header: 'Còn Nợ Đọng',
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  const supplierColumns: ColumnDef<PurchaseBySupplier>[] = [
    {
      accessorKey: 'supplierName',
      header: 'Nhà Cung Cấp',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'stockInCount',
      header: 'Số Lần Nhập',
    },
    {
      accessorKey: 'totalPurchase',
      header: 'Tổng Giá Trị Mua',
      cell: (info) => (
        <span className="font-bold text-purple-600 dark:text-purple-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'paidAmount',
      header: 'Đã Thanh Toán',
      cell: (info) => `${(info.getValue() as number).toLocaleString('vi-VN')} đ`,
    },
    {
      accessorKey: 'debtAmount',
      header: 'Nợ Phải Trả',
      cell: (info) => (
        <span className="font-bold text-red-600 dark:text-red-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  const stockMovementColumns: ColumnDef<StockMovement>[] = [
    {
      accessorKey: 'sku',
      header: 'Mã SKU',
      cell: (info) => <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'productName',
      header: 'Sản Phẩm',
      cell: (info) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'openingStock',
      header: 'Tồn Đầu Kỳ',
    },
    {
      accessorKey: 'stockIn',
      header: 'Nhập Trong Kỳ',
      cell: (info) => <span className="text-emerald-600 font-bold">+{info.getValue() as number}</span>,
    },
    {
      accessorKey: 'stockOut',
      header: 'Xuất Trong Kỳ',
      cell: (info) => <span className="text-red-600 font-bold">-{info.getValue() as number}</span>,
    },
    {
      accessorKey: 'closingStock',
      header: 'Tồn Cuối Kỳ',
      cell: (info) => (
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          {info.getValue() as number} {info.row.original.unit}
        </span>
      ),
    },
    {
      accessorKey: 'closingValue',
      header: 'Giá Trị Tồn Cuối Kỳ',
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-amber-500" /> Báo Cáo Tài Chính & Tổng Hợp Kinh Doanh
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Báo cáo KQKD, Bảng cân đối kế toán, Xuất-Nhập-Tồn và Phân tích doanh thu khách hàng (`/app/templates/reports/`).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-1.5 rounded-lg text-xs">
          <Calendar className="h-4 w-4 text-amber-500" />
          <span className="font-bold">Kỳ báo cáo: Tháng 07/2026</span>
        </div>
      </div>

      <SaaSDateFilterBar onFilterChange={(val) => setDateFilter(val)} />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setReportTab('income')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            reportTab === 'income' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> KQ Kinh Doanh (P&L)
        </button>

        <button
          onClick={() => setReportTab('balance')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            reportTab === 'balance' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <PieChart className="h-4 w-4" /> Bảng Cân Đối Kế Toán
        </button>

        <button
          onClick={() => setReportTab('stock_movement')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            reportTab === 'stock_movement' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <ArrowUpDown className="h-4 w-4" /> Báo Cáo Xuất - Nhập - Tồn
        </button>

        <button
          onClick={() => setReportTab('customer')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            reportTab === 'customer' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Users className="h-4 w-4" /> Doanh Thu Khách Hàng
        </button>

        <button
          onClick={() => setReportTab('supplier')}
          className={`px-3.5 py-2 text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5 ${
            reportTab === 'supplier' ? 'bg-amber-500 text-zinc-950 shadow-xs' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
        >
          <Truck className="h-4 w-4" /> Mua Hàng Nhà Cung Cấp
        </button>
      </div>

      {/* Tab Content Display */}
      {reportTab === 'income' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs">
          <div className="border-b pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase">BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH</h3>
            <p className="text-xs text-zinc-500">Mẫu số B02-DN theo Thông tư Kế toán doanh nghiệp</p>
          </div>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">1. Doanh thu bán hàng và cung cấp dịch vụ</span>
              <span className="font-bold text-zinc-900 dark:text-zinc-100">1,285,000,000 đ</span>
            </div>
            <div className="flex justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">2. Giá vốn hàng bán (COGS)</span>
              <span className="font-bold text-red-600 dark:text-red-400">-940,000,000 đ</span>
            </div>
            <div className="flex justify-between p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg">
              <span className="font-bold text-amber-700 dark:text-amber-300">3. Lợi nhuận gộp về bán hàng (1 - 2)</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 text-base">345,000,000 đ</span>
            </div>
            <div className="flex justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">4. Chi phí quản lý doanh nghiệp & bán hàng</span>
              <span className="font-bold text-red-600 dark:text-red-400">-65,000,000 đ</span>
            </div>
            <div className="flex justify-between p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-base">5. Lợi nhuận thuần trước thuế</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">280,000,000 đ</span>
            </div>
          </div>
        </div>
      )}

      {reportTab === 'balance' && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-6 shadow-xs">
          <div className="border-b pb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase">BẢNG CÂN ĐỐI KẾ TOÁN</h3>
            <p className="text-xs text-zinc-500">Mẫu số B01-DN (Tài sản & Nguồn vốn cân đối)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Assets */}
            <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h4 className="font-bold text-sm text-blue-600 dark:text-blue-400 border-b pb-2 uppercase">A. TÀI SẢN (3,890,000,000 đ)</h4>
              <div className="flex justify-between">
                <span>1. Tiền và các khoản tương đương tiền</span>
                <span className="font-bold">200,000,000 đ</span>
              </div>
              <div className="flex justify-between">
                <span>2. Phải thu ngắn hạn của khách hàng</span>
                <span className="font-bold">240,000,000 đ</span>
              </div>
              <div className="flex justify-between">
                <span>3. Hàng tồn kho lưu kho</span>
                <span className="font-bold text-amber-600">3,450,000,000 đ</span>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h4 className="font-bold text-sm text-purple-600 dark:text-purple-400 border-b pb-2 uppercase">B. NGUỒN VỐN (3,890,000,000 đ)</h4>
              <div className="flex justify-between">
                <span>1. Nợ phải trả nhà cung cấp</span>
                <span className="font-bold text-purple-600">180,000,000 đ</span>
              </div>
              <div className="flex justify-between">
                <span>2. Thuế và các khoản phải nộp Nhà nước</span>
                <span className="font-bold">110,000,000 đ</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="font-bold">3. Vốn chủ sở hữu & Lợi nhuận giữ lại</span>
                <span className="font-bold text-emerald-600">3,600,000,000 đ</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportTab === 'stock_movement' && (
        <DataTable columns={stockMovementColumns} data={stockMovements} searchPlaceholder="Tìm mã SKU, tên hàng hóa..." />
      )}

      {reportTab === 'customer' && (
        <DataTable columns={customerColumns} data={customerRevenues} searchPlaceholder="Tìm tên khách hàng..." />
      )}

      {reportTab === 'supplier' && (
        <DataTable columns={supplierColumns} data={supplierPurchases} searchPlaceholder="Tìm tên nhà cung cấp..." />
      )}
    </div>
  );
};
