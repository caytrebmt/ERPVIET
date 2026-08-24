import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDownLeft,
  Plus,
  CheckCircle2,
  Clock,
  Printer,
  Edit2,
  Trash2,
  X,
  FileText,
  Calculator,
  ShoppingCart,
  Link as LinkIcon,
} from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SaaSPrintModal } from '../../components/SaaSPrintModal';
import { SaaSDateFilterBar, DateFilterValue, filterByDateRange } from '../../components/SaaSDateFilterBar';
import { SearchableSelect, SelectOption } from '../../components/SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { generateERPCode } from '../../utils/format';
import client from '../../api/client';
import {
  PurchaseOrder,
  fetchPOs,
  savePOs,
} from '../../services/procurementStore';

interface StockInLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  vatRate: number;
}

interface StockInVoucher {
  id: number;
  code: string;
  date: string;
  supplierId: string;
  supplierName: string;
  supplierPhone: string;
  supplierAddress: string;
  warehouse: string;
  invoiceNo: string;
  invoiceSeries: string;
  note: string;
  vatMode: 'grouped' | 'per_item';
  vatRateGrouped: number;
  items: StockInLineItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  status: 'Đã hoàn thành' | 'Nháp' | 'Đã hủy';
  createdBy: string;
  po_number?: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
}

