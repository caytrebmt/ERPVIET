import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  TrendingUp,
  DollarSign,
  PackageCheck,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
} from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../services/api';

interface StockAlertItem {
  id: number;
  sku: string;
  name: string;
  nameEn?: string;
  category: string;
  categoryEn?: string;
  stock: number;
  minStock: number;
  unit: string;
  unitEn?: string;
  salePrice: number;
}

export const SaaSDashboardPage: React.FC = () => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    monthlyRevenue: 1285000000,
    inventoryValue: 3450000000,
    receivables: 240000000,
    payables: 180000000,
    totalOrders: 142,
  });

  const [alerts, setAlerts] = useState<StockAlertItem[]>([
    {
      id: 1,
      sku: 'SP001',
      name: 'Laptop Dell Inspiron 15 3520',
      nameEn: 'Laptop Dell Inspiron 15 3520',
      category: 'Laptop',
      categoryEn: 'Laptop',
      stock: 2,
      minStock: 5,
      unit: 'Cái',
      unitEn: 'Pcs',
      salePrice: 18000000,
    },
    {
      id: 2,
      sku: 'VT002',
      name: 'Bìa thái A4 400G (Tệp 100 tờ)',
      nameEn: 'A4 Colored Cardboard 400G (100 Sheets Pack)',
      category: 'Văn phòng phẩm',
      categoryEn: 'Stationery',
      stock: 4,
      minStock: 10,
      unit: 'Tệp',
      unitEn: 'Pack',
      salePrice: 85000,
    },
    {
      id: 3,
      sku: 'VT006',
      name: 'Bìa thái A4 500G cao cấp',
      nameEn: 'Premium A4 Colored Cardboard 500G',
      category: 'Văn phòng phẩm',
      categoryEn: 'Stationery',
      stock: 3,
      minStock: 10,
      unit: 'Tệp',
      unitEn: 'Pack',
      salePrice: 95000,
    },
  ]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get('/shop/catalog');
        if (res.data?.ok && Array.isArray(res.data.data?.products)) {
          const prods = res.data.data.products;
          const lowStock = prods
            .filter((p: any) => p.stock <= (p.minStock || 5))
            .map((p: any) => ({
              id: p.id,
              sku: p.sku,
              name: p.name,
              nameEn: p.nameEn || p.name,
              category: p.categoryId === 2 ? 'Laptop' : 'Văn phòng phẩm',
              categoryEn: p.categoryId === 2 ? 'Laptop' : 'Stationery',
              stock: p.stock,
              minStock: p.minStock || 5,
              unit: p.unit || 'Cái',
              unitEn: p.unit === 'Tệp' ? 'Pack' : 'Pcs',
              salePrice: p.salePrice,
            }));
          if (lowStock.length > 0) setAlerts(lowStock);
        }
      } catch (err) {
        console.warn('API error, using default SaaS stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const alertColumns: ColumnDef<StockAlertItem>[] = [
    {
      accessorKey: 'sku',
      header: isEn ? 'SKU Code' : 'Mã SKU',
      cell: (info) => (
        <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: isEn ? 'Product Name' : 'Tên Sản Phẩm',
      cell: (info) => (
        <span className="font-medium text-zinc-900 dark:text-zinc-100">
          {isEn
            ? info.row.original.nameEn || (info.getValue() as string)
            : (info.getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: 'category',
      header: isEn ? 'Category' : 'Danh Mục',
      cell: (info) => (
        <span className="text-zinc-700 dark:text-zinc-300">
          {isEn
            ? info.row.original.categoryEn || (info.getValue() as string)
            : (info.getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: 'stock',
      header: isEn ? 'Current Stock' : 'Tồn Kho Hiện Tại',
      cell: (info) => {
        const stock = info.getValue() as number;
        const unitLabel = isEn
          ? info.row.original.unitEn || (info.row.original.unit === 'Cái' ? 'Pcs' : 'Pack')
          : info.row.original.unit;
        return (
          <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-2.5 py-1 rounded-md text-xs border border-red-200 dark:border-red-800">
            <AlertTriangle className="h-3 w-3" /> {stock} {unitLabel}
          </span>
        );
      },
    },
    {
      accessorKey: 'minStock',
      header: isEn ? 'Min Safety Stock' : 'Định Mức Tối Thiểu',
      cell: (info) => {
        const unitLabel = isEn
          ? info.row.original.unitEn || (info.row.original.unit === 'Cái' ? 'Pcs' : 'Pack')
          : info.row.original.unit;
        return `${info.getValue() as number} ${unitLabel}`;
      },
    },
    {
      accessorKey: 'salePrice',
      header: isEn ? 'Selling Price' : 'Đơn Giá Bán',
      cell: (info) => `${(info.getValue() as number).toLocaleString(isEn ? 'en-US' : 'vi-VN')} đ`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* SaaS Welcome Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-amber-950 rounded-2xl p-6 text-white shadow-lg border border-zinc-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
          {/*  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              SaaS Cloud ERP v4.2
            </span>
          */}  
            <h2 className="text-2xl font-bold mt-2">
              {isEn ? 'Enterprise Operations Overview' : 'Tổng quan hoạt động doanh nghiệp'}
            </h2>
            <p className="text-sm text-zinc-300 mt-1 max-w-2xl">
              {isEn
                ? 'Automated real-time inventory, general ledger, VAT invoices, and accounts receivable sync via Python JWT backend.'
                : 'Hệ thống tự động đồng bộ kho, kế toán, hóa đơn VAT và công nợ.'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monthly Revenue */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {isEn ? 'Monthly Revenue' : 'Doanh Thu Tháng Này'}
            </span>
            <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.monthlyRevenue.toLocaleString(isEn ? 'en-US' : 'vi-VN')} đ
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-600 font-medium">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>{isEn ? '+18.4% vs last month' : '+18.4% so với tháng trước'}</span>
            </div>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {isEn ? 'Total Inventory Value' : 'Tổng Giá Trị Tồn Kho'}
            </span>
            <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.inventoryValue.toLocaleString(isEn ? 'en-US' : 'vi-VN')} đ
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {isEn ? '10 product categories in warehouse' : '10 danh mục hàng hóa đang lưu kho'}
            </p>
          </div>
        </div>

        {/* Receivables */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {isEn ? 'Accounts Receivable' : 'Phải Thu Khách Hàng'}
            </span>
            <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.receivables.toLocaleString(isEn ? 'en-US' : 'vi-VN')} đ
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <span>{isEn ? '8 customers with outstanding balance' : '8 khách hàng có nợ đọng'}</span>
            </div>
          </div>
        </div>

        {/* Payables */}
        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {isEn ? 'Accounts Payable' : 'Phải Trả Nhà Cung Cấp'}
            </span>
            <div className="h-9 w-9 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {stats.payables.toLocaleString(isEn ? 'en-US' : 'vi-VN')} đ
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {isEn ? 'Payment due within 30 days' : 'Hạn thanh toán trong 30 ngày'}
            </p>
          </div>
        </div>
      </div>

      {/* TanStack Table: Stock Alert Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />{' '}
              {isEn ? 'Low Stock Product Alert' : 'Cảnh Báo Sản Phẩm Sắp Hết Hàng'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {isEn
                ? 'Products with stock below minimum safety threshold requiring immediate stock-in replenishment.'
                : 'Sản phẩm có tồn kho dưới định mức tối thiểu cần bổ sung phiếu nhập ngay.'}
            </p>
          </div>
        </div>

        <DataTable
          columns={alertColumns}
          data={alerts}
          searchPlaceholder={
            isEn ? 'Search SKU code or product alert name...' : 'Tìm kiếm mã SKU hoặc tên sản phẩm cảnh báo...'
          }
        />
      </div>
    </div>
  );
};

