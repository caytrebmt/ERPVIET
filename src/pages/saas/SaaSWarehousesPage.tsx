import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Warehouse, Plus, Building2, MapPin, Boxes, CheckCircle2, Edit2, Trash2, X } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';
import client from '../../api/client';

interface WarehouseItem {
  id: number;
  code: string;
  name: string;
  location: string;
  manager: string;
  phone: string;
  capacity: string;
  stockCount: number;
  status: 'Hoạt động' | 'Bảo trì';
}

interface OpeningStockItem {
  id: number;
  sku: string;
  productName: string;
  warehouseName: string;
  warehouseId: number;
  openingQuantity: number;
  openingValue: number;
  unit: string;
}

export const SaaSWarehousesPage: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'warehouses' | 'opening_stock'>('warehouses');

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);

  const [openingStocks, setOpeningStocks] = useState<OpeningStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWarehouseData = async () => {
    setLoading(true);
    try {
      const [warehouseResponse, stockResponse] = await Promise.all([
        client.get('/api/saas/warehouses'),
        client.get('/api/saas/warehouses/opening-stock'),
      ]);
      if (!warehouseResponse.data?.ok) throw new Error(warehouseResponse.data?.message || 'Không tải được kho.');
      setWarehouses((warehouseResponse.data.data || []).map((row: any) => ({
        id: Number(row.id), code: row.code, name: row.name_vi || row.name_en || '',
        location: row.address || '', manager: row.manager_name || '', phone: row.phone || '',
        capacity: row.capacity || '', stockCount: Number(row.stock_count) || 0,
        status: row.is_active === false ? 'Bảo trì' : 'Hoạt động',
      })));
      if (stockResponse.data?.ok) setOpeningStocks((stockResponse.data.data || []).map((row: any) => ({
        id: Number(row.id), sku: row.sku, productName: row.product_name || '', warehouseId: Number(row.warehouse_id),
        warehouseName: row.warehouse_name || '', openingQuantity: Number(row.opening_quantity) || 0,
        openingValue: Number(row.opening_value) || 0, unit: row.unit || '',
      })));
      setLoadError(null);
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || error.message || 'Không tải được kho từ cơ sở dữ liệu.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadWarehouseData(); }, []);

  // Modals state
  const [showWhModal, setShowWhModal] = useState(false);
  const [editingWh, setEditingWh] = useState<WarehouseItem | null>(null);
  const [whFormData, setWhFormData] = useState({
    code: '',
    name: '',
    location: '',
    manager: '',
    phone: '',
    capacity: '500 m²',
  });

  const [showStockModal, setShowStockModal] = useState(false);
  const [editingStock, setEditingStock] = useState<OpeningStockItem | null>(null);
  const [stockFormData, setStockFormData] = useState({
    sku: '',
    productName: '',
    warehouseName: '',
    warehouseId: '',
    openingQuantity: 0,
    openingValue: 0,
    unit: 'Cái',
  });

  // Warehouse CRUD
  const handleOpenWhAdd = () => {
    setEditingWh(null);
    setWhFormData({ code: '', name: '', location: '', manager: '', phone: '', capacity: '500 m²' });
    setShowWhModal(true);
  };

  const handleOpenWhEdit = (wh: WarehouseItem) => {
    setEditingWh(wh);
    setWhFormData({
      code: wh.code,
      name: wh.name,
      location: wh.location,
      manager: wh.manager,
      phone: wh.phone,
      capacity: wh.capacity,
    });
    setShowWhModal(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whFormData.name || !whFormData.code) return;
    try {
      const payload = { code: whFormData.code, name: whFormData.name, address: whFormData.location, manager_name: whFormData.manager, phone: whFormData.phone, capacity: whFormData.capacity };
      if (editingWh) {
        await client.put(`/api/saas/warehouses/${editingWh.id}`, payload);
        addToast('Cập nhật địa điểm kho bãi thành công!', 'success');
      } else {
        await client.post('/api/saas/warehouses', payload);
        addToast('Thêm địa điểm kho bãi mới thành công!', 'success');
      }
      await loadWarehouseData();
      setShowWhModal(false);
    } catch (error: any) {
      addToast(error?.response?.data?.message || error.message || 'Không thể lưu kho.', 'error');
    }
  };

  const handleDeleteWh = async (id: number, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa kho "${name}"?`)) return;
    try {
      await client.delete(`/api/saas/warehouses/${id}`);
      setWarehouses((current) => current.filter((warehouse) => warehouse.id !== id));
      addToast(`Đã xóa kho "${name}"`, 'warning');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể xóa kho.', 'error'); }
  };

  // Opening Stock CRUD
  const handleOpenStockAdd = () => {
    setEditingStock(null);
    setStockFormData({
      sku: '',
      productName: '',
      warehouseName: warehouses[0]?.name || '',
      warehouseId: String(warehouses[0]?.id || ''),
      openingQuantity: 0,
      openingValue: 0,
      unit: 'Cái',
    });
    setShowStockModal(true);
  };

  const handleOpenStockEdit = (item: OpeningStockItem) => {
    setEditingStock(item);
    setStockFormData({
      sku: item.sku,
      productName: item.productName,
      warehouseName: item.warehouseName,
      warehouseId: String(item.warehouseId),
      openingQuantity: item.openingQuantity,
      openingValue: item.openingValue,
      unit: item.unit,
    });
    setShowStockModal(true);
  };

  const handleSaveOpeningStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFormData.productName || !stockFormData.sku || !stockFormData.warehouseId) return;
    try {
      await client.post('/api/saas/warehouses/opening-stock', {
        sku: stockFormData.sku,
        warehouse_id: Number(stockFormData.warehouseId),
        opening_quantity: Number(stockFormData.openingQuantity),
        opening_value: Number(stockFormData.openingValue),
      });
      await loadWarehouseData();
      setShowStockModal(false);
      addToast('Đã lưu tồn kho đầu kỳ vào cơ sở dữ liệu!', 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể lưu tồn đầu kỳ.', 'error'); }
  };

  const handleDeleteStock = async (id: number, productName: string) => {
    if (!window.confirm(`Xóa khai báo số dư đầu kỳ của "${productName}"?`)) return;
    try {
      await client.delete(`/api/saas/warehouses/opening-stock/${id}`);
      setOpeningStocks((current) => current.filter((stock) => stock.id !== id));
      addToast(`Đã xóa dư lượng đầu kỳ "${productName}"`, 'warning');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể xóa tồn đầu kỳ.', 'error'); }
  };

  const warehouseColumns: ColumnDef<WarehouseItem>[] = [
    {
      accessorKey: 'code',
      header: 'Mã Kho',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-xs border border-amber-200 dark:border-amber-800">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên Địa Điểm Kho',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'location',
      header: 'Địa Chỉ Vận Hành',
      cell: (info) => (
        <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
          <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'manager',
      header: 'Thủ Kho Phụ Trách',
      cell: (info) => (
        <div className="text-xs space-y-0.5">
          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{info.getValue() as string}</p>
          <p className="text-zinc-500">{info.row.original.phone}</p>
        </div>
      ),
    },
    {
      accessorKey: 'capacity',
      header: 'Diện Tích',
    },
    {
      accessorKey: 'stockCount',
      header: 'Tổng Mã Lưu Kho',
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md text-xs border border-emerald-200 dark:border-emerald-800">
          {info.getValue() as number} SKU
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Trạng Thái',
      cell: (info) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> {info.getValue() as string}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenWhEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Sửa thông tin kho"
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDeleteWh(row.original.id, row.original.name)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title="Xóa kho bãi"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const openingStockColumns: ColumnDef<OpeningStockItem>[] = [
    {
      accessorKey: 'sku',
      header: 'Mã SKU',
      cell: (info) => <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'productName',
      header: 'Tên Sản Phẩm',
      cell: (info) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'warehouseName',
      header: 'Kho Nhập Số Dư',
    },
    {
      accessorKey: 'openingQuantity',
      header: 'Số Lượng Đầu Kỳ',
      cell: (info) => (
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          {info.getValue() as number} {info.row.original.unit}
        </span>
      ),
    },
    {
      accessorKey: 'openingValue',
      header: 'Giá Trị Tồn Đầu Kỳ',
      cell: (info) => (
        <span className="font-bold text-amber-600 dark:text-amber-400">
          {(info.getValue() as number).toLocaleString('vi-VN')} đ
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenStockEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Sửa số dư"
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDeleteStock(row.original.id, row.original.productName)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title="Xóa dòng tồn"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-amber-500" /> Quản Lý Kho Bãi & Số Dư Đầu Kỳ
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Khai báo danh sách địa điểm kho bãi, phân bổ thủ kho phụ trách và cập nhật tồn kho đầu kỳ.
          </p>
        </div>

        {activeTab === 'warehouses' ? (
          <button
            onClick={handleOpenWhAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
          >
            <Plus className="h-4 w-4" /> Thêm kho bãi mới
          </button>
        ) : (
          <button
            onClick={handleOpenStockAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
          >
            <Plus className="h-4 w-4" /> Khai báo dư lượng đầu kỳ
          </button>
        )}
      </div>

      {loading && <p className="text-xs text-zinc-500">Đang tải kho và tồn đầu kỳ từ PostgreSQL...</p>}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('warehouses')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'warehouses'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Building2 className="h-4 w-4" /> Danh Sách Kho Bãi ({warehouses.length})
        </button>
        <button
          onClick={() => setActiveTab('opening_stock')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 ${
            activeTab === 'opening_stock'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Boxes className="h-4 w-4" /> Số Dư Tồn Kho Đầu Kỳ ({openingStocks.length})
        </button>
      </div>

      {/* Content based on Active Tab */}
      {activeTab === 'warehouses' ? (
        <DataTable columns={warehouseColumns} data={warehouses} searchPlaceholder="Tìm tên kho, mã kho, thủ kho..." />
      ) : (
        <DataTable columns={openingStockColumns} data={openingStocks} searchPlaceholder="Tìm tên sản phẩm, mã SKU đầu kỳ..." />
      )}

      {/* Add / Edit Warehouse Modal */}
      {showWhModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-500" />
                {editingWh ? 'Chỉnh Sửa Địa Điểm Kho' : 'Khai Báo Địa Điểm Kho Mới'}
              </h3>
              <button onClick={() => setShowWhModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Mã Kho *</label>
                  <input
                    type="text"
                    required
                    value={whFormData.code}
                    onChange={(e) => setWhFormData({ ...whFormData, code: e.target.value })}
                    placeholder="VD: KHO-HP"
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Diện tích kho</label>
                  <input
                    type="text"
                    value={whFormData.capacity}
                    onChange={(e) => setWhFormData({ ...whFormData, capacity: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tên Kho *</label>
                <input
                  type="text"
                  required
                  value={whFormData.name}
                  onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
                  placeholder="VD: Kho Hải Phòng - Cảng Đình Vũ"
                  className="w-full px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Địa chỉ chính xác</label>
                <input
                  type="text"
                  value={whFormData.location}
                  onChange={(e) => setWhFormData({ ...whFormData, location: e.target.value })}
                  placeholder="Nhập địa chỉ vận hành kho"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Họ tên thủ kho</label>
                  <input
                    type="text"
                    value={whFormData.manager}
                    onChange={(e) => setWhFormData({ ...whFormData, manager: e.target.value })}
                    placeholder="Tên quản lý kho"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Số điện thoại liên hệ</label>
                  <input
                    type="text"
                    value={whFormData.phone}
                    onChange={(e) => setWhFormData({ ...whFormData, phone: e.target.value })}
                    placeholder="SĐT thủ kho"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowWhModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs"
                >
                  {editingWh ? 'Cập Nhật Kho' : 'Lưu Kho Bãi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Opening Stock Modal */}
      {showStockModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Boxes className="h-5 w-5 text-amber-500" />
                {editingStock ? 'Sửa Tồn Kho Đầu Kỳ' : 'Khai Báo Dư Lượng Tồn Kho Đầu Kỳ'}
              </h3>
              <button onClick={() => setShowStockModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOpeningStock} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Mã SKU *</label>
                  <input
                    type="text"
                    required
                    value={stockFormData.sku}
                    onChange={(e) => setStockFormData({ ...stockFormData, sku: e.target.value })}
                    placeholder="VD: SP005"
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={stockFormData.unit}
                    onChange={(e) => setStockFormData({ ...stockFormData, unit: e.target.value })}
                    placeholder="Cái, Hộp, Kg..."
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tên Sản Phẩm / Vật Tư *</label>
                <input
                  type="text"
                  required
                  value={stockFormData.productName}
                  onChange={(e) => setStockFormData({ ...stockFormData, productName: e.target.value })}
                  placeholder="Nhập tên mặt hàng tồn kho"
                  className="w-full px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Kho Nhập Số Dư</label>
                <select
                  value={stockFormData.warehouseId}
                  onChange={(e) => {
                    const warehouse = warehouses.find((item) => String(item.id) === e.target.value);
                    setStockFormData({ ...stockFormData, warehouseId: e.target.value, warehouseName: warehouse?.name || '' });
                  }}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">Chọn kho</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Số Lượng Tồn</label>
                  <input
                    type="number"
                    value={stockFormData.openingQuantity}
                    onChange={(e) => setStockFormData({ ...stockFormData, openingQuantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tổng Giá Trị (VND)</label>
                  <input
                    type="number"
                    value={stockFormData.openingValue}
                    onChange={(e) => setStockFormData({ ...stockFormData, openingValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs"
                >
                  {editingStock ? 'Cập Nhật Tồn Đầu Kỳ' : 'Lưu Tồn Đầu Kỳ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
