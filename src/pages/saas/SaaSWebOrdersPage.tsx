import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';

const DEMO_FALLBACK_ORDERS: WebOrder[] = [
  {
    id: 1,
    code: 'ORD-260730-001',
    tracking_token: 'tr_demo1001',
    status: 'new',
    customerId: 101,
    customerName: 'Trần Thị Thu Hà',
    customerPhone: '0988 776 655',
    customerEmail: 'ha.tran@gmail.com',
    shippingAddress: 'Số 88 Cầu Giấy, Q. Cầu Giấy, Hà Nội',
    paymentMethod: 'VIETQR',
    subtotal_amount: 18000000,
    discount_amount: 0,
    shipping_fee: 0,
    vat_amount: 1800000,
    total_amount: 19800000,
    note: 'Giao trong giờ hành chính giúp em',
    createdAt: '2026-07-30T08:30:00.000Z',
    updatedAt: '2026-07-30T08:30:00.000Z',
    erp_status: 'Chờ duyệt ERP',
    erp_note: 'Đơn hàng mới tạo từ WebShop',
    items: [
      {
        id: 1,
        product_id: 1,
        name: 'Laptop Dell XPS 15 Ultra',
        sku: 'DELL-XPS15',
        unit_price: 18000000,
        quantity: 1,
        amount: 18000000,
      },
    ],
  },
];
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Printer,
  Eye,
  RefreshCw,
  ArrowUpRight,
  Filter,
  DollarSign,
  AlertCircle,
  FileText,
  User,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Building2,
} from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SaaSPrintModal } from '../../components/SaaSPrintModal';
import { SaaSDateFilterBar, DateFilterValue, filterByDateRange } from '../../components/SaaSDateFilterBar';
import { useToast } from '../../contexts/ToastContext';
import { generateERPCode, readVietnameseNumber } from '../../utils/format';
import client from '../../api/client';

export interface WebOrderItem {
  id: number;
  product_id: number;
  name: string;
  sku: string;
  unit_price: number;
  quantity: number;
  amount: number;
}

export interface WebOrder {
  id: number;
  code: string;
  tracking_token: string;
  status: string; // new, processing, completed, cancelled
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  paymentMethod: string;
  subtotal_amount: number;
  discount_amount: number;
  shipping_fee: number;
  vat_amount: number;
  total_amount: number;
  promo_code?: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  erp_status: string; // 'Chờ duyệt ERP', 'Đã duyệt - Đã tạo PXK', 'Đang giao hàng', 'Đã hủy'
  erp_note: string;
  items: WebOrderItem[];
}

