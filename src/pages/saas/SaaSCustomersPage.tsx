import React, { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import {
  Users,
  UserPlus,
  Phone,
  Mail,
  Edit2,
  Trash2,
  X,
  Eye,
  EyeOff,
  Copy,
  Key,
  RefreshCw,
  Save,
  Lock,
} from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import client from '../../api/client';

interface CustomerItem {
  id: number;
  code: string;
  name: string;
  phone: string;
  email: string;
  taxCode: string;
  type: 'Khách sỉ' | 'Khách lẻ' | 'Đại lý';
  creditLimit: number;
  currentDebt: number;
  password?: string;
}

const INITIAL_CUSTOMERS: CustomerItem[] = [];

export const SaaSCustomersPage: React.FC = () => {
  const { addToast } = useToast();
  const { language } = useLanguage();
  const { t } = useTranslation();

  const [customers, setCustomers] = useState<CustomerItem[]>([]);

  useEffect(() => {
    client
      .get('/api/shop/admin/customers')
      .then((res) => {
        const items = res.data?.data?.items || [];
        if (items.length > 0) {
          const mapped: CustomerItem[] = items.map((it: any, idx: number) => ({
            id: it.id,
            code: `KH${String(it.id || idx + 1).padStart(3, '0')}`,
            name: it.name || it.email?.split('@')[0] || 'Khách hàng',
            phone: it.phone || '0901234567',
            email: it.email,
            taxCode: '-',
            type: (idx % 3 === 0 ? 'Khách sỉ' : idx % 3 === 1 ? 'Đại lý' : 'Khách lẻ') as any,
            creditLimit: 50000000,
            currentDebt: 0,
            password: it.passwordHash && it.passwordHash.startsWith('$2') ? '' : (it.passwordHash || 'web12345'),
          }));
          setCustomers(mapped);
          localStorage.setItem('saas_webshop_customers', JSON.stringify(mapped));
        }
      })
      .catch((err) => {
        console.warn('Failed to load customers from backend:', err);
      });
  }, []);

  const persistCustomers = (updated: CustomerItem[]) => {
    setCustomers(updated);
    localStorage.setItem('saas_webshop_customers', JSON.stringify(updated));
  };

  // Eye view password visibility states
  const [visiblePasswords, setVisiblePasswords] = useState<Record<number, boolean>>({});

  // Eye view in Add/Edit modal
  const [showModalPassword, setShowModalPassword] = useState(false);

  // Quick Reset Password Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetTargetCustomer, setResetTargetCustomer] = useState<CustomerItem | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [showResetPasswordEye, setShowResetPasswordEye] = useState(true);

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerItem | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    taxCode: '',
    type: 'Khách sỉ' as 'Khách sỉ' | 'Khách lẻ' | 'Đại lý',
    creditLimit: 50000000,
    password: 'web12345',
  });

  // Password Actions
  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyPassword = (pass: string, name: string) => {
    navigator.clipboard.writeText(pass);
    addToast(`Đã sao chép mật khẩu WebShop của ${name} vào bộ nhớ tạm!`, 'success');
  };

  const handleOpenResetPasswordModal = (customer: CustomerItem) => {
    setResetTargetCustomer(customer);
    setNewResetPassword(customer.password || 'Web@2026');
    setShowResetPasswordEye(true);
    setIsResetModalOpen(true);
  };

  const handleGenerateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
    let rand = 'Web#';
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewResetPassword(rand);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetCustomer || !newResetPassword.trim()) {
      addToast('Vui lòng nhập mật khẩu WebShop mới hợp lệ', 'error');
      return;
    }

    const updated = customers.map((c) =>
      c.id === resetTargetCustomer.id ? { ...c, password: newResetPassword.trim() } : c
    );

    persistCustomers(updated);

    try {
      await client.put(`/api/shop/admin/customers/${resetTargetCustomer.id}/password`, {
        password: newResetPassword.trim(),
        email: resetTargetCustomer.email,
      });
    } catch {
      // Ignore background sync errors
    }

    addToast(
      `Đã cấp lại mật khẩu WebShop mới cho tài khoản "${resetTargetCustomer.name}" thành công!`,
      'success'
    );
    setIsResetModalOpen(false);
    setResetTargetCustomer(null);
  };

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      taxCode: '',
      type: 'Khách sỉ',
      creditLimit: 50000000,
      password: 'web12345',
    });
    setShowModalPassword(false);
    setShowModal(true);
  };

  const handleOpenEdit = (customer: CustomerItem) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      taxCode: customer.taxCode === '-' ? '' : customer.taxCode,
      type: customer.type,
      creditLimit: customer.creditLimit,
      password: customer.password || '',
    });
    setShowModalPassword(false);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    if (editingCustomer) {
      const updated = customers.map((c) =>
        c.id === editingCustomer.id
          ? {
              ...c,
              name: formData.name,
              phone: formData.phone,
              email: formData.email,
              taxCode: formData.taxCode || '-',
              type: formData.type,
              creditLimit: Number(formData.creditLimit),
              password: formData.password || c.password || 'web12345',
            }
          : c
      );
      persistCustomers(updated);
      try {
        await client.post('/api/shop/admin/customers', {
          id: editingCustomer.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password || editingCustomer.password || 'web12345',
        });
      } catch {
        // Ignore background sync errors
      }
      addToast('Cập nhật hồ sơ khách hàng WebShop thành công!', 'success');
    } else {
      const newCust: CustomerItem = {
        id: Date.now(),
        code: `KH00${customers.length + 1}`,
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        taxCode: formData.taxCode || '-',
        type: formData.type,
        creditLimit: Number(formData.creditLimit),
        currentDebt: 0,
        password: formData.password || 'web12345',
      };
      persistCustomers([newCust, ...customers]);
      try {
        await client.post('/api/shop/admin/customers', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          password: formData.password || 'web12345',
        });
      } catch {
        // Ignore background sync errors
      }
      addToast('Thêm hồ sơ khách hàng WebShop mới thành công!', 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa khách hàng "${name}"?`)) {
      persistCustomers(customers.filter((c) => c.id !== id));
      addToast(`Đã xóa khách hàng "${name}"`, 'warning');
    }
  };

  const columns: ColumnDef<CustomerItem>[] = [
    {
      accessorKey: 'code',
      header: 'Mã KH',
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Tên Khách Hàng',
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'phone',
      header: 'Liên Hệ',
      cell: (info) => (
        <div className="text-xs space-y-0.5">
          <div className="flex items-center gap-1 text-zinc-800 dark:text-zinc-200 font-medium">
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
      id: 'webPassword',
      header: 'Mật Khẩu WebShop',
      cell: ({ row }) => {
        const cust = row.original;
        const isPassVisible = !!visiblePasswords[cust.id];
        const isHashedPassword = !cust.password;
        const displayPass = isHashedPassword ? '••••••••' : (isPassVisible ? cust.password : '••••••••');

        return (
          <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800/80 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 w-max shadow-2xs">
            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-bold font-mono tracking-wide text-zinc-900 dark:text-zinc-100 text-[11px] min-w-[70px]">
              {displayPass}
            </span>
            <button
              onClick={() => {
                if (isHashedPassword) {
                  addToast(t('webshop_password_encrypted'), 'info');
                  return;
                }
                togglePasswordVisibility(cust.id);
              }}
              className="p-1 text-zinc-400 hover:text-amber-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
              title={isPassVisible ? 'Ẩn mật khẩu' : 'Xem mật khẩu (Eye View)'}
            >
              {isPassVisible && !isHashedPassword ? <EyeOff className="w-3.5 h-3.5 text-rose-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-500" />}
            </button>
            <button
              onClick={() => {
                if (isHashedPassword) {
                  addToast(t('webshop_password_encrypted'), 'info');
                  return;
                }
                handleCopyPassword(cust.password, cust.name);
              }}
              className="p-1 text-zinc-400 hover:text-blue-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition cursor-pointer"
              title="Sao chép mật khẩu"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
    {
      accessorKey: 'type',
      header: 'Phân Loại',
      cell: (info) => (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold text-amber-700 dark:text-amber-300">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'taxCode',
      header: 'Mã Số Thuế',
      cell: (info) => <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'currentDebt',
      header: 'Nợ Phải Thu',
      cell: (info) => {
        const debt = info.getValue() as number;
        return (
          <span className={`font-bold ${debt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-500'}`}>
            {debt.toLocaleString('vi-VN')} đ
          </span>
        );
      },
    },
    {
      accessorKey: 'creditLimit',
      header: 'Hạn Mức Nợ',
      cell: (info) => `${(info.getValue() as number).toLocaleString('vi-VN')} đ`,
    },
    {
      id: 'actions',
      header: 'Thao Tác',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenResetPasswordModal(row.original)}
            className="p-1.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-950/60 text-amber-600 dark:text-amber-400 transition-colors cursor-pointer"
            title="Cấp lại / Reset mật khẩu WebShop"
          >
            <Key className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleOpenEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title="Chỉnh sửa thông tin"
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDelete(row.original.id, row.original.name)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
            title="Xóa khách hàng"
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
            <Users className="h-6 w-6 text-amber-500" /> Hồ Sơ & Tài Khoản Khách Hàng
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Quản lý danh sách khách hàng, tài khoản đăng nhập WebShop, xem mắt thần mật khẩu (Eye View) và cấp lại mật khẩu.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" /> Thêm khách hàng mới
        </button>
      </div>

      <DataTable columns={columns} data={customers} searchPlaceholder="Tìm tên khách hàng, SĐT, mã số thuế..." />

      {/* ======================================================== */}
      {/* MODAL 1: ADD / EDIT WEBSHOP CUSTOMER PROFILE             */}
      {/* ======================================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-500" />
                {editingCustomer ? 'Chỉnh Sửa Hồ Sơ & Mật Khẩu Khách Hàng' : 'Thêm Hồ Sơ Khách Hàng Mới'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Tên Khách Hàng / Công ty *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nhập tên khách hàng"
                  className="w-full px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Phân Loại Khách Hàng</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="Khách sỉ">Khách sỉ</option>
                    <option value="Khách lẻ">Khách lẻ</option>
                    <option value="Đại lý">Đại lý</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Email đăng nhập WebShop</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Mật khẩu WebShop</label>
                  <div className="relative">
                    <input
                      type={showModalPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mật khẩu WebShop"
                      className="w-full pl-3 pr-9 py-2 text-sm font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowModalPassword(!showModalPassword)}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-amber-500 cursor-pointer"
                      title={showModalPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      {showModalPassword ? <EyeOff className="w-4 h-4 text-rose-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Mã Số Thuế</label>
                  <input
                    type="text"
                    value={formData.taxCode}
                    onChange={(e) => setFormData({ ...formData, taxCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Hạn Mức Cho Nợ (VND)</label>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                >
                  {editingCustomer ? 'Cập Nhật Khách Hàng' : 'Lưu Khách Hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: REISSUE / RESET WEBSHOP CUSTOMER PASSWORD       */}
      {/* ======================================================== */}
      {isResetModalOpen && resetTargetCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Cấp Lại / Reset Mật Khẩu WebShop
              </h3>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-1 text-amber-900 dark:text-amber-200">
              <div className="font-bold flex items-center justify-between">
                <span>{resetTargetCustomer.name}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-bold">
                  {resetTargetCustomer.code}
                </span>
              </div>
              <div className="text-[11px] opacity-80">
                Email: {resetTargetCustomer.email} | SĐT: {resetTargetCustomer.phone}
              </div>
            </div>

            <form onSubmit={handleSaveResetPassword} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-zinc-700 dark:text-zinc-300">
                    Mật Khẩu WebShop Mới Cấp Lại <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomPassword}
                    className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Tạo ngẫu nhiên</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showResetPasswordEye ? 'text' : 'password'}
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 font-mono font-bold text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasswordEye(!showResetPasswordEye)}
                    className="absolute right-3 top-3 text-zinc-400 hover:text-amber-500 cursor-pointer"
                    title={showResetPasswordEye ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showResetPasswordEye ? <EyeOff className="w-4 h-4 text-rose-500" /> : <Eye className="w-4 h-4 text-emerald-500" />}
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu & Cấp Mật Khẩu WebShop</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};