import React, { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { FileSpreadsheet, Plus, Printer, ArrowRightLeft, Edit2, Trash2, X, Calculator, Send } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SaaSPrintModal } from '../../components/SaaSPrintModal';
import { StatusBadge } from '../../components/StatusBadge';
import { SaaSDateFilterBar, DateFilterValue, filterByDateRange } from '../../components/SaaSDateFilterBar';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { generateERPCode } from '../../utils/format';
import client from '../../api/client';

interface QuotationLineItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

interface QuotationItem {
  id: number;
  code: string;
  date: string;
  validUntil: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: QuotationLineItem[];
  amount: number;
  vatAmount: number;
  totalAmount: number;
  notes: string;
  status: 'Đã gửi' | 'Chấp nhận' | 'Đã xuất hóa đơn' | 'Nháp';
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number;
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
  address: string;
}

export const SaaSQuotationsPage: React.FC = () => {
  const { addToast } = useToast();
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: 'all', fromDate: '', toDate: '' });

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);

  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<QuotationItem | null>(null);

  // Form Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<QuotationItem | null>(null);

  const [formState, setFormState] = useState({
    code: '',
    date: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    customerId: '',
    notes: '',
    vatRate: 10,
    status: 'Đã gửi' as 'Đã gửi' | 'Chấp nhận' | 'Đã xuất hóa đơn' | 'Nháp',
  });

  const [lineItems, setLineItems] = useState<QuotationLineItem[]>([]);

  useEffect(() => {
    const loadDropdownData = async () => {
      try {
        const [prodRes, custRes] = await Promise.all([
          client.get('/api/shop/admin/products?limit=1000&include_inactive=true'),
          client.get('/api/saas/customers'),
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
        if (custRes.data?.ok && Array.isArray(custRes.data.data)) {
          setCustomers(
            custRes.data.data.map((c: any) => ({
              id: String(c.id),
              name: c.name || 'Khách hàng',
              phone: c.phone || '',
              address: c.address || '',
            }))
          );
        }
      } catch (err) {
        console.warn('Failed to load dropdown data:', err);
      }
    };
    loadDropdownData();
  }, []);

  const mapQuotation = (row: any): QuotationItem => {
    const statusMap: Record<string, QuotationItem['status']> = { DA_GUI: 'Đã gửi', DONG_Y: 'Chấp nhận', NHAP: 'Nháp', TU_CHOI: 'Nháp' };
    return {
      id: Number(row.id), code: row.code, date: String(row.date || '').slice(0, 10),
      validUntil: String(row.valid_until || '').slice(0, 10), customerId: String(row.customer_id || ''),
      customerName: row.customer_name || '', customerPhone: row.customer_phone || '', customerAddress: row.customer_address || '',
      items: (row.items || []).map((item: any) => ({ id: String(item.id), productId: String(item.product_id), productName: item.product_name || '', sku: item.sku || '', unit: item.unit || '', quantity: Number(item.quantity) || 0, unitPrice: Number(item.unit_price) || 0 })),
      amount: Number(row.amount) || 0, vatAmount: Number(row.vat_amount) || 0, totalAmount: Number(row.total_amount) || 0,
      notes: row.notes || '', status: statusMap[row.status] || 'Nháp',
    };
  };

  const loadQuotations = async () => {
    const response = await client.get('/api/saas/quotations');
    if (!response.data?.ok) throw new Error(response.data?.message || 'Không tải được báo giá.');
    setQuotations((response.data.data || []).map(mapQuotation));
  };

  useEffect(() => {
    loadQuotations().catch((error: any) => addToast(error?.response?.data?.message || error.message || 'Không tải được báo giá từ cơ sở dữ liệu.', 'error'));
  }, []);

  const handleOpenPrint = (quotation: QuotationItem) => {
    setSelectedQuotation(quotation);
    setPrintModalOpen(true);
  };

  const handleConvertToStockOut = (id: number) => {
    const q = quotations.find((item) => item.id === id);
    if (!q) return;
    setQuotations(
      quotations.map((item) => (item.id === id ? { ...item, status: 'Đã xuất hóa đơn' } : item))
    );
    addToast(`Đã chuyển báo giá "${q.code}" thành công sang Phiếu Xuất Kho Bán Hàng!`, 'success');
  };

  const handleOpenAdd = () => {
    setEditingQuotation(null);
    const nextCode = generateERPCode('BG', quotations.length + 1);
    setFormState({
      code: nextCode,
      date: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      customerId: customers[0]?.id || '',
      notes: '',
      vatRate: 10,
      status: 'Đã gửi',
    });
    setLineItems([]);
    setShowModal(true);
  };

  const handleOpenEdit = (q: QuotationItem) => {
    setEditingQuotation(q);
    setFormState({
      code: q.code,
      date: q.date,
      validUntil: q.validUntil,
      customerId: q.customerId,
      notes: q.notes,
      vatRate: Math.round((q.vatAmount / (q.amount || 1)) * 100) || 10,
      status: q.status,
    });
    setLineItems(q.items);
    setShowModal(true);
  };

  const handleAddLineItem = () => {
    const p = products[0];
    if (!p) {
      addToast('Chưa có sản phẩm thực trong tenant để thêm vào báo giá.', 'error');
      return;
    }
    const newItem: QuotationLineItem = {
      id: `qitem-${Date.now()}`,
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      unit: p.unit,
      quantity: 1,
      unitPrice: p.price,
    };
    setLineItems([...lineItems, newItem]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      addToast('Báo giá phải có ít nhất 1 sản phẩm!', 'warning');
      return;
    }
    setLineItems(lineItems.filter((i) => i.id !== id));
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

  const handleLineChange = (lineId: string, field: keyof QuotationLineItem, value: any) => {
    setLineItems(
      lineItems.map((item) => (item.id === lineId ? { ...item, [field]: value } : item))
    );
  };

  const calcSubtotal = lineItems.reduce((acc, item) => acc + item.quantity * item.unitPrice, 0);
  const calcVat = (calcSubtotal * formState.vatRate) / 100;
  const calcTotal = calcSubtotal + calcVat;

  const handleSaveQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineItems.length) { addToast('Vui lòng thêm sản phẩm vào báo giá!', 'error'); return; }
    const customer = customers.find((item) => item.id === formState.customerId);
    if (!customer) { addToast('Vui lòng chọn khách hàng thực trong tenant.', 'error'); return; }
    try {
      const payload = {
        code: formState.code, date: formState.date, valid_until: formState.validUntil,
        customer_id: Number(customer.id), vat_rate: formState.vatRate,
        status: formState.status === 'Đã gửi' ? 'DA_GUI' : formState.status === 'Chấp nhận' ? 'DONG_Y' : formState.status === 'Nháp' ? 'NHAP' : 'DONG_Y',
        items: lineItems.map((item) => ({ product_id: Number(item.productId), quantity: Number(item.quantity), unit_price: Number(item.unitPrice) })),
      };
      if (editingQuotation) await client.put(`/api/saas/quotations/${editingQuotation.id}`, payload);
      else await client.post('/api/saas/quotations', payload);
      await loadQuotations();
      setShowModal(false);
      addToast(editingQuotation ? `Đã cập nhật Báo giá "${formState.code}"!` : `Đã lưu Báo giá "${formState.code}" vào PostgreSQL!`, 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || error.message || 'Không thể lưu báo giá.', 'error'); }
  };

  const handleDeleteQuotation = async (id: number, code: string) => {
    if (!window.confirm(`Xóa báo giá "${code}"?`)) return;
    try {
      await client.delete(`/api/saas/quotations/${id}`);
      setQuotations((current) => current.filter((quotation) => quotation.id !== id));
      addToast(`Đã xóa báo giá "${code}"`, 'warning');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể xóa báo giá.', 'error'); }
  };

  const columns: ColumnDef<QuotationItem>[] = [
    {
      accessorKey: 'code',
      header: 'Số Báo Giá',
      cell: ({ row, getValue }) => (
        <button
          onClick={() => handleOpenPrint(row.original)}
          className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline hover:text-amber-700 dark:hover:text-amber-300 transition-colors cursor-pointer p-0 bg-transparent inline-flex items-center gap-1"
          title="Click vào số báo giá để xem chi tiết / in"
        >
          {getValue() as string}
        </button>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Ngày Lập',
    },
    {
      accessorKey: 'validUntil',
      header: 'Hiệu Lực Đến',
    },
    {
      accessorKey: 'customerName',
      header: 'Khách Hàng Báo Giá',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Tiền Hàng (Trước VAT)',
      cell: (info) => `${(info.getValue() as number).toLocaleString('vi-VN')} đ`,
    },
    {
      accessorKey: 'totalAmount',
      header: 'Tổng Giá Trị HĐ',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: (info) => <StatusBadge status={info.getValue() as string} />,
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleOpenPrint(row.original)}
            className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
            title="Xem bản in Báo giá chuẩn ERP"
          >
            <Printer className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-amber-500 transition-colors"
            title="Sửa báo giá"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {row.original.status !== 'Đã xuất hóa đơn' && (
            <button
              onClick={() => handleConvertToStockOut(row.original.id)}
              className="px-2.5 py-1 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg shadow-xs transition-colors flex items-center gap-1"
              title="Chuyển báo giá thành Phiếu Xuất Kho Bán Hàng"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Xuất Kho
            </button>
          )}
          <button
            onClick={() => handleDeleteQuotation(row.original.id, row.original.code)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 transition-colors"
            title="Xóa báo giá"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const filteredQuotations = filterByDateRange(quotations, dateFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-amber-500" /> Báo Giá Commercial & Hóa Đơn Thương Mại (ERP)
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Lập báo giá thương mại, tự động tính VAT, thời hạn hiệu lực, chuyển trực tiếp thành Phiếu Xuất Kho & in bản mềm PDF.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> Soạn Báo Giá Mới
        </button>
      </div>

      <SaaSDateFilterBar onFilterChange={(val) => setDateFilter(val)} />

      <DataTable columns={columns} data={filteredQuotations} searchPlaceholder="Tìm số báo giá, tên khách hàng..." />

      {/* Print Modal */}
      {selectedQuotation && (
        <SaaSPrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          docType="quotation"
          docCode={selectedQuotation.code}
          docDate={selectedQuotation.date}
          partnerName={selectedQuotation.customerName}
          partnerAddress={selectedQuotation.customerAddress}
          partnerPhone={selectedQuotation.customerPhone}
          items={selectedQuotation.items.map((i) => ({
            sku: i.sku,
            name: i.productName,
            unit: i.unit,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            amount: i.quantity * i.unitPrice,
          }))}
          totalAmount={selectedQuotation.amount}
          taxAmount={selectedQuotation.vatAmount}
          grandTotal={selectedQuotation.totalAmount}
          notes={selectedQuotation.notes || `Báo giá có hiệu lực đến ngày ${selectedQuotation.validUntil}`}
        />
      )}

      {/* Quotation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full my-auto p-4 sm:p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5 max-h-[95vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {editingQuotation ? `Sửa Báo Giá: ${editingQuotation.code}` : 'Soạn Báo Giá Thương Mại Mới'}
                </h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuotation} className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <label className="block font-semibold mb-1">Số Báo Giá *</label>
                  <input
                    type="text"
                    required
                    value={formState.code}
                    onChange={(e) => setFormState({ ...formState, code: e.target.value })}
                    className="w-full px-3 py-2 font-mono font-bold bg-white dark:bg-zinc-900 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Ngày Lập *</label>
                  <input
                    type="date"
                    required
                    value={formState.date}
                    onChange={(e) => setFormState({ ...formState, date: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Hiệu Lực Đến *</label>
                  <input
                    type="date"
                    required
                    value={formState.validUntil}
                    onChange={(e) => setFormState({ ...formState, validUntil: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Khách Hàng * (Fast Search)</label>
                  <SearchableSelect
                    value={formState.customerId}
                    onChange={(val) => setFormState({ ...formState, customerId: val })}
                    placeholder="Tìm khách hàng..."
                    options={customers.map((c) => ({
                      value: c.id,
                      label: c.name,
                      code: c.id.toUpperCase(),
                      subLabel: `SĐT: ${c.phone} - ${c.address}`,
                    }))}
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Điều Khoản / Ghi Chú</label>
                <input
                  type="text"
                  value={formState.notes}
                  onChange={(e) => setFormState({ ...formState, notes: e.target.value })}
                  placeholder="Ghi chú điều khoản thanh toán, bảo hành, giao hàng..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border rounded-lg"
                />
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-amber-500" /> Chi Tiết Sản Phẩm Báo Giá ({lineItems.length} dòng)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="px-3 py-1 font-bold bg-amber-500 hover:bg-amber-600 text-zinc-950 rounded-lg flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm dòng
                  </button>
                </div>

                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-100 dark:bg-zinc-800 font-semibold">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2">Sản Phẩm *</th>
                        <th className="p-2 w-24 text-right">Số Lượng</th>
                        <th className="p-2 w-20 text-center">ĐVT</th>
                        <th className="p-2 w-32 text-right">Đơn Giá Báo</th>
                        <th className="p-2 w-32 text-right">Thành Tiền</th>
                        <th className="p-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {lineItems.map((item, idx) => (
                        <tr key={item.id}>
                          <td className="p-2 text-center text-zinc-500">{idx + 1}</td>
                          <td className="p-2 min-w-[220px]">
                            <SearchableSelect
                              value={item.productId}
                              onChange={(val) => handleProductChange(item.id, val)}
                              placeholder="Gõ tên hoặc SKU sản phẩm..."
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
                              className="w-full p-1 text-right font-bold bg-white dark:bg-zinc-900 border rounded"
                            />
                          </td>
                          <td className="p-2 text-center text-zinc-500 font-semibold">{item.unit}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleLineChange(item.id, 'unitPrice', Number(e.target.value))}
                              className="w-full p-1 text-right font-mono bg-white dark:bg-zinc-900 border rounded"
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            {(item.quantity * item.unitPrice).toLocaleString('vi-VN')} đ
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(item.id)}
                              className="p-1 text-red-600 rounded hover:bg-red-50"
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

              {/* Total Summary */}
              <div className="flex justify-between items-end p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-xl">
                <div>
                  <label className="block font-semibold mb-1">Thuế Suất VAT (%)</label>
                  <select
                    value={formState.vatRate}
                    onChange={(e) => setFormState({ ...formState, vatRate: Number(e.target.value) })}
                    className="px-3 py-1.5 bg-white dark:bg-zinc-900 border rounded-lg font-bold"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={8}>8%</option>
                    <option value={10}>10%</option>
                  </select>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Tiền hàng: <span className="font-mono font-semibold">{calcSubtotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                  <div className="text-zinc-600 dark:text-zinc-400">
                    Tiền VAT ({formState.vatRate}%):{' '}
                    <span className="font-mono font-semibold text-amber-600">
                      +{calcVat.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                  <div className="text-base font-bold text-emerald-600 pt-1 border-t">
                    Tổng cộng: {calcTotal.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 font-semibold text-zinc-600 hover:bg-zinc-100 rounded-lg"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg"
                >
                  {editingQuotation ? 'Cập Nhật Báo Giá' : 'Lưu & Phát Hành Báo Giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