interface SupplierOption {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export const SaaSStockInPage: React.FC = () => {
  const { addToast } = useToast();
  const location = useLocation();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: 'all', fromDate: '', toDate: '' });

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: number; name: string }>>([]);

  const [availablePOs, setAvailablePOs] = useState<PurchaseOrder[]>([]);
  const [linkedPONumber, setLinkedPONumber] = useState<string>('');

  const [stockIns, setStockIns] = useState<StockInVoucher[]>([]);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedStockIn, setSelectedStockIn] = useState<StockInVoucher | null>(null);

  // Voucher Form Modal state
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<StockInVoucher | null>(null);

  const [voucherForm, setVoucherForm] = useState({
    code: '',
    date: new Date().toISOString().slice(0, 10),
    supplierId: '',
    warehouse: '',
    invoiceNo: '',
    invoiceSeries: 'C26MH',
    note: '',
    vatMode: 'grouped' as 'grouped' | 'per_item',
    vatRateGrouped: 10,
    status: 'Đã hoàn thành' as 'Nháp' | 'Đã hoàn thành',
  });

  const [lineItems, setLineItems] = useState<StockInLineItem[]>([]);

  const loadStockIns = async () => {
    const response = await client.get('/api/saas/inventory/movements?limit=500');
    if (!response.data?.ok) throw new Error(response.data?.message || 'Không tải được phiếu nhập kho.');
    setStockIns((response.data.data || []).filter((row: any) => row.movement_type === 'NHAP_KHO').map((row: any) => ({
      id: Number(row.id), code: row.code, date: row.movement_date ? String(row.movement_date).slice(0, 10) : '',
      supplierId: '', supplierName: '', supplierPhone: '', supplierAddress: '', warehouse: row.warehouse_vi || row.warehouse_en || '',
      invoiceNo: row.reference_doc || '', invoiceSeries: '', note: row.notes || '', vatMode: 'grouped', vatRateGrouped: 0,
      items: [{ id: String(row.id), productId: String(row.product_id || ''), productName: row.name_vi || '', sku: row.sku || '', unit: '', quantity: Number(row.quantity) || 0, unitPrice: Number(row.unit_cost) || 0, vatRate: 0 }],
      subtotal: Number(row.subtotal_cost) || 0, vatAmount: 0, totalAmount: Number(row.subtotal_cost) || 0,
      status: 'Đã hoàn thành', createdBy: '', po_number: '',
    })));
  };

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [prodRes, suppRes, warehouseRes] = await Promise.all([
          client.get('/api/shop/admin/products?limit=1000&include_inactive=true'),
          client.get('/api/saas/suppliers'),
          client.get('/api/saas/warehouses'),
        ]);
        if (prodRes.data?.ok && Array.isArray(prodRes.data.data?.items)) {
          setProducts(
            prodRes.data.data.items.map((p: any) => ({
              id: String(p.id),
              name: p.name_vi || p.name || p.name_en || 'Sản phẩm',
              sku: p.sku || '',
              unit: p.unit_vi || p.unit || p.unit_en || 'Cái',
              price: p.salePrice || p.costPrice || 0,
            }))
          );
        }
        if (warehouseRes.data?.ok) setWarehouses((warehouseRes.data.data || []).map((w: any) => ({ id: Number(w.id), name: w.name_vi || w.name_en || '' })));
        if (suppRes.data?.ok && Array.isArray(suppRes.data.data)) {
          setSuppliers(
            suppRes.data.data.map((s: any) => ({
              id: String(s.id),
              name: s.name || 'Nhà cung cấp',
              phone: s.phone || '',
              address: s.address || '',
            }))
          );
        }
      } catch (err) {
        console.warn('Failed to load dropdown data:', err);
      }
    };
    loadDropdownData();
    loadStockIns().catch((error: any) => addToast(error?.response?.data?.message || error.message || 'Không tải được phiếu nhập kho.', 'error'));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPOs()
      .catch(() => [] as PurchaseOrder[])
      .then((pos) => {
        if (!cancelled) setAvailablePOs(pos);
      });

    const fromPO: PurchaseOrder | undefined = (location.state as any)?.fromPO;
    if (fromPO) {
      applyPOToForm(fromPO);
    }
    return () => {
      cancelled = true;
    };
  }, [location.state]);

  const applyPOToForm = (po: PurchaseOrder) => {
    const nextCode = generateERPCode('PN', stockIns.length + 1);
    setLinkedPONumber(po.po_number);
    setEditingVoucher(null);
    setVoucherForm({
      code: nextCode,
      date: new Date().toISOString().slice(0, 10),
      supplierId: po.supplier_id || '',
      warehouse: '',
      invoiceNo: `HD-${po.po_number.split('-')[2] || '001'}`,
      invoiceSeries: 'C26MH',
      note: `Nhập kho tự động theo Đơn Mua Hàng ${po.po_number} (Nhà CC: ${po.supplier_name})`,
      vatMode: 'grouped',
      vatRateGrouped: 10,
      status: 'Đã hoàn thành',
    });

    if (po.items && po.items.length > 0) {
      setLineItems(
        po.items.map((it, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          unit: it.unit,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          vatRate: it.vatRate || 10,
        }))
      );
    }

    setShowVoucherModal(true);
    addToast(`Đã tải dữ liệu Đơn Mua Hàng ${po.po_number} vào phiếu nhập kho`, 'info');
  };

  const handleOpenPrint = (item: StockInVoucher) => {
    setSelectedStockIn(item);
    setPrintModalOpen(true);
  };

  const handleOpenAddVoucher = () => {
    setEditingVoucher(null);
    setLinkedPONumber('');
    const nextCode = generateERPCode('PN', stockIns.length + 1);
    setVoucherForm({
      code: nextCode,
      date: new Date().toISOString().slice(0, 10),
      supplierId: '',
      warehouse: '',
      invoiceNo: '',
      invoiceSeries: 'C26MH',
      note: '',
      vatMode: 'grouped',
      vatRateGrouped: 10,
      status: 'Đã hoàn thành',
    });
    setLineItems([]);
    setShowVoucherModal(true);
  };

  const handleOpenEditVoucher = (v: StockInVoucher) => {
    setEditingVoucher(v);
    setLinkedPONumber(v.po_number || '');
    setVoucherForm({
      code: v.code,
      date: v.date.split(' ')[0],
      supplierId: v.supplierId,
      warehouse: v.warehouse,
      invoiceNo: v.invoiceNo,
      invoiceSeries: v.invoiceSeries,
      note: v.note,
      vatMode: v.vatMode,
      vatRateGrouped: v.vatRateGrouped,
      status: v.status === 'Đã hủy' ? 'Nháp' : v.status,
    });
    setLineItems(v.items.length > 0 ? v.items : []);
    setShowVoucherModal(true);
  };

  const handleAddLineItem = () => {
    const defaultProd = products[0];
    if (!defaultProd) {
      addToast('Chưa có sản phẩm thực trong tenant để thêm vào phiếu nhập.', 'error');
      return;
    }
    const newItem: StockInLineItem = {
      id: `item-${Date.now()}`,
      productId: defaultProd.id,
      productName: defaultProd.name,
      sku: defaultProd.sku,
      unit: defaultProd.unit,
      quantity: 10,
      unitPrice: defaultProd.price,
      vatRate: 10,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      addToast('Phiếu nhập kho phải có ít nhất 1 mặt hàng!', 'warning');
      return;
    }
    setLineItems(lineItems.filter((item) => item.id !== id));
  };

  const handleProductChange = (lineId: string, productId: string) => {
    const prod = products.find((p) => p.id === productId);
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
              unitPrice: prod.price,
            }
          : item
      )
    );
  };

  const handleLineChange = (lineId: string, field: keyof StockInLineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => (item.id === lineId ? { ...item, [field]: value } : item))
    );
  };

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

  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lineItems.length === 0) { addToast('Vui lòng thêm ít nhất 1 hàng hóa vào phiếu nhập!', 'error'); return; }
    const supplier = suppliers.find((item) => item.id === voucherForm.supplierId);
    const warehouse = voucherForm.warehouse;
    if (!supplier || !warehouse) { addToast('Vui lòng chọn nhà cung cấp và kho thực trong tenant.', 'error'); return; }
    const warehouseId = Number(warehouse);
    if (!Number.isInteger(warehouseId) || warehouseId <= 0) { addToast('Chưa xác định được kho thực. Vui lòng chọn lại kho.', 'error'); return; }
    try {
      await client.post('/api/saas/inventory/movements', {
        type: 'NHAP_KHO', warehouseId, referenceDoc: voucherForm.invoiceNo || voucherForm.code,
        notes: voucherForm.note, items: lineItems.map((item) => ({ productId: Number(item.productId), quantity: Number(item.quantity), unitCost: Number(item.unitPrice) })),
      });
      await loadStockIns();
      setShowVoucherModal(false);
      addToast(`Đã lưu phiếu nhập kho ${voucherForm.code} vào PostgreSQL.`, 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || error.message || 'Không thể lưu phiếu nhập kho.', 'error'); }
  };

  const handleDeleteVoucher = (_id: number, code: string) => {
    addToast(`Không xóa trực tiếp phiếu ${code}; hãy lập chứng từ điều chỉnh kho để bảo toàn sổ kho.`, 'info');
  };

  const columns: ColumnDef<StockInVoucher>[] = [
    {
      accessorKey: 'code',
      header: 'Mã Phiếu',
      cell: (info) => (
        <div>
          <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
            {info.getValue() as string}
          </span>
          {info.row.original.po_number && (
            <div className="text-[10px] text-blue-400 font-mono font-bold flex items-center gap-1 mt-0.5">
              <ShoppingCart className="h-3 w-3" /> PO: {info.row.original.po_number}
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Ngày Nhập Kho',
      cell: (info) => <span className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'supplierName',
      header: 'Nhà Cung Cấp',
      cell: (info) => (
        <div className="max-w-[200px] truncate">
          <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">{info.getValue() as string}</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
            {info.row.original.supplierAddress}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'warehouse',
      header: 'Kho Nhập',
      cell: (info) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'invoiceNo',
      header: 'Số Hóa Đơn',
      cell: (info) => {
        const val = info.getValue() as string;
        return val ? (
          <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">
            {info.row.original.invoiceSeries} - {val}
          </span>
        ) : (
          <span className="text-zinc-400 italic text-xs">Chưa có HĐ</span>
        );
      },
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng Giá Trị',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: (info) => {
        const val = info.getValue() as string;
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border inline-flex items-center gap-1 ${
              val === 'Đã hoàn thành'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
            }`}
          >
            {val === 'Đã hoàn thành' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
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
            title="In Phiếu Nhập Kho Chuẩn"
          >
            <Printer className="h-4 w-4 text-emerald-600" />
          </button>
          <button
            onClick={() => handleOpenEditVoucher(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Chỉnh sửa phiếu nhập"
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

  const filteredStockIns = filterByDateRange(stockIns, dateFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ArrowDownLeft className="h-6 w-6 text-emerald-500" /> Sổ Nhập Kho (Goods Receipt & Stock-In)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Giai đoạn 4 trong quy trình khép kín: Tự động tải thông tin từ Đơn Mua Hàng (PO), cộng dồn tồn kho và ghi nhận VAT.
          </p>
        </div>

        <button
          onClick={handleOpenAddVoucher}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> Tạo phiếu nhập mới
        </button>
      </div>

      <SaaSDateFilterBar onFilterChange={(val) => setDateFilter(val)} />

      <DataTable columns={columns} data={filteredStockIns} searchPlaceholder="Tìm mã phiếu nhập, số PO, tên nhà cung cấp..." />

      {/* Print Modal */}
      {selectedStockIn && (
        <SaaSPrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          docType="stock_in"
          docCode={selectedStockIn.code}
          docDate={selectedStockIn.date}
          partnerName={selectedStockIn.supplierName}
          partnerAddress={selectedStockIn.supplierAddress}
          partnerPhone={selectedStockIn.supplierPhone}
          items={selectedStockIn.items.map((i) => ({
            sku: i.sku,
            name: i.productName,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.quantity * i.unitPrice,
          }))}
          totalAmount={selectedStockIn.subtotal}
          taxAmount={selectedStockIn.vatAmount}
          grandTotal={selectedStockIn.totalAmount}
          notes={selectedStockIn.note || `Giao nhận tại kho: ${selectedStockIn.warehouse}`}
        />
      )}

      {/* Stock In Voucher Form Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-5xl w-full my-auto p-4 sm:p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5 max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {editingVoucher ? `Chỉnh Sửa Phiếu Nhập Kho: ${editingVoucher.code}` : 'Lập Phiếu Nhập Kho Mua Hàng Mới'}
                </h3>
              </div>
              <button
                onClick={() => setShowVoucherModal(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* PO Select Linker Banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold text-blue-300">Tự động kết nối với Đơn Mua Hàng (PO):</span>
                  <p className="text-[11px] text-zinc-400">Chọn PO có sẵn để tự động điền Nhà Cung Cấp, Hóa Đơn và Danh Mục Hàng Mua.</p>
                </div>
              </div>

              <div className="w-full sm:w-64">
                <select
                  value={linkedPONumber}
                  onChange={(e) => {
                    const poCode = e.target.value;
                    if (!poCode) {
                      setLinkedPONumber('');
                      return;
                    }
                    const poFound = availablePOs.find((p) => p.po_number === poCode);
                    if (poFound) {
                      applyPOToForm(poFound);
                    }
                  }}
                  className="w-full px-3 py-1.5 bg-zinc-900 border border-blue-500/40 rounded-lg text-zinc-100 font-mono font-bold text-xs"
                >
                  <option value="">-- Chọn Đơn Mua Hàng (PO) --</option>
                  {availablePOs.map((p) => (
                    <option key={p.id} value={p.po_number}>
                      {p.po_number} - {p.supplier_name} ({p.total_amount.toLocaleString('vi-VN')} đ)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleSaveVoucher} className="space-y-5 overflow-y-auto pr-1 flex-1">
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Mã Phiếu Nhập *
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
                      Ngày Nhập Kho *
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
                      Kho Tiếp Nhận *
                    </label>
                    <SearchableSelect
                      value={voucherForm.warehouse}
                      onChange={(val) => setVoucherForm({ ...voucherForm, warehouse: val })}
                      placeholder="Chọn kho tiếp nhận..."
                      options={warehouses.map((warehouse) => ({
                        value: String(warehouse.id), label: warehouse.name, code: `K${warehouse.id}`,
                      }))}
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Nhà Cung Cấp * (Fast Search)
                    </label>
                    <SearchableSelect
                      value={voucherForm.supplierId}
                      onChange={(val) => setVoucherForm({ ...voucherForm, supplierId: val })}
                      placeholder="Tìm NCC theo tên, mã, MST..."
                      options={suppliers.map((s) => ({
                        value: s.id,
                        label: s.name,
                        code: s.id.toUpperCase(),
                        subLabel: `SĐT: ${s.phone} - ${s.address}`,
                      }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Số Hóa Đơn Mua Hàng & Ký Hiệu
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Số HĐ mua"
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
                      Diễn Giải / Diễn Diễn Nhập Kho
                    </label>
                    <input
                      type="text"
                      placeholder="Mô tả hóa đơn mua hàng, phiếu nhập vật tư..."
                      value={voucherForm.note}
                      onChange={(e) => setVoucherForm({ ...voucherForm, note: e.target.value })}
                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* VAT Setup */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                  <div>
                    <label className="block font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                      Phương Thức VAT Đầu Vào
                    </label>
                    <div className="flex items-center gap-4 py-1">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatModeIn"
                          value="grouped"
                          checked={voucherForm.vatMode === 'grouped'}
                          onChange={() => setVoucherForm({ ...voucherForm, vatMode: 'grouped' })}
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>VAT gộp phiếu</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="vatModeIn"
                          value="per_item"
                          checked={voucherForm.vatMode === 'per_item'}
                          onChange={() => setVoucherForm({ ...voucherForm, vatMode: 'per_item' })}
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span>VAT theo từng dòng</span>
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
                        <option value={0}>0%</option>
                        <option value={5}>5%</option>
                        <option value={8}>8% (Giảm thuế VAT)</option>
                        <option value={10}>10%</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-emerald-500" />
                    Chi Tiết Mặt Hàng Nhập Kho ({lineItems.length} dòng)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm dòng nhập
                  </button>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-semibold">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2 min-w-[200px]">Mặt Hàng Nhập *</th>
                        <th className="p-2 w-24 text-right">Số Lượng</th>
                        <th className="p-2 w-20 text-center">ĐVT</th>
                        <th className="p-2 w-32 text-right">Đơn Giá Nhập</th>
                        {voucherForm.vatMode === 'per_item' && <th className="p-2 w-20 text-center">VAT %</th>}
                        <th className="p-2 w-36 text-right">Thành Tiền</th>
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
                                options={products.map((p) => ({
                                  value: p.id,
                                  label: p.name,
                                  code: p.sku,
                                  badge: `${p.price.toLocaleString('vi-VN')} đ/${p.unit}`,
                                }))}
                              />
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
              <div className="flex flex-col sm:flex-row items-end justify-between p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/50 rounded-xl gap-4">
                <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1">
                  <p className="font-semibold text-zinc-700 dark:text-zinc-300">Ghi nhận tài chính & kho bãi:</p>
                  <p>• Phiếu nhập hoàn thành sẽ tăng tồn kho tương ứng tại kho tiếp nhận.</p>
                  <p>• Thuế VAT đầu vào sẽ được tổng hợp tự động vào bảng phân bổ thuế.</p>
                </div>

                <div className="text-right space-y-1 text-xs w-full sm:w-auto min-w-[240px]">
                  <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                    <span>Tổng tiền hàng mua:</span>
                    <span className="font-mono font-semibold">{calcSubtotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                    <span>Tiền thuế VAT đầu vào:</span>
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      +{calcVatAmount().toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold text-zinc-900 dark:text-zinc-100 pt-1 border-t border-emerald-200 dark:border-emerald-800">
                    <span>Tổng thanh toán NCC:</span>
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
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  {editingVoucher ? 'Cập Nhật Phiếu Nhập' : 'Xác Nhận Nhập Kho & Lưu Lô Hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSStockInPage;