import React, { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpRight, Plus, CheckCircle2, Clock, Printer, Edit2, Trash2, X, FileText, AlertCircle, ShoppingBag, Globe, RefreshCw, Calculator } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SaaSPrintModal } from '../../components/SaaSPrintModal';
import { SaaSDateFilterBar, DateFilterValue, filterByDateRange } from '../../components/SaaSDateFilterBar';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { generateERPCode, readVietnameseNumber } from '../../utils/format';
import client from '../../api/client';

interface StockOutLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  stock: number;
  quantity: number;
  factor: number;
  unitPrice: number;
  vatRate: number;
}

interface StockOutVoucher {
  id: number;
  code: string;
  date: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  warehouse: string;
  invoiceNo: string;
  invoiceSeries: string;
  note: string;
  vatMode: 'grouped' | 'per_item';
  vatRateGrouped: number;
  items: StockOutLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentStatus: 'Đã thanh toán' | 'Còn nợ' | 'Thanh toán một phần';
  status: 'Nháp' | 'Đã xác nhận' | 'Đã hủy';
  createdBy: string;
  sourceWebCode?: string;
}

interface WebShopOrder {
  id: string;
  code: string; // WEB-260730-001
  date: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  productName: string;
  sku: string;
  quantity: number;
  amount: number;
  status: 'Chờ duyệt xuất kho' | 'Đã duyệt & Xuất kho (PX)';
}

const SAMPLE_PRODUCTS = [];

const SAMPLE_CUSTOMERS = [];

