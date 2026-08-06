import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Truck, Plus, Phone, Mail, MapPin, Edit2, Trash2, X } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';

interface SupplierItem {
  id: number;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  payableDebt: number;
}

export const SaaSSuppliersPage: React.FC = () => {
  const { addToast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([
    {
      id: 1,
      code: 'NCC001',
      name: 'Tổng Công Ty Giấy & Bao Bì Double A Việt Nam',
      contactPerson: 'Trần Văn Hoàng',
      phone: '02838221199',
      email: 'sales@doublea.com.vn',
      address: 'KCN Sài Đồng, Quận Long Biên, Hà Nội',
      payableDebt: 120000000,
    },
    {
      id: 2,
      code: 'NCC002',
      name: 'Nhà Phân Phối Linh Kiện Máy Tính SPC',
      contactPerson: 'Phạm Thanh Sơn',
      phone: '0903456789',
      email: 'p.son@spc.com.vn',
      address: '143 Lê Thanh Nghị, Hai Bà Trưng, Hà Nội',
      payableDebt: 60000000,
    },
    {
      id: 3,
      code: 'NCC003',
      name: 'Công Ty TNHH Văn Phòng Phẩm Hồng Hà',
      contactPerson: 'Lê Minh Tú',
      phone: '02438554433',
      email: 'cskh@hongha.com.vn',
      address: 'Lý Thường Kiệt, Hoàn Kiếm, Hà Nội',
      payableDebt: 0,
    },
  ]);

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    payableDebt: 0,
  });

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      payableDebt: 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (supplier: SupplierItem) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      payableDebt: supplier.payableDebt,
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingSupplier) {
      setSuppliers(
        suppliers.map((s) =>
          s.id === editingSupplier.id
            ? {
                ...s,
                name: formData.name,
                contactPerson: formData.contactPerson,
                phone: formData.phone,
                email: formData.email,
                address: formData.address,
                payableDebt: Number(formData.payableDebt),
              }
            : s
        )
      );
      addToast('Cập nhật nhà cung cấp thành công!', 'success');
    } else {
      const newSupplier: SupplierItem = {
        id: Date.now(),
        code: `NCC00${suppliers.length + 1}`,
        name: formData.name,
        contactPerson: formData.contactPerson || 'Trưởng phòng kinh doanh',
        phone: formData.phone,
        email: formData.email,
        address: formData.address || 'Hà Nội',
        payableDebt: Number(formData.payableDebt),
      };
      setSuppliers([newSupplier, ...suppliers]);
      addToast('Thêm nhà cung cấp mới thành công!', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp "${name}"?`)) {
      setSuppliers(suppliers.filter((s) => s.id !== id));
      addToast(`Đã xóa nhà cung cấp "${name}"`, 'warning');
    }
  };

  const columns: ColumnDef<SupplierItem>[] = [
    {
      accessorKey: 'code',
      header: 'Mã NCC',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên Nhà Cung Cấp',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'contactPerson',
      header: 'Người Liên Hệ',
    },
    {
      accessorKey: 'phone',
      header: 'Số Điện Thoại / Email',
      cell: (info) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 font-medium text-zinc-800 dark:text-zinc-200">
            <Phone className="h-3 w-3 text-zinc-400" />
            {info.getValue() as string}
          </div>
          <div className="flex items-center gap-1 text-zinc-500">
            <Mail className="h-3 w-3 text-zinc-400" />
            {info.row.original.email}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'address',
      header: 'Địa Chỉ Kho',
      cell: (info) => (
        <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
          <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'payableDebt',
      header: 'Nợ Phải Trả',
      cell: (info) => {
        const debt = info.getValue() as number;
        return (
          <span className={`font-bold ${debt > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-500'}`}>
            {debt.toLocaleString('vi-VN')} đ
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
            onClick={() => handleOpenEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title="Chỉnh sửa thông tin"
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDelete(row.original.id, row.original.name)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title="Xóa nhà cung cấp"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Truck className="h-6 w-6 text-amber-500" /> Nhà Cung Cấp & Đối Tác
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Quản lý thông tin đầu mối nhập hàng, công nợ phải trả và đánh giá nhà cung ứng.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> Thêm nhà cung cấp
        </button>
      </div>

      <DataTable columns={columns} data={suppliers} searchPlaceholder="Tìm tên nhà cung cấp, mã NCC, SĐT..." />

      {/* Modal Add/Edit Supplier */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-500" />
                {editingSupplier ? 'Chỉnh Sửa Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tên Nhà Cung Cấp *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nhập tên doanh nghiệp / nhà cung cấp"
                  className="w-full px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Người Liên Hệ</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Số Điện Thoại</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="0901234567"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email NCC</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@supplier.com"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Số Dư Nợ Đầu Kỳ (VND)</label>
                  <input
                    type="number"
                    value={formData.payableDebt}
                    onChange={(e) => setFormData({ ...formData, payableDebt: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Địa Chỉ Văn Phòng / Kho Hàng</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="KCN Sài Đồng, Long Biên, Hà Nội"
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs"
                >
                  {editingSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Lưu Nhà Cung Cấp'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
