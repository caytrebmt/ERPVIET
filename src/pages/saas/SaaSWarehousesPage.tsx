import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Warehouse, Plus, Building2, MapPin, Boxes, CheckCircle2, Edit2, Trash2, X } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';

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
  openingQuantity: number;
  openingValue: number;
  unit: string;
}

export const SaaSWarehousesPage: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'warehouses' | 'opening_stock'>('warehouses');

  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([
    {
      id: 1,
      code: 'KHO-HN',
      name: 'Kho Chính - Hà Nội',
      location: 'KCN Sài Đồng, Quận Long Biên, Hà Nội',
      manager: 'Nguyễn Văn Khoa',
      phone: '0912 345 678',
      capacity: '1,500 m²',
      stockCount: 420,
      status: 'Hoạt động',
    },
    {
      id: 2,
      code: 'KHO-HCM',
      name: 'Kho Phụ - TP. Hồ Chí Minh',
      location: 'KCN Tân Bình, Phường 15, Quận Tân Bình, TP.HCM',
      manager: 'Lê Minh Tuấn',
      phone: '0988 765 432',
      capacity: '800 m²',
      stockCount: 180,
      status: 'Hoạt động',
    },
    {
      id: 3,
      code: 'KHO-DN',
      name: 'Kho Miền Trung - Đà Nẵng',
      location: 'KCN Hòa Khánh, Cẩm Lệ, Đà Nẵng',
      manager: 'Trần Thị Mai',
      phone: '0905 112 233',
      capacity: '500 m²',
      stockCount: 95,
      status: 'Hoạt động',
    },
  ]);

  const [openingStocks, setOpeningStocks] = useState<OpeningStockItem[]>([
    {
      id: 1,
      sku: 'SP001',
      productName: 'Laptop Dell Inspiron 15 3520',
      warehouseName: 'Kho Chính - Hà Nội',
      openingQuantity: 10,
      openingValue: 155000000,
      unit: 'Cái',
    },
    {
      id: 2,
      sku: 'VT001',
      productName: 'Giấy A4 Double A 70gsm (Ream 500 tờ)',
      warehouseName: 'Kho Phụ - TP. Hồ Chí Minh',
      openingQuantity: 100,
      openingValue: 5200000,
      unit: 'Ream',
    },
    {
      id: 3,
      sku: 'VT002',
      productName: 'Bìa thái A4 400G (Tệp 100 tờ)',
      warehouseName: 'Kho Chính - Hà Nội',
      openingQuantity: 50,
      openingValue: 3400000,
      unit: 'Tệp',
    },
  ]);

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
    warehouseName: 'Kho Chính - Hà Nội',
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

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whFormData.name || !whFormData.code) return;

    if (editingWh) {
      setWarehouses(
        warehouses.map((w) =>
          w.id === editingWh.id
            ? {
                ...w,
                code: whFormData.code.toUpperCase(),
                name: whFormData.name,
                location: whFormData.location,
                manager: whFormData.manager,
                phone: whFormData.phone,
                capacity: whFormData.capacity,
              }
            : w
        )
      );
      addToast('Cập nhật địa điểm kho bãi thành công!', 'success');
    } else {
      const newWh: WarehouseItem = {
        id: Date.now(),
        code: whFormData.code.toUpperCase(),
        name: whFormData.name,
        location: whFormData.location || 'Hà Nội, Việt Nam',
        manager: whFormData.manager || 'Quản Kho',
        phone: whFormData.phone || '0900000000',
        capacity: whFormData.capacity,
        stockCount: 0,
        status: 'Hoạt động',
      };
      setWarehouses([...warehouses, newWh]);
      addToast('Thêm địa điểm kho bãi mới thành công!', 'success');
    }
    setShowWhModal(false);
  };

  const handleDeleteWh = (id: number, name: string) => {
    if (window.confirm(`Bạn có chắc muốn xóa kho "${name}"?`)) {
      setWarehouses(warehouses.filter((w) => w.id !== id));
      addToast(`Đã xóa kho "${name}"`, 'warning');
    }
  };

  // Opening Stock CRUD
  const handleOpenStockAdd = () => {
    setEditingStock(null);
    setStockFormData({
      sku: '',
      productName: '',
      warehouseName: 'Kho Chính - Hà Nội',
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
      openingQuantity: item.openingQuantity,
      openingValue: item.openingValue,
      unit: item.unit,
    });
    setShowStockModal(true);
  };

  const handleSaveOpeningStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFormData.productName || !stockFormData.sku) return;

    if (editingStock) {
      setOpeningStocks(
        openingStocks.map((s) =>
          s.id === editingStock.id
            ? {
                ...s,
                sku: stockFormData.sku.toUpperCase(),
                productName: stockFormData.productName,
                warehouseName: stockFormData.warehouseName,
                openingQuantity: Number(stockFormData.openingQuantity),
                openingValue: Number(stockFormData.openingValue),
                unit: stockFormData.unit,
              }
            : s
        )
      );
      addToast('Cập nhật số dư tồn kho đầu kỳ thành công!', 'success');
    } else {
      const newStock: OpeningStockItem = {
        id: Date.now(),
        sku: stockFormData.sku.toUpperCase(),
        productName: stockFormData.productName,
        warehouseName: stockFormData.warehouseName,
        openingQuantity: Number(stockFormData.openingQuantity),
        openingValue: Number(stockFormData.openingValue),
        unit: stockFormData.unit,
      };
      setOpeningStocks([...openingStocks, newStock]);
      addToast('Khai báo tồn kho đầu kỳ thành công!', 'success');
    }
    setShowStockModal(false);
  };

  const handleDeleteStock = (id: number, productName: string) => {
    if (window.confirm(`Xóa khai báo số dư đầu kỳ của "${productName}"?`)) {
      setOpeningStocks(openingStocks.filter((s) => s.id !== id));
      addToast(`Đã xóa dư lượng đầu kỳ "${productName}"`, 'warning');
    }
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
                  value={stockFormData.warehouseName}
                  onChange={(e) => setStockFormData({ ...stockFormData, warehouseName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.name}>
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
