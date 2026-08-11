import React, { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Truck, Plus, Phone, Mail, MapPin, Edit2, Trash2, X } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);

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
      addToast(t('pages.saas.suppliers.update_success'), 'success');
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
      addToast(t('pages.saas.suppliers.add_success'), 'success');
    }
    setShowModal(false);
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(t('pages.saas.suppliers.confirm_delete', { name }))) {
      setSuppliers(suppliers.filter((s) => s.id !== id));
      addToast(t('pages.saas.suppliers.deleted', { name }), 'warning');
    }
  };

  const columns: ColumnDef<SupplierItem>[] = [
    {
      accessorKey: 'code',
      header: t('pages.saas.suppliers.table.code'),
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: t('pages.saas.suppliers.table.name'),
      cell: (info) => <span className="font-bold text-zinc-900 dark:text-zinc-100">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'contactPerson',
      header: t('pages.saas.suppliers.table.contact'),
    },
    {
      accessorKey: 'phone',
      header: t('pages.saas.suppliers.table.phone_email'),
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
      header: t('pages.saas.suppliers.table.address'),
      cell: (info) => (
        <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
          <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'payableDebt',
      header: t('pages.saas.suppliers.table.payableDebt'),
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
      header: t('pages.saas.suppliers.table.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title={t('pages.saas.suppliers.action.edit')}
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDelete(row.original.id, row.original.name)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title={t('pages.saas.suppliers.action.delete')}
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
            <Truck className="h-6 w-6 text-amber-500" /> {t('pages.saas.suppliers.title')}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{t('pages.saas.suppliers.description')}</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> {t('pages.saas.suppliers.btn.add')}
        </button>
      </div>

      <DataTable columns={columns} data={suppliers} searchPlaceholder={t('pages.saas.suppliers.search_placeholder')} />

      {/* Modal Add/Edit Supplier */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Truck className="h-5 w-5 text-amber-500" />
                {editingSupplier ? t('pages.saas.suppliers.modal.edit_title') : t('pages.saas.suppliers.modal.add_title')}
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
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('pages.saas.suppliers.form.label.name')} *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('pages.saas.suppliers.form.placeholder.name')}
                  className="w-full px-3 py-2 text-sm font-semibold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('pages.saas.suppliers.form.label.contact')}</label>
                  <input
                    type="text"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder={t('pages.saas.suppliers.form.placeholder.contact')}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('pages.saas.suppliers.form.label.phone')}</label>
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
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('pages.saas.suppliers.form.label.email')}</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contact@supplier.com"
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('pages.saas.suppliers.form.label.debt')}</label>
                  <input
                    type="number"
                    value={formData.payableDebt}
                    onChange={(e) => setFormData({ ...formData, payableDebt: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('pages.saas.suppliers.form.label.address')}</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder={t('pages.saas.suppliers.form.placeholder.address')}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  {t('pages.saas.suppliers.btn.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs"
                >
                  {editingSupplier ? t('pages.saas.suppliers.btn.update') : t('pages.saas.suppliers.btn.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