export const SaaSStockOutPage: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'erp' | 'webshop'>('erp');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: 'all', fromDate: '', toDate: '' });

  const [webOrders, setWebOrders] = useState<WebShopOrder[]>([]);

  useEffect(() => {
    const fetchWebOrders = async () => {
      try {
        const res = await client.get('/api/shop/orders?admin=true&per_page=100');
        if (res.data?.ok && Array.isArray(res.data.data?.items) && res.data.data.items.length > 0) {
          const items: WebShopOrder[] = res.data.data.items.map((o: any) => ({
            id: String(o.id),
            code: o.code,
            date: o.createdAt ? new Date(o.createdAt).toLocaleString('vi-VN') : '2026-07-30 08:30',
            customerName: o.customerName || 'Khách Hàng Web',
            customerPhone: o.customerPhone || '',
            customerAddress: o.shippingAddress || '',
            productName: o.items?.[0]?.name || 'Sản phẩm WebShop',
            sku: o.items?.[0]?.sku || 'SKU-WEB',
            quantity: o.items?.[0]?.quantity || 1,
            amount: o.total_amount || 0,
            status: o.erp_status?.includes('PXK') || o.erp_status?.includes('duyệt') || o.erp_status?.includes('xuất kho') || o.erp_status?.includes('Đóng gói') || o.erp_status?.includes('Shipper') || o.erp_status?.includes('thành công')
              ? 'Đã duyệt & Xuất kho (PX)'
              : 'Chờ duyệt xuất kho',
          }));
          setWebOrders(items);
        }
      } catch (err) {
        console.warn('Failed to load web orders:', err);
      }
    };

    fetchWebOrders();
  }, []);

  const [stockOuts, setStockOuts] = useState<StockOutVoucher[]>([]);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedStockOut, setSelectedStockOut] = useState<StockOutVoucher | null>(null);

  // Voucher Form State
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<StockOutVoucher | null>(null);

  const [voucherForm, setVoucherForm] = useState({
    code: '',
    date: new Date().toISOString().slice(0, 10),
    customerId: 'c1',
    warehouse: 'Kho Chính - Hà Nội',
    invoiceNo: '',
    invoiceSeries: 'C26TVN',
    note: '',
    vatMode: 'grouped' as 'grouped' | 'per_item',
    vatRateGrouped: 10,
    paymentStatus: 'Còn nợ' as 'Đã thanh toán' | 'Còn nợ' | 'Thanh toán một phần',
    status: 'Đã xác nhận' as 'Nháp' | 'Đã xác nhận',
  });

  const [lineItems, setLineItems] = useState<StockOutLineItem[]>([
    {
      id: 'item-1',
      productId: 'p1',
      productName: 'Laptop Dell Inspiron 15 3520 (i5/16GB/512GB)',
      sku: 'SP001',
      unit: 'Cái',
      stock: 45,
      quantity: 1,
      factor: 1,
      unitPrice: 18000000,
      vatRate: 10,
    },
  ]);

  const handleOpenPrint = (item: StockOutVoucher) => {
    setSelectedStockOut(item);
    setPrintModalOpen(true);
  };

  const handleApproveWebOrder = (order: WebShopOrder) => {
    const pxCode = generateERPCode('PX', stockOuts.length + 1);
    const nowStr = new Date().toISOString().slice(0, 10);

    const newPX: StockOutVoucher = {
      id: Date.now(),
      code: pxCode,
      date: `${nowStr} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      customerId: 'c_web',
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      warehouse: 'Kho Chính - Hà Nội',
      invoiceNo: `INV-${order.code}`,
      invoiceSeries: 'C26WEB',
      note: `Xuất kho tự động cho Đơn Hàng Web ${order.code}`,
      vatMode: 'grouped',
      vatRateGrouped: 10,
      items: [
        {
          id: `line-${Date.now()}`,
          productId: 'p_web',
          productName: order.productName,
          sku: order.sku,
          unit: 'Cái',
          stock: 50,
          quantity: order.quantity,
          factor: 1,
          unitPrice: order.amount / order.quantity,
          vatRate: 10,
        },
      ],
      subtotal: order.amount,
      vatAmount: Math.round(order.amount * 0.1),
      totalAmount: Math.round(order.amount * 1.1),
      paymentStatus: 'Đã thanh toán',
      status: 'Đã xác nhận',
      createdBy: 'Hệ Thống WebShop Sync',
      sourceWebCode: order.code,
    };

    setStockOuts([newPX, ...stockOuts]);
    setWebOrders(
      webOrders.map((w) => (w.id === order.id ? { ...w, status: 'Đã duyệt & Xuất kho (PX)' } : w))
    );

    // Call API sync
    client.post(`/api/shop/orders/${order.code}/erp-status`, {
      erpStatus: `Đã duyệt - Đã lập PXK #${pxCode}`,
      erpNote: `Đã duyệt kho & tự động xuất kho theo phiếu ${pxCode}`,
    }).catch((err) => console.warn('Lỗi đồng bộ ERP Status sang Server:', err));

    addToast(`Đã duyệt đơn web ${order.code} -> Tạo phiếu xuất kho ${pxCode} thành công!`, 'success');
  };

  const handleOpenAddVoucher = () => {
    setEditingVoucher(null);
    const nextCode = generateERPCode('PX', stockOuts.length + 1);
    setVoucherForm({
      code: nextCode,
      date: new Date().toISOString().slice(0, 10),
      customerId: 'c1',
      warehouse: 'Kho Chính - Hà Nội',
      invoiceNo: '',
      invoiceSeries: 'C26TVN',
      note: '',
      vatMode: 'grouped',
      vatRateGrouped: 10,
      paymentStatus: 'Còn nợ',
      status: 'Đã xác nhận',
    });
    setLineItems([
      {
        id: `item-${Date.now()}`,
        productId: 'p1',
        productName: 'Laptop Dell Inspiron 15 3520 (i5/16GB/512GB)',
        sku: 'SP001',
        unit: 'Cái',
        stock: 45,
        quantity: 1,
        factor: 1,
        unitPrice: 18000000,
        vatRate: 10,
      },
    ]);
    setShowVoucherModal(true);
  };

  const handleOpenEditVoucher = (v: StockOutVoucher) => {
    setEditingVoucher(v);
    setVoucherForm({
      code: v.code,
      date: v.date.split(' ')[0],
      customerId: v.customerId,
      warehouse: v.warehouse,
      invoiceNo: v.invoiceNo,
      invoiceSeries: v.invoiceSeries,
      note: v.note,
      vatMode: v.vatMode,
      vatRateGrouped: v.vatRateGrouped,
      paymentStatus: v.paymentStatus,
      status: v.status === 'Đã hủy' ? 'Nháp' : v.status,
    });
    setLineItems(v.items.length > 0 ? v.items : []);
    setShowVoucherModal(true);
  };

  const handleAddLineItem = () => {
    const defaultProd = SAMPLE_PRODUCTS[0];
    const newItem: StockOutLineItem = {
      id: `item-${Date.now()}`,
      productId: defaultProd.id,
      productName: defaultProd.name,
      sku: defaultProd.sku,
      unit: defaultProd.unit,
      stock: defaultProd.stock,
      quantity: 1,
      factor: 1,
      unitPrice: defaultProd.price,
      vatRate: 10,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      addToast('Phiếu xuất kho phải có ít nhất 1 mặt hàng!', 'warning');
      return;
    }
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleProductChange = (lineId: string, productId: string) => {
    const prod = SAMPLE_PRODUCTS.find((p) => p.id === productId);
    if (!prod) return;
    setLineItems(
      lineItems.map((item) =>
        item.id === lineId
          ? {
              ...item,
              productId: prod.id,
              productName: prod.name,
              sku: prod.sku,
              unit: prod.unit,
              stock: prod.stock,
              unitPrice: prod.price,
            }
          : item
      )
    );
  };

  const handleLineChange = (lineId: string, field: keyof StockOutLineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => (item.id === lineId ? { ...item, [field]: value } : item))
    );
  };

  // Calculations
  const calcSubtotal = lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);

  const calcVatAmount = () => {
    if (voucherForm.vatMode === 'grouped') {
      return (calcSubtotal * voucherForm.vatRateGrouped) / 100;
    } else {
      return lineItems.reduce(
        (acc, item) => acc + (item.quantity * item.unitPrice * (item.vatRate || 0)) / 100,
        0
      );
    }
  };

  const calcTotalAmount = calcSubtotal + calcVatAmount();

  const handleSaveVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) {
      addToast('Vui lòng thêm ít nhất 1 hàng hóa vào phiếu xuất!', 'error');
      return;
    }

    const cust = SAMPLE_CUSTOMERS.find((c) => c.id === voucherForm.customerId) || SAMPLE_CUSTOMERS[0];

    const sub = calcSubtotal;
    const vat = calcVatAmount();
    const total = calcTotalAmount;

    if (editingVoucher) {
      setStockOuts(
        stockOuts.map((v) =>
          v.id === editingVoucher.id
            ? {
                ...v,
                code: voucherForm.code,
                date: `${voucherForm.date} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
                customerId: cust.id,
                customerName: cust.name,
                customerPhone: cust.phone,
                customerAddress: cust.address,
                warehouse: voucherForm.warehouse,
                invoiceNo: voucherForm.invoiceNo,
                invoiceSeries: voucherForm.invoiceSeries,
                note: voucherForm.note,
                vatMode: voucherForm.vatMode,
                vatRateGrouped: voucherForm.vatRateGrouped,
                items: lineItems,
                subtotal: sub,
                vatAmount: vat,
                totalAmount: total,
                paymentStatus: voucherForm.paymentStatus,
                status: voucherForm.status,
              }
            : v
        )
      );
      addToast(`Đã cập nhật phiếu xuất kho "${voucherForm.code}" thành công!`, 'success');
    } else {
      const newVoucher: StockOutVoucher = {
        id: Date.now(),
        code: voucherForm.code,
        date: `${voucherForm.date} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
        customerId: cust.id,
        customerName: cust.name,
        customerPhone: cust.phone,
        customerAddress: cust.address,
        warehouse: voucherForm.warehouse,
        invoiceNo: voucherForm.invoiceNo,
        invoiceSeries: voucherForm.invoiceSeries,
        note: voucherForm.note,
        vatMode: voucherForm.vatMode,
        vatRateGrouped: voucherForm.vatRateGrouped,
        items: lineItems,
        subtotal: sub,
        vatAmount: vat,
        totalAmount: total,
        paymentStatus: voucherForm.paymentStatus,
        status: voucherForm.status,
        createdBy: 'SaaS Admin',
      };
      setStockOuts([newVoucher, ...stockOuts]);
      addToast(`Đã lập phiếu xuất kho mới "${newVoucher.code}" thành công!`, 'success');
    }
    setShowVoucherModal(false);
  };

  const handleDeleteVoucher = (id: number, code: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa phiếu xuất kho "${code}"?`)) {
      setStockOuts(stockOuts.filter((s) => s.id !== id));
      addToast(`Đã xóa phiếu xuất kho "${code}"`, 'warning');
    }
  };

  const columns: ColumnDef<StockOutVoucher>[] = [
    {
      accessorKey: 'code',
      header: 'Mã Phiếu Xuất',
      cell: ({ row, getValue }) => (
        <button
          onClick={() => handleOpenPrint(row.original)}
          className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer p-0 bg-transparent inline-flex items-center gap-1"
          title="Click vào mã phiếu để xem chi tiết / in chứng từ"
        >
          {getValue() as string}
        </button>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Ngày Xuất Hàng',
      cell: (info) => <span className="text-xs text-zinc-600 dark:text-zinc-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'customerName',
      header: 'Khách Hàng',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'warehouse',
      header: 'Kho Xuất',
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng Giá Trị (Cả VAT)',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Thanh Toán',
      cell: (info) => {
        const val = info.getValue() as string;
        const isPaid = val === 'Đã thanh toán';
        return (
          <span
            className={`text-xs font-bold inline-flex items-center gap-1 ${
              isPaid
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {isPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
            {val}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: (info) => {
        const val = info.getValue() as string;
        return (
          <span
            className={`text-xs font-bold ${
              val === 'Đã xác nhận'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            {val}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenPrint(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="In Phiếu Xuất Kho chuẩn ERP"
          >
            <Printer className="h-4 w-4 text-blue-500" />
          </button>
          <button
            onClick={() => handleOpenEditVoucher(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Chỉnh sửa phiếu xuất"
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDeleteVoucher(row.original.id, row.original.code)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title="Xóa phiếu"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const webColumns: ColumnDef<WebShopOrder>[] = [
    {
      accessorKey: 'code',
      header: 'Mã Đơn Web',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-xs border border-blue-200 dark:border-blue-800">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Thời Gian Đặt',
      cell: (info) => <span className="text-xs text-zinc-600 dark:text-zinc-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'customerName',
      header: 'Khách Hàng',
      cell: (info) => (
        <div className="text-xs">
          <p className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</p>
          <p className="text-[11px] text-zinc-500">{info.row.original.customerPhone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'productName',
      header: 'Sản Phẩm Đặt Mua',
      cell: (info) => (
        <div className="text-xs max-w-xs">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 block truncate">{info.getValue() as string}</span>
          <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">SKU: {info.row.original.sku} | SL: {info.row.original.quantity}</span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Tổng Giá Trị',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái Quy Trình',
      cell: (info) => {
        const val = info.getValue() as string;
        const isApproved = val.includes('Đã duyệt');
        return (
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
              isApproved
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}
          >
            {isApproved ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {val}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Duyệt Đơn ERP',
      cell: ({ row }) => {
        const isApproved = row.original.status.includes('Đã duyệt');
        if (isApproved) {
          return <span className="text-xs font-semibold text-emerald-600 italic">Đã lập phiếu PX</span>;
        }
        return (
          <button
            onClick={() => handleApproveWebOrder(row.original)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-all"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt & Xuất Kho (PX)
          </button>
        );
      },
    },
  ];

  const filteredStockOuts = filterByDateRange(stockOuts, dateFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ArrowUpRight className="h-6 w-6 text-amber-500" /> Quản Lý Phiếu Xuất Kho & Bán Hàng (ERP)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Nghiệp vụ lập phiếu xuất kho bán hàng, đồng bộ đơn WebShop, tự động tính VAT, quy đổi ĐVT và in chứng từ.
          </p>
        </div>

        <button
          onClick={handleOpenAddVoucher}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> Tạo phiếu xuất kho mới
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('erp')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'erp'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <ArrowUpRight className="h-4 w-4" /> Phiếu Xuất Kho ERP ({stockOuts.length})
        </button>
        <button
          onClick={() => setActiveTab('webshop')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'webshop'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Globe className="h-4 w-4" /> Đơn Hàng WebShop Chờ Duyệt ({webOrders.filter((w) => w.status.includes('Chờ')).length})
        </button>
      </div>

      <SaaSDateFilterBar onFilterChange={(val) => setDateFilter(val)} />

      {activeTab === 'erp' ? (
        <DataTable columns={columns} data={filteredStockOuts} searchPlaceholder="Tìm mã phiếu xuất, tên khách hàng..." />
      ) : (
        <DataTable columns={webColumns} data={webOrders} searchPlaceholder="Tìm mã đơn web WEB-..., tên khách hàng..." />
      )}

      {/* Print Modal */}
      {selectedStockOut && (
        <SaaSPrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          docType="stock_out"
          docCode={selectedStockOut.code}
          docDate={selectedStockOut.date}
          partnerName={selectedStockOut.customerName}
          partnerAddress={selectedStockOut.customerAddress}
          partnerPhone={selectedStockOut.customerPhone}
          items={selectedStockOut.items.map((i) => ({
            sku: i.sku,
            name: i.productName,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.quantity * i.unitPrice,
          }))}
          totalAmount={selectedStockOut.subtotal}
          taxAmount={selectedStockOut.vatAmount}
          grandTotal={selectedStockOut.totalAmount}
          notes={selectedStockOut.note || 'Giao nhận hàng hóa đầy đủ nguyên tem bảo hành.'}
        />
      )}

      {/* ERP Voucher Creation & Editing Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-5xl w-full my-auto p-4 sm:p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5 max-h-[95vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {editingVoucher ? `Chỉnh Sửa Phiếu Xuất Kho: ${editingVoucher.code}` : 'Tạo Phiếu Xuất Kho Bán Hàng Mới'}
                </h3>
              </div>
              <button
                onClick={() => setShowVoucherModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Form Info Controls */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Mã Phiếu Xuất *
                    </label>
                    <input
                      type="text"
                      required
                      value={voucherForm.code}
                      onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value })}
                      className="w-full px-3 py-2 font-mono font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Ngày Xuất Kho *
                    </label>
                    <input
                      type="date"
                      required
                      value={voucherForm.date}
                      onChange={(e) => setVoucherForm({ ...voucherForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Kho Xuất Hàng *
                    </label>
                    <SearchableSelect
                      value={voucherForm.warehouse}
                      onChange={(val) => setVoucherForm({ ...voucherForm, warehouse: val })}
                      placeholder="Chọn kho xuất..."
                      options={[
                        { value: 'Kho Chính - Hà Nội', label: 'Kho Chính - Hà Nội', code: 'K01' },
                        { value: 'Kho Phụ - TP. Hồ Chí Minh', label: 'Kho Phụ - TP. Hồ Chí Minh', code: 'K02' },
                        { value: 'Kho Hải Phòng', label: 'Kho Hải Phòng', code: 'K03' },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Khách Hàng * (Fast Search)
                    </label>
                    <SearchableSelect
                      value={voucherForm.customerId}
                      onChange={(val) => setVoucherForm({ ...voucherForm, customerId: val })}
                      placeholder="Tìm khách hàng theo tên, SĐT..."
                      options={SAMPLE_CUSTOMERS.map((c) => ({
                        value: c.id,
                        label: c.name,
                        code: c.id.toUpperCase(),
                        subLabel: `SĐT: ${c.phone} - ${c.address}`,
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Số Hóa Đơn & Ký Hiệu
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Số HĐ"
                        value={voucherForm.invoiceNo}
                        onChange={(e) => setVoucherForm({ ...voucherForm, invoiceNo: e.target.value })}
                        className="w-2/3 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        placeholder="Ký hiệu"
                        value={voucherForm.invoiceSeries}
                        onChange={(e) => setVoucherForm({ ...voucherForm, invoiceSeries: e.target.value })}
                        className="w-1/3 px-3 py-2 font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Diễn Giải / Ghi Chú Xuất Kho
                    </label>
                    <input
                      type="text"
                      placeholder="Mô tả lý do xuất kho, địa điểm giao..."
                      value={voucherForm.note}
                      onChange={(e) => setVoucherForm({ ...voucherForm, note: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* VAT Mode Config */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                  <div>
                    <label className="block font-semibold text-amber-600 dark:text-amber-400 mb-1">
                      Phương Thức Tính VAT
                    </label>
                    <div className="flex items-center gap-4 py-1">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          value="grouped"
                          checked={voucherForm.vatMode === 'grouped'}
                          onChange={() => setVoucherForm({ ...voucherForm, vatMode: 'grouped' })}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span>VAT gộp phiếu</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatMode"
                          value="per_item"
                          checked={voucherForm.vatMode === 'per_item'}
                          onChange={() => setVoucherForm({ ...voucherForm, vatMode: 'per_item' })}
                          className="text-amber-500 focus:ring-amber-500"
                        />
                        <span>VAT theo dòng</span>
                      </label>
                    </div>
                  </div>

                  {voucherForm.vatMode === 'grouped' && (
                    <div>
                      <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Tỷ Lệ VAT Gộp (%)
                      </label>
                      <select
                        value={voucherForm.vatRateGrouped}
                        onChange={(e) => setVoucherForm({ ...voucherForm, vatRateGrouped: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                      >
                        <option value={0}>0% (Không thuế)</option>
                        <option value={5}>5%</option>
                        <option value={8}>8% (Giảm VAT)</option>
                        <option value={10}>10% (Chuẩn)</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Trạng Thái Thanh Toán
                    </label>
                    <select
                      value={voucherForm.paymentStatus}
                      onChange={(e) =>
                        setVoucherForm({
                          ...voucherForm,
                          paymentStatus: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    >
                      <option value="Còn nợ">Còn nợ (Ghi sổ công nợ)</option>
                      <option value="Đã thanh toán">Đã thanh toán (Thu tiền ngay)</option>
                      <option value="Thanh toán một phần">Thanh toán một phần</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-amber-500" />
                    Chi Tiết Danh Sách Hàng Hóa Xuất Kho ({lineItems.length} dòng)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm dòng hàng
                  </button>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-semibold">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2 min-w-[200px]">Mặt Hàng Xuất *</th>
                        <th className="p-2 w-20 text-center">Tồn Kho</th>
                        <th className="p-2 w-24 text-right">Số Lượng</th>
                        <th className="p-2 w-20 text-center">ĐVT</th>
                        <th className="p-2 w-28 text-right">Đơn Giá Bán</th>
                        {voucherForm.vatMode === 'per_item' && <th className="p-2 w-20 text-center">VAT %</th>}
                        <th className="p-2 w-32 text-right">Thành Tiền</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {lineItems.map((item, idx) => {
                        const lineSubtotal = item.quantity * item.unitPrice;
                        return (
                          <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                            <td className="p-2 text-center text-zinc-500">{idx + 1}</td>
                            <td className="p-2 min-w-[220px]">
                              <SearchableSelect
                                value={item.productId}
                                onChange={(val) => handleProductChange(item.id, val)}
                                placeholder="Gõ tên hoặc SKU để tìm nhanh..."
                                options={SAMPLE_PRODUCTS.map((p) => ({
                                  value: p.id,
                                  label: p.name,
                                  code: p.sku,
                                  badge: `Tồn: ${p.stock} ${p.unit}`,
                                }))}
                              />
                            </td>
                            <td className="p-2 text-center font-bold text-amber-600 dark:text-amber-400">
                              {item.stock}
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity}
                                onChange={(e) => handleLineChange(item.id, 'quantity', Number(e.target.value))}
                                className="w-full px-2 py-1 text-right font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded"
                              />
                            </td>
                            <td className="p-2 text-center font-semibold text-zinc-600 dark:text-zinc-400">
                              {item.unit}
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                value={item.unitPrice}
                                onChange={(e) => handleLineChange(item.id, 'unitPrice', Number(e.target.value))}
                                className="w-full px-2 py-1 text-right font-mono font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded"
                              />
                            </td>
                            {voucherForm.vatMode === 'per_item' && (
                              <td className="p-2">
                                <select
                                  value={item.vatRate}
                                  onChange={(e) => handleLineChange(item.id, 'vatRate', Number(e.target.value))}
                                  className="w-full px-1 py-1 text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded"
                                >
                                  <option value={0}>0%</option>
                                  <option value={5}>5%</option>
                                  <option value={8}>8%</option>
                                  <option value={10}>10%</option>
                                </select>
                              </td>
                            )}
                            <td className="p-2 text-right font-mono font-bold text-zinc-900 dark:text-zinc-100">
                              {lineSubtotal.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(item.id)}
                                className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 rounded transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total Summary Footer */}
              <div className="flex flex-col sm:flex-row items-end justify-between p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/50 rounded-xl gap-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                  <p className="flex items-center gap-1 font-semibold text-zinc-700 dark:text-zinc-300">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Lưu ý ERP:
                  </p>
                  <p>• Xác nhận phiếu sẽ tự động trừ số lượng tồn kho tương ứng.</p>
                  <p>• Hóa đơn VAT sẽ được ghi nhận vào sổ báo cáo VAT đầu ra.</p>
                </div>

                <div className="text-right space-y-1 text-xs w-full sm:w-auto min-w-[240px]">
                  <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                    <span>Tổng tiền hàng:</span>
                    <span className="font-mono font-semibold">{calcSubtotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                    <span>Tiền thuế VAT:</span>
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                      +{calcVatAmount().toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-zinc-900 dark:text-zinc-100 pt-1 border-t border-amber-200 dark:border-amber-800">
                    <span>Tổng thanh toán:</span>
                    <span className="font-mono text-base text-emerald-600 dark:text-emerald-400">
                      {calcTotalAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs"
                >
                  {editingVoucher ? 'Cập Nhật Phiếu Xuất' : 'Xác Nhận Xuất Kho & Lưu Phiếu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