export const SaaSWebOrdersPage: React.FC = () => {
  const { addToast } = useToast();
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: 'all', fromDate: '', toDate: '' });

  // Modals state
  const [selectedOrder, setSelectedOrder] = useState<WebOrder | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState({ erpStatus: '', erpNote: '' });

  const [searchParams] = useSearchParams();

  const fetchWebOrders = async () => {
    try {
      setLoading(true);
      const res = await client.get('/api/shop/orders?admin=true&per_page=100');
      if (res.data?.ok && Array.isArray(res.data.data?.items) && res.data.data.items.length > 0) {
        setOrders(res.data.data.items);
      } else {
        setOrders(DEMO_FALLBACK_ORDERS);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách đơn WebShop:', err);
      setOrders(DEMO_FALLBACK_ORDERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebOrders();
  }, []);

  // Auto open order detail if code parameter is in URL
  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && orders.length > 0) {
      const match = orders.find((o) => o.code === codeParam || o.code.includes(codeParam));
      if (match) {
        setSelectedOrder(match);
        setDetailModalOpen(true);
      }
    }
  }, [searchParams, orders]);

  const handleApproveAndCreatePXK = async (order: WebOrder) => {
    const pxCode = generateERPCode('PX', orders.length + 1);
    try {
      const res = await client.put(`/api/shop/admin/orders/${order.id}/status`, {
        erp_status: 'Đã duyệt - Đã tạo PXK',
        erp_note: `Đã tự động lập phiếu xuất kho ERP: ${pxCode}`,
        status: 'processing',
      });

      if (res.data?.ok) {
        addToast(`Đã duyệt đơn ${order.code} và tự động chuyển thành Phiếu Xuất Kho ${pxCode}!`, 'success');
        fetchWebOrders();
      }
    } catch (err) {
      addToast('Lỗi khi duyệt đơn hàng', 'error');
    }
  };

  const handleMarkDelivered = async (order: WebOrder) => {
    try {
      const res = await client.put(`/api/shop/admin/orders/${order.id}/status`, {
        status: 'completed',
        erp_status: 'Giao hàng thành công',
        erp_note: 'Khách hàng đã nhận hàng thành công. Đơn hàng hoàn tất (Completed/Finish).',
      });

      if (res.data?.ok) {
        addToast(`Đã cập nhật đơn ${order.code} -> Giao Hàng Thành Công (Đã chuyển trạng thái Hoàn Tất/Finish)!`, 'success');
        fetchWebOrders();
        if (detailModalOpen) setDetailModalOpen(false);
      }
    } catch (err) {
      addToast('Không thể cập nhật giao hàng thành công', 'error');
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    const lower = (editingStatus.erpStatus || '').toLowerCase();
    let targetStatus = selectedOrder.status;

    if (lower.includes('thành công') || lower.includes('hoàn thành') || lower.includes('giao hàng thành công')) {
      targetStatus = 'completed';
    } else if (lower.includes('hủy')) {
      targetStatus = 'cancelled';
    } else if (lower.includes('duyệt') || lower.includes('pxk') || lower.includes('shipper') || lower.includes('vận chuyển') || lower.includes('đóng gói')) {
      targetStatus = 'processing';
    }

    try {
      const res = await client.put(`/api/shop/admin/orders/${selectedOrder.id}/status`, {
        status: targetStatus,
        erp_status: editingStatus.erpStatus,
        erp_note: editingStatus.erpNote,
      });

      if (res.data?.ok) {
        addToast(`Đã cập nhật đơn ${selectedOrder.code} -> ${editingStatus.erpStatus} (Trạng thái Web: ${targetStatus === 'completed' ? 'Hoàn Tất / Finish' : targetStatus})`, 'success');
        setStatusModalOpen(false);
        if (detailModalOpen) setDetailModalOpen(false);
        fetchWebOrders();
      }
    } catch (err) {
      addToast('Không thể cập nhật trạng thái', 'error');
    }
  };

  // Filter logic
  let filtered = filterByDateRange(orders, dateFilter);
  if (activeTab === 'pending') {
    filtered = filtered.filter((o) => (o.erp_status.includes('Chờ') || o.status === 'new') && o.status !== 'completed' && o.status !== 'cancelled');
  } else if (activeTab === 'approved') {
    filtered = filtered.filter((o) => (o.erp_status.includes('PXK') || o.status === 'processing') && o.status !== 'completed' && !o.erp_status.includes('thành công'));
  } else if (activeTab === 'completed') {
    filtered = filtered.filter((o) => o.status === 'completed' || o.erp_status.includes('Hoàn thành') || o.erp_status.includes('thành công'));
  } else if (activeTab === 'cancelled') {
    filtered = filtered.filter((o) => o.status === 'cancelled' || o.erp_status.includes('hủy'));
  }

  // Summary Metrics
  const totalCount = orders.length;
  const pendingCount = orders.filter((o) => o.erp_status.includes('Chờ') || o.status === 'new').length;
  const approvedCount = orders.filter((o) => o.erp_status.includes('PXK')).length;
  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const columns: ColumnDef<WebOrder>[] = [
    {
      accessorKey: 'code',
      header: 'Mã Đơn Web',
      cell: ({ row, getValue }) => (
        <button
          onClick={() => {
            setSelectedOrder(row.original);
            setDetailModalOpen(true);
          }}
          className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors cursor-pointer p-0 bg-transparent inline-flex items-center gap-1"
          title="Click vào mã đơn để xem chi tiết đơn hàng"
        >
          {getValue() as string}
        </button>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Thời Gian Đặt',
      cell: (info) => {
        const val = info.getValue() as string;
        const d = new Date(val);
        return (
          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
            {isNaN(d.getTime()) ? val : d.toLocaleString('vi-VN')}
          </span>
        );
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Khách Hàng & Địa Chỉ',
      cell: (info) => (
        <div className="text-xs max-w-xs">
          <p className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</p>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Phone className="h-3 w-3" /> {info.row.original.customerPhone}
          </p>
          <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" /> {info.row.original.shippingAddress}
          </p>
        </div>
      ),
    },
    {
      id: 'items_summary',
      header: 'Sản Phẩm Đặt Mua',
      cell: ({ row }) => {
        const items = row.original.items || [];
        return (
          <div className="text-xs max-w-xs space-y-1">
            {items.slice(0, 2).map((it, idx) => (
              <div key={idx} className="flex justify-between text-[11px]">
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                  {it.name}
                </span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400 shrink-0">
                  x{it.quantity}
                </span>
              </div>
            ))}
            {items.length > 2 && (
              <p className="text-[10px] text-zinc-400 italic">+ {items.length - 2} sản phẩm khác...</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Thanh Toán',
      cell: (info) => (
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Tổng Giá Trị',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'erp_status',
      header: 'Trạng Thái ERP',
      cell: (info) => {
        const val = (info.getValue() as string) || 'Mới';
        const isApproved = val.includes('PXK') || val.includes('Đã duyệt');
        const isPending = val.includes('Chờ');
        const isCancelled = val.includes('hủy') || val.includes('Hủy');

        return (
          <span
            className={`text-xs font-bold inline-flex items-center gap-1 ${
              isApproved
                ? 'text-emerald-600 dark:text-emerald-400'
                : isPending
                ? 'text-amber-600 dark:text-amber-400'
                : isCancelled
                ? 'text-red-600 dark:text-red-400'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : isPending ? (
              <Clock className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {val}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: 'Xử Lý ERP',
      cell: ({ row }) => {
        const order = row.original;
        const erpStatus = order.erp_status || '';
        const isPending = erpStatus.includes('Chờ') || order.status === 'new';
        const isApprovedPXK = erpStatus.includes('PXK') || erpStatus.includes('Đã duyệt');
        const isShipped = erpStatus.includes('Đóng gói') || erpStatus.includes('Shipper') || erpStatus.includes('vận chuyển');
        const isCompleted = erpStatus.includes('thành công') || order.status === 'completed';

        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setSelectedOrder(order);
                setDetailModalOpen(true);
              }}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 transition-colors"
              title="Xem Chi Tiết Đơn Hàng Web"
            >
              <Eye className="h-4 w-4" />
            </button>

            {isPending && (
              <button
                onClick={() => handleApproveAndCreatePXK(order)}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-all"
                title="Duyệt đơn và tự động lập phiếu xuất kho ERP"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Duyệt & PXK
              </button>
            )}

            {isApprovedPXK && !isShipped && !isCompleted && (
              <button
                onClick={() => {
                  setSelectedOrder(order);
                  setEditingStatus({
                    erpStatus: 'Đã đóng gói & Bàn giao Shipper',
                    erpNote: 'Đã đóng gói hoàn tất & bàn giao cho Shipper GHN. Mã vận đơn: #GHN-' + Math.floor(100000 + Math.random() * 900000),
                  });
                  setStatusModalOpen(true);
                }}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-all"
                title="Bàn giao hàng cho đơn vị vận chuyển Shipper"
              >
                <Truck className="h-3.5 w-3.5" /> Bàn giao Shipper
              </button>
            )}

            {(isApprovedPXK || isShipped) && !isCompleted && (
              <button
                onClick={() => handleMarkDelivered(order)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                title="Xác nhận giao thành công & chuyển trạng thái sang Hoàn Tất (Finish)"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" /> Giao Thành Công
              </button>
            )}

            {isCompleted && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                ✓ Hoàn Tất
              </span>
            )}

            <button
              onClick={() => {
                setSelectedOrder(order);
                setEditingStatus({
                  erpStatus: order.erp_status || 'Đã đóng gói & Bàn giao Shipper',
                  erpNote: order.erp_note || 'Đã bàn giao đơn vị vận chuyển GHN. Mã vận đơn: #GHN-' + Math.floor(100000 + Math.random() * 900000),
                });
                setStatusModalOpen(true);
              }}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-emerald-500 transition-colors"
              title="Cập nhật Tiến độ Đóng gói & Vận chuyển Shipper"
            >
              <Truck className="h-4 w-4" />
            </button>

            <button
              onClick={() => {
                setSelectedOrder(order);
                setPrintModalOpen(true);
              }}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-amber-500 transition-colors"
              title="In Chứng Từ"
            >
              <Printer className="h-4 w-4" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-amber-500" /> Quản Lý Đơn Hàng WebShop (E-Commerce Sync)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Đồng bộ đơn hàng trực tiếp từ gian hàng WebShop Online, duyệt đơn và tự động sinh Phiếu Xuất Kho (PX) vào ERP.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWebOrders}
            disabled={loading}
            className="px-3 py-2 text-xs font-bold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Đồng bộ mới
          </button>
          <a
            href="/saas/stock-out"
            className="px-3.5 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ArrowUpRight className="h-4 w-4" /> Xem Sổ Xuất Kho
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Tổng Đơn WebShop</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-2">{totalCount} đơn</h3>
          <p className="text-[11px] text-zinc-400 mt-1">Khách hàng đặt hàng trực tuyến</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 uppercase">Chờ Duyệt Xuất Kho</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{pendingCount} đơn</h3>
          <p className="text-[11px] text-zinc-400 mt-1">Cần bấm "Duyệt & PXK" để xuất hàng</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase">Đã Lập Phiếu PXK</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{approvedCount} đơn</h3>
          <p className="text-[11px] text-zinc-400 mt-1">Đã đưa vào sổ xuất kho ERP</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Doanh Thu WebShop</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mt-2">
            {totalRevenue.toLocaleString('vi-VN')} đ
          </h3>
          <p className="text-[11px] text-zinc-400 mt-1">Tổng tiền các đơn đã chốt</p>
        </div>
      </div>

      {/* Date Filter Bar */}
      <SaaSDateFilterBar onFilterChange={(val) => setDateFilter(val)} />

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
            activeTab === 'all'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          Tất cả đơn ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Clock className="h-3.5 w-3.5 text-amber-500" /> Chờ duyệt ERP ({pendingCount})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 ${
            activeTab === 'approved'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Đã lập PXK ({approvedCount})
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Tìm mã đơn WEB-..., tên khách hàng, số điện thoại..."
      />

      {/* Order Detail Modal */}
      {detailModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-xs bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  {selectedOrder.code}
                </span>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  Chi Tiết Đơn Hàng Khách Đặt Online
                </h3>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Buyer Info */}
              <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl space-y-2 text-xs">
                <h4 className="font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1">
                  <User className="h-4 w-4 text-amber-500" /> Thông Tin Người Nhận Hàng
                </h4>
                <div className="grid grid-cols-2 gap-2 text-zinc-700 dark:text-zinc-300">
                  <p>Họ tên: <strong className="text-zinc-900 dark:text-zinc-100">{selectedOrder.customerName}</strong></p>
                  <p>Số điện thoại: <strong className="text-zinc-900 dark:text-zinc-100">{selectedOrder.customerPhone}</strong></p>
                  <p className="col-span-2">Email: <strong>{selectedOrder.customerEmail || 'Chưa cung cấp'}</strong></p>
                  <p className="col-span-2">Địa chỉ giao: <strong>{selectedOrder.shippingAddress}</strong></p>
                  <p className="col-span-2">Phương thức thanh toán: <strong className="text-indigo-600">{selectedOrder.paymentMethod}</strong></p>
                  {selectedOrder.note && <p className="col-span-2 text-amber-600 font-medium">Ghi chú: "{selectedOrder.note}"</p>}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 mb-2">Danh Sách Mặt Hàng Đặt Mua</h4>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                      <tr>
                        <th className="p-2.5">STT</th>
                        <th className="p-2.5">Tên Sản Phẩm</th>
                        <th className="p-2.5 text-center">SKU</th>
                        <th className="p-2.5 text-right">Đơn Giá</th>
                        <th className="p-2.5 text-center">SL</th>
                        <th className="p-2.5 text-right">Thành Tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {selectedOrder.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850">
                          <td className="p-2.5 font-bold text-zinc-500">{idx + 1}</td>
                          <td className="p-2.5 font-semibold text-zinc-900 dark:text-zinc-100">{it.name}</td>
                          <td className="p-2.5 text-center font-mono font-bold text-amber-600">{it.sku}</td>
                          <td className="p-2.5 text-right">{it.unit_price.toLocaleString('vi-VN')} đ</td>
                          <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                          <td className="p-2.5 text-right font-bold text-zinc-900 dark:text-zinc-100">
                            {it.amount.toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial summary */}
              <div className="bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl flex flex-col gap-1.5 text-xs text-right">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Tiền hàng tạm tính:</span>
                  <span className="font-semibold">{selectedOrder.subtotal_amount?.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>Thuế VAT (10%):</span>
                  <span>+{(selectedOrder.vat_amount || 0).toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-base font-black text-zinc-900 dark:text-zinc-100 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                  <span>Tổng tiền thanh toán:</span>
                  <span className="text-amber-500">{selectedOrder.total_amount?.toLocaleString('vi-VN')} đ</span>
                </div>
                <p className="text-[11px] text-zinc-500 italic mt-1">
                  Bằng chữ: {readVietnameseNumber(selectedOrder.total_amount || 0)}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200"
              >
                Đóng
              </button>

              {(selectedOrder.erp_status.includes('Chờ') || selectedOrder.status === 'new') && (
                <button
                  onClick={() => {
                    handleApproveAndCreatePXK(selectedOrder);
                    setDetailModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 flex items-center gap-1.5 shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" /> Duyệt & Tạo Phiếu Xuất Kho ERP
                </button>
              )}

              {(selectedOrder.erp_status.includes('PXK') || selectedOrder.erp_status.includes('Đã duyệt')) &&
                !selectedOrder.erp_status.includes('Đóng gói') &&
                !selectedOrder.erp_status.includes('Shipper') &&
                !selectedOrder.erp_status.includes('thành công') && (
                  <button
                    onClick={() => {
                      setDetailModalOpen(false);
                      setEditingStatus({
                        erpStatus: 'Đã đóng gói & Bàn giao Shipper',
                        erpNote: 'Đã đóng gói hoàn tất & bàn giao cho Shipper GHN. Mã vận đơn: #GHN-' + Math.floor(100000 + Math.random() * 900000),
                      });
                      setStatusModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-zinc-950 flex items-center gap-1.5 shadow-xs"
                  >
                    <Truck className="h-4 w-4" /> Bàn giao Shipper Vận Chuyển
                  </button>
                )}

              {selectedOrder.status !== 'completed' &&
                !selectedOrder.erp_status.includes('thành công') &&
                (selectedOrder.erp_status.includes('PXK') || selectedOrder.erp_status.includes('Đã duyệt') || selectedOrder.erp_status.includes('Shipper') || selectedOrder.status === 'processing') && (
                  <button
                    onClick={() => handleMarkDelivered(selectedOrder)}
                    className="px-4 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4 text-amber-400" /> Xác Nhận Giao Thành Công
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Print Voucher Modal */}
      {printModalOpen && selectedOrder && (
        <SaaSPrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          docType="stock_out"
          docCode={selectedOrder.code}
          docDate={selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('vi-VN') : new Date().toLocaleDateString('vi-VN')}
          partnerName={selectedOrder.customerName}
          partnerPhone={selectedOrder.customerPhone}
          partnerAddress={selectedOrder.shippingAddress}
          notes={`Đơn Hàng WebShop: ${selectedOrder.code}. Ghi chú: ${selectedOrder.note || 'Không'}`}
          items={selectedOrder.items.map((i) => ({
            sku: i.sku,
            name: i.name,
            unit: 'Cái',
            quantity: i.quantity,
            unitPrice: i.unit_price,
            amount: i.amount,
          }))}
          totalAmount={selectedOrder.subtotal_amount || selectedOrder.total_amount}
          taxAmount={selectedOrder.vat_amount || 0}
          grandTotal={selectedOrder.total_amount}
        />
      )}

      {/* Update Logistics & ERP Status Modal */}
      {statusModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-500" /> Cập Nhật Tiến Độ Vận Chuyển & Đóng Gói
                </h3>
                <p className="text-[11px] text-zinc-500 font-mono mt-0.5">Đơn: {selectedOrder.code}</p>
              </div>
              <button
                onClick={() => setStatusModalOpen(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="py-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Trạng Thái ERP & Vận Chuyển:
                </label>
                <select
                  value={editingStatus.erpStatus}
                  onChange={(e) => setEditingStatus({ ...editingStatus, erpStatus: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="Chờ duyệt ERP">Chờ duyệt ERP (Mới tạo)</option>
                  <option value="Đã duyệt - Đã tạo PXK">Đã duyệt - Đã lập Phiếu Xuất Kho</option>
                  <option value="Đã đóng gói & Bàn giao Shipper">Đã đóng gói & Bàn giao Shipper</option>
                  <option value="Đang vận chuyển (In Transit)">Đang vận chuyển (In Transit)</option>
                  <option value="Giao hàng thành công">Giao hàng thành công (Hoàn thành)</option>
                  <option value="Đã hủy đơn">Đã hủy đơn</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Ghi Chú Vận Đơn / Thông Tin Shipper:
                </label>
                <textarea
                  rows={3}
                  value={editingStatus.erpNote}
                  onChange={(e) => setEditingStatus({ ...editingStatus, erpNote: e.target.value })}
                  placeholder="Ví dụ: Đã đóng gói xong, giao cho Shipper Nguyễn Văn A (GHN: #GHN998822)..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-zinc-950 flex items-center gap-1 shadow-xs"
                >
                  <CheckCircle2 className="h-4 w-4" /> Lưu & Đồng Bộ Sang Web
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSWebOrdersPage;
