import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Tag, Scale, Plus, Trash2, Edit2, CheckCircle2, X, RefreshCw, Languages } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import client from '../../api/client';
import { getIntlLocale, pickLocalized } from '../../utils/localized';

interface CategoryItem {
  id: number;
  code: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  description: string;
  description_vi?: string;
  description_en?: string;
  productCount: number;
  status: 'Hoạt động' | 'Tạm khóa';
}

interface UnitItem {
  id: number;
  code: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  description: string;
  description_vi?: string;
  description_en?: string;
  isFractional: boolean;
}

interface UomConversionItem {
  id: number;
  fromUnit: string;
  toUnit: string;
  factor: number;
  note: string;
  note_vi?: string;
  note_en?: string;
}

export const SaaSCategoriesUnitsPage: React.FC = () => {
  const { addToast } = useToast();
  const { language, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'categories' | 'units' | 'conversions'>('categories');

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [conversions, setConversions] = useState<UomConversionItem[]>([]);

  // Category Modals & Form State
  const [showCatModal, setShowCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState<CategoryItem | null>(null);
  const [catFormData, setCatFormData] = useState({
    code: '',
    name_vi: '',
    name_en: '',
    description_vi: '',
    description_en: '',
  });

  // Unit Modals & Form State
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitItem | null>(null);
  const [unitFormData, setUnitFormData] = useState({
    code: '',
    name_vi: '',
    name_en: '',
    description_vi: '',
    description_en: '',
    isFractional: false,
  });

  // UOM Conversion Modals & Form State
  const [showConvModal, setShowConvModal] = useState(false);
  const [convFormData, setConvFormData] = useState({ fromUnit: 'Thùng', toUnit: 'Hộp', factor: 12, note_vi: '', note_en: '' });

  useEffect(() => {
    Promise.all([client.get('/api/saas/categories'), client.get('/api/saas/uom')])
      .then(([categoryRes, uomRes]) => {
        if (categoryRes.data?.ok) setCategories(categoryRes.data.data.map((item: any) => ({ ...item, name: item.name_vi || item.name, description: item.description || '', productCount: Number(item.product_count || 0), status: item.is_active === false ? 'Tạm khóa' : 'Hoạt động' })));
        if (uomRes.data?.ok) setUnits(uomRes.data.data.map((item: any) => ({ ...item, name: item.name_vi || item.name, description: item.description || '', isFractional: Boolean(item.is_fractional) })));
      })
      .catch(() => addToast(t('khong_the_tai_du_lieu', 'Không thể tải dữ liệu danh mục từ PostgreSQL.'), 'error'));
  }, []);

  const handleOpenCatAdd = () => {
    setEditingCat(null);
    setCatFormData({ code: '', name_vi: '', name_en: '', description_vi: '', description_en: '' });
    setShowCatModal(true);
  };

  const handleOpenCatEdit = (cat: CategoryItem) => {
    setEditingCat(cat);
    setCatFormData({
      code: cat.code,
      name_vi: cat.name_vi || cat.name,
      name_en: cat.name_en || cat.name,
      description_vi: cat.description_vi || cat.description,
      description_en: cat.description_en || cat.description,
    });
    setShowCatModal(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormData.name_vi || !catFormData.code) return;
    try {
      const payload = { code: catFormData.code, name_vi: catFormData.name_vi, name_en: catFormData.name_en };
      if (editingCat) await client.put(`/api/saas/categories/${editingCat.id}`, payload);
      else await client.post('/api/saas/categories', payload);
      const response = await client.get('/api/saas/categories');
      if (response.data?.ok) setCategories(response.data.data.map((item: any) => ({ ...item, name: item.name_vi || item.name, description: item.description || '', productCount: Number(item.product_count || 0), status: item.is_active === false ? 'Tạm khóa' : 'Hoạt động' })));
      setShowCatModal(false);
      addToast(pickLocalized(language === 'en', (editingCat ? 'Updated category successfully!' : 'Created new category successfully!'), (editingCat ? 'Cập nhật danh mục hàng hóa thành công!' : 'Thêm danh mục mới thành công!')), 'success');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể lưu danh mục vào cơ sở dữ liệu.', 'error'); }
  };

  const handleDeleteCategory = async (id: number, cat: CategoryItem) => {
    const catName = pickLocalized(language === 'en', (cat.name_en || cat.name), (cat.name_vi || cat.name));
    if (!window.confirm(t('ban_co_chac_muon_xoa', 'Bạn có chắc muốn xóa nhóm danh mục "{{catname}}"?', { catname: catName }))) return;
    try {
      await client.delete(`/api/saas/categories/${id}`);
      setCategories((current) => current.filter((item) => item.id !== id));
      addToast(t('da_xoa_danh_muc_deleted', 'Đã xóa danh mục "{{catname}}"', { catname: catName }), 'warning');
    } catch (error: any) { addToast(error?.response?.data?.message || 'Không thể xóa danh mục.', 'error'); }
  };

  const handleOpenUnitAdd = () => {
    setEditingUnit(null);
    setUnitFormData({ code: '', name_vi: '', name_en: '', description_vi: '', description_en: '', isFractional: false });
    setShowUnitModal(true);
  };

  const handleOpenUnitEdit = (u: UnitItem) => {
    setEditingUnit(u);
    setUnitFormData({
      code: u.code,
      name_vi: u.name_vi || u.name,
      name_en: u.name_en || u.name,
      description_vi: u.description_vi || u.description,
      description_en: u.description_en || u.description,
      isFractional: u.isFractional,
    });
    setShowUnitModal(true);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unitFormData.name_vi || !unitFormData.code) return;

    if (editingUnit) {
      setUnits(
        units.map((u) =>
          u.id === editingUnit.id
            ? {
                ...u,
                code: unitFormData.code.toUpperCase(),
                name: unitFormData.name_vi,
                name_vi: unitFormData.name_vi,
                name_en: unitFormData.name_en || unitFormData.name_vi,
                description: unitFormData.description_vi,
                description_vi: unitFormData.description_vi,
                description_en: unitFormData.description_en || unitFormData.description_vi,
                isFractional: unitFormData.isFractional,
              }
            : u
        )
      );
      addToast(t('cap_nhat_don_vi_tinh', 'Cập nhật đơn vị tính thành công!'), 'success');
    } else {
      const newUnit: UnitItem = {
        id: Date.now(),
        code: unitFormData.code.toUpperCase(),
        name: unitFormData.name_vi,
        name_vi: unitFormData.name_vi,
        name_en: unitFormData.name_en || unitFormData.name_vi,
        description: unitFormData.description_vi || 'Mô tả chuẩn',
        description_vi: unitFormData.description_vi || 'Mô tả chuẩn',
        description_en: unitFormData.description_en || 'Standard description',
        isFractional: unitFormData.isFractional,
      };
      setUnits([...units, newUnit]);
      addToast(t('them_don_vi_tinh_moi', 'Thêm đơn vị tính mới thành công!'), 'success');
    }
    setShowUnitModal(false);
  };

  const handleDeleteUnit = (id: number, u: UnitItem) => {
    const unitName = pickLocalized(language === 'en', (u.name_en || u.name), (u.name_vi || u.name));
    if (window.confirm(t('ban_co_chac_muon_xoa_2', 'Bạn có chắc muốn xóa đơn vị tính "{{unitname}}"?', { unitname: unitName }))) {
      setUnits(units.filter((unit) => unit.id !== id));
      addToast(t('da_xoa_don_vi_tinh', 'Đã xóa đơn vị tính "{{unitname}}"', { unitname: unitName }), 'warning');
    }
  };

  const categoryColumns: ColumnDef<CategoryItem>[] = [
    {
      accessorKey: 'code',
      header: t('saas_categories_units_ma_danh_muc', 'Mã Danh Mục'),
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 ">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: t('saas_categories_units_ten_nhom_hang_hoa', 'Tên Nhóm Hàng Hóa'),
      cell: ({ row }) => {
        const cat = row.original;
        const name = pickLocalized(language === 'en', (cat.name_en || cat.name), (cat.name_vi || cat.name));
        const altName = pickLocalized(language === 'en', cat.name_vi, cat.name_en);
        return (
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{name}</span>
            {altName && altName !== name && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic block">{altName}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'description',
      header: t('saas_categories_units_mo_ta_chi_tiet', 'Mô Tả Chi Tiết'),
      cell: ({ row }) => {
        const cat = row.original;
        const desc = pickLocalized(language === 'en', (cat.description_en || cat.description), (cat.description_vi || cat.description));
        return <span className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm truncate block">{desc}</span>;
      },
    },
    {
      accessorKey: 'productCount',
      header: t('saas_categories_units_so_san_pham', 'Số Sản Phẩm'),
      cell: (info) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-md text-xs border border-emerald-200 dark:border-emerald-800">
          {info.getValue() as number} {t('api_fallback_order_item', 'Sản phẩm')}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('status', 'Trạng Thái'),
      cell: () => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> {t('saas_categories_units_hoat_dong', 'Hoạt động')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: t('actions', 'Thao Tác'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenCatEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title={t('saas_categories_units_sua_danh_muc', 'Sửa danh mục')}
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDeleteCategory(row.original.id, row.original)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title={t('saas_categories_units_xoa_danh_muc', 'Xóa danh mục')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const unitColumns: ColumnDef<UnitItem>[] = [
    {
      accessorKey: 'code',
      header: t('saas_categories_units_ma_dvt', 'Mã ĐVT'),
      cell: (info) => <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{info.getValue() as string}</span>,
    },
    {
      accessorKey: 'name',
      header: t('saas_categories_units_ten_d_n_vi_tinh', 'Tên Đơn Vị Tính'),
      cell: ({ row }) => {
        const u = row.original;
        const name = pickLocalized(language === 'en', (u.name_en || u.name), (u.name_vi || u.name));
        const altName = pickLocalized(language === 'en', u.name_vi, u.name_en);
        return (
          <div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100 block">{name}</span>
            {altName && altName !== name && (
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic block">{altName}</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'description',
      header: t('saas_categories_units_dien_giai_chuan', 'Diễn Giải Chuẩn'),
      cell: ({ row }) => {
        const u = row.original;
        const desc = pickLocalized(language === 'en', (u.description_en || u.description), (u.description_vi || u.description));
        return <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>;
      },
    },
    {
      accessorKey: 'isFractional',
      header: t('cho_phep_le_thap_phan', 'Cho Phép Lẻ / Thập Phân'),
      cell: (info) => {
        const frac = info.getValue() as boolean;
        return (
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              frac ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}
          >
            {frac ? (t('co_so_thap_phan_yes', 'Có (Số thập phân)')) : (t('khong_so_nguyen_no_integer', 'Không (Số nguyên)'))}
          </span>
        );
      },
    },
    {
      id: 'actions',
      header: t('actions', 'Thao Tác'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenUnitEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
            title={t('saas_categories_units_sua_dvt', 'Sửa ĐVT')}
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDeleteUnit(row.original.id, row.original)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
            title={t('saas_categories_units_xoa_dvt', 'Xóa ĐVT')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const conversionColumns: ColumnDef<UomConversionItem>[] = [
    {
      accessorKey: 'fromUnit',
      header: t('saas_categories_units_d_n_vi_goc', 'Đơn Vị Gốc'),
      cell: (info) => (
        <span className="font-bold text-amber-700 dark:text-amber-400 ">
          1 {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'factor',
      header: t('saas_categories_units_he_so_quy_doi', 'Hệ Số Quy Đổi'),
      cell: (info) => (
        <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
          = {(info.getValue() as number).toLocaleString(getIntlLocale(language === 'en'))}
        </span>
      ),
    },
    {
      accessorKey: 'toUnit',
      header: t('saas_categories_units_d_n_vi_quy_doi', 'Đơn Vị Quy Đổi'),
      cell: (info) => (
        <span className="font-bold text-blue-700 dark:text-blue-400 ">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'note',
      header: t('saas_categories_units_ghi_chu_quy_chuan', 'Ghi Chú Quy Chuẩn'),
      cell: ({ row }) => {
        const c = row.original;
        const note = pickLocalized(language === 'en', (c.note_en || c.note), (c.note_vi || c.note));
        return <span className="text-xs text-zinc-600 dark:text-zinc-400">{note}</span>;
      },
    },
    {
      id: 'actions',
      header: t('actions', 'Thao Tác'),
      cell: ({ row }) => (
        <button
          onClick={() => {
            if (window.confirm(t('ban_co_chac_muon_xoa_3', 'Bạn có chắc muốn xóa tỷ lệ quy đổi này?'))) {
              setConversions(conversions.filter((c) => c.id !== row.original.id));
              addToast(t('da_xoa_ty_le_quy', 'Đã xóa tỷ lệ quy đổi UOM'), 'warning');
            }
          }}
          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors"
          title={t('saas_categories_units_xoa_ty_le_quy_doi', 'Xóa tỷ lệ quy đổi')}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Tag className="h-6 w-6 text-amber-500" />{' '}
            {t('danh_muc_nhom_hang_don', 'Danh Mục Nhóm Hàng & Đơn Vị Tính (UOM)')}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t('thiet_lap_danh_muc_phan', 'Thiết lập danh mục phân loại vật tư, quy chuẩn đơn vị tính và bảng quy đổi ĐVT linh hoạt 2 ngôn ngữ.')}
          </p>
        </div>

        {activeTab === 'categories' && (
          <button
            onClick={handleOpenCatAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> {t('saas_categories_units_them_danh_muc_moi', 'Thêm danh mục mới')}
          </button>
        )}
        {activeTab === 'units' && (
          <button
            onClick={handleOpenUnitAdd}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> {t('them_don_vi_tinh_moi_2', 'Thêm đơn vị tính mới')}
          </button>
        )}
        {activeTab === 'conversions' && (
          <button
            onClick={() => {
              setConvFormData({ fromUnit: 'Thùng', toUnit: 'Hộp', factor: 12, note_vi: '', note_en: '' });
              setShowConvModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> {t('them_quy_doi_uom_moi', 'Thêm quy đổi UOM mới')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('categories')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'categories'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Tag className="h-4 w-4" />{' '}
          {t('nhom_danh_muc_hang_categories', 'Nhóm Danh Mục Hàng ({{length}})', { length: categories.length })}
        </button>
        <button
          onClick={() => setActiveTab('units')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'units'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <Scale className="h-4 w-4" />{' '}
          {t('chuan_don_vi_tinh_units', 'Chuẩn Đơn Vị Tính ({{length}})', { length: units.length })}
        </button>
        <button
          onClick={() => setActiveTab('conversions')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
            activeTab === 'conversions'
              ? 'bg-amber-500 text-zinc-950 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <RefreshCw className="h-4 w-4" />{' '}
          {t('ty_le_quy_doi_uom', 'Tỷ Lệ Quy Đổi UOM ({{length}})', { length: conversions.length })}
        </button>
      </div>

      {activeTab === 'categories' && (
        <DataTable
          columns={categoryColumns}
          data={categories}
          searchPlaceholder={t('tim_ten_nhom_hang_ma', 'Tìm tên nhóm hàng, mã danh mục...')}
        />
      )}
      {activeTab === 'units' && (
        <DataTable
          columns={unitColumns}
          data={units}
          searchPlaceholder={t('tim_don_vi_tinh_dien', 'Tìm đơn vị tính, diễn giải...')}
        />
      )}
      {activeTab === 'conversions' && (
        <DataTable
          columns={conversionColumns}
          data={conversions}
          searchPlaceholder={t('tim_don_vi_quy_doi', 'Tìm đơn vị quy đổi, ghi chú...')}
        />
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Tag className="h-5 w-5 text-amber-500" />
                {editingCat
                  ? t('chinh_sua_nhom_hang_edit', 'Chỉnh Sửa Nhóm Hàng')
                  : t('tao_nhom_danh_muc_moi', 'Tạo Nhóm Danh Mục Mới')}
              </h3>
              <button
                onClick={() => setShowCatModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_categories_units_ma_nhom', 'Mã Nhóm *')}
                </label>
                <input
                  type="text"
                  required
                  value={catFormData.code}
                  onChange={(e) => setCatFormData({ ...catFormData, code: e.target.value })}
                  placeholder={t('vd_cat_gear', 'VD: CAT-GEAR')}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Languages className="h-4 w-4" /> {t('multi_language_names_ten_2', 'Multi-language Names / Tên 2 Ngôn Ngữ')}</div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_ten_tieng_viet', '🇻🇳 Tên tiếng Việt *')}</label>
                  <input
                    type="text"
                    required
                    value={catFormData.name_vi}
                    onChange={(e) => setCatFormData({ ...catFormData, name_vi: e.target.value })}
                    placeholder={t('saas_categories_units_vd_v_n_phong_pham', 'VD: Văn Phòng Phẩm')}
                    className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('english_name', '🇬🇧 English Name')}</label>
                  <input
                    type="text"
                    value={catFormData.name_en}
                    onChange={(e) => setCatFormData({ ...catFormData, name_en: e.target.value })}
                    placeholder={t('e_g_office_supplies_stationery', 'e.g. Office Supplies & Stationery')}
                    className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Languages className="h-4 w-4" /> {t('multi_language_description_mo_ta', 'Multi-language Description / Mô tả 2 Ngôn Ngữ')}</div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_mo_ta_tieng_viet', '🇻🇳 Mô tả tiếng Việt')}</label>
                  <textarea
                    rows={2}
                    value={catFormData.description_vi}
                    onChange={(e) => setCatFormData({ ...catFormData, description_vi: e.target.value })}
                    placeholder={t('giay_in_a4_bia_thai', 'Giấy in A4, Bìa thái, Kẹp bướm, Sổ tay...')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('english_description', '🇬🇧 English Description')}</label>
                  <textarea
                    rows={2}
                    value={catFormData.description_en}
                    onChange={(e) => setCatFormData({ ...catFormData, description_en: e.target.value })}
                    placeholder={t('a4_paper_binders_clips_notebooks', 'A4 paper, binders, clips, notebooks...')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  {t('cancel', 'Hủy Bỏ')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                >
                  {editingCat
                    ? t('saas_categories_units_cap_nhat_danh_muc', 'Cập Nhật Danh Mục')
                    : t('saas_categories_units_l_u_danh_muc', 'Lưu Danh Mục')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unit Modal */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Scale className="h-5 w-5 text-amber-500" />
                {editingUnit
                  ? t('chinh_sua_don_vi_tinh', 'Chỉnh Sửa Đơn Vị Tính')
                  : t('them_don_vi_tinh_moi_2', 'Thêm Đơn Vị Tính Mới')}
              </h3>
              <button
                onClick={() => setShowUnitModal(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('saas_categories_units_ma_dvt_1', 'Mã ĐVT *')}
                </label>
                <input
                  type="text"
                  required
                  value={unitFormData.code}
                  onChange={(e) => setUnitFormData({ ...unitFormData, code: e.target.value })}
                  placeholder={t('vd_thung', 'VD: THUNG')}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Languages className="h-4 w-4" /> {t('multi_language_unit_name_ten', 'Multi-language Unit Name / Tên ĐVT 2 Ngôn Ngữ')}</div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_ten_tieng_viet', '🇻🇳 Tên tiếng Việt *')}</label>
                  <input
                    type="text"
                    required
                    value={unitFormData.name_vi}
                    onChange={(e) => setUnitFormData({ ...unitFormData, name_vi: e.target.value })}
                    placeholder={t('saas_categories_units_vd_cai_thung_hop', 'VD: Cái / Thùng / Hộp')}
                    className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('english_name', '🇬🇧 English Name')}</label>
                  <input
                    type="text"
                    value={unitFormData.name_en}
                    onChange={(e) => setUnitFormData({ ...unitFormData, name_en: e.target.value })}
                    placeholder={t('e_g_piece_box_carton', 'e.g. Piece / Box / Carton')}
                    className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Languages className="h-4 w-4" /> {t('multi_language_description_mo_ta_2', 'Multi-language Description / Mô tả ĐVT')}</div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('dien_giai_tieng_viet', '🇻🇳 Diễn giải tiếng Việt')}</label>
                  <input
                    type="text"
                    value={unitFormData.description_vi}
                    onChange={(e) => setUnitFormData({ ...unitFormData, description_vi: e.target.value })}
                    placeholder={t('dong_goi_24_lon_thung', 'Đóng gói 24 lon/thùng')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('english_description', '🇬🇧 English Description')}</label>
                  <input
                    type="text"
                    value={unitFormData.description_en}
                    onChange={(e) => setUnitFormData({ ...unitFormData, description_en: e.target.value })}
                    placeholder={t('carton_package_of_24_units', 'Carton package of 24 units')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isFractional"
                  checked={unitFormData.isFractional}
                  onChange={(e) => setUnitFormData({ ...unitFormData, isFractional: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="isFractional" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  {t('cho_phep_nhap_so_le', 'Cho phép nhập số lẻ / thập phân (VD: 1.5 kg, 2.7 mét)')}
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  {t('cancel', 'Hủy Bỏ')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                >
                  {editingUnit
                    ? t('saas_categories_units_cap_nhat_dvt', 'Cập Nhật ĐVT')
                    : t('saas_categories_units_l_u_dvt', 'Lưu ĐVT')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UOM Conversion Modal */}
      {showConvModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-amber-500" />
                {t('cau_hinh_quy_doi_don', 'Cấu Hình Quy Đổi Đơn Vị Tính (UOM)')}
              </h3>
              <button onClick={() => setShowConvModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const noteVi = convFormData.note_vi || `1 ${convFormData.fromUnit} = ${convFormData.factor} ${convFormData.toUnit}`;
                const noteEn = convFormData.note_en || `1 ${convFormData.fromUnit} = ${convFormData.factor} ${convFormData.toUnit}`;
                const newC: UomConversionItem = {
                  id: Date.now(),
                  fromUnit: convFormData.fromUnit,
                  toUnit: convFormData.toUnit,
                  factor: Number(convFormData.factor),
                  note: noteVi,
                  note_vi: noteVi,
                  note_en: noteEn,
                };
                setConversions([newC, ...conversions]);
                addToast(t('them_cong_thuc_quy_doi', 'Thêm công thức quy đổi UOM mới thành công!'), 'success');
                setShowConvModal(false);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('don_vi_goc_lon_base', 'Đơn Vị Gốc (Lớn) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={convFormData.fromUnit}
                    onChange={(e) => setConvFormData({ ...convFormData, fromUnit: e.target.value })}
                    placeholder={t('saas_categories_units_vd_thung_ream', 'VD: Thùng, Ream')}
                    className="w-full px-3 py-2 text-sm font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('don_vi_quy_doi_nho', 'Đơn Vị Quy Đổi (Nhỏ) *')}
                  </label>
                  <input
                    type="text"
                    required
                    value={convFormData.toUnit}
                    onChange={(e) => setConvFormData({ ...convFormData, toUnit: e.target.value })}
                    placeholder={t('saas_categories_units_vd_hop_to_cai', 'VD: Hộp, Tờ, Cái')}
                    className="w-full px-3 py-2 text-sm font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {pickLocalized(language === 'en', `Conversion Factor (1 ${convFormData.fromUnit || 'Large Unit'} = ? ${convFormData.toUnit || 'Small Unit'}) *`, `Hệ Số Quy Đổi (1 ${convFormData.fromUnit || 'ĐVT lớn'} = ? ${convFormData.toUnit || 'ĐVT nhỏ'}) *`)}
                </label>
                <input
                  type="number"
                  required
                  min="0.0001"
                  step="any"
                  value={convFormData.factor}
                  onChange={(e) => setConvFormData({ ...convFormData, factor: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 text-amber-600"
                />
              </div>

              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Languages className="h-4 w-4" /> {t('multi_language_notes_ghi_chu', 'Multi-language Notes / Ghi chú 2 Ngôn Ngữ')}</div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_categories_units_ghi_chu_tieng_viet', '🇻🇳 Ghi chú tiếng Việt')}</label>
                  <input
                    type="text"
                    value={convFormData.note_vi}
                    onChange={(e) => setConvFormData({ ...convFormData, note_vi: e.target.value })}
                    placeholder={t('category_unit_conversion_placeholder', '1 Thùng hàng quy chuẩn = 24 Hộp')}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('english_note', '🇬🇧 English Note')}</label>
                  <input
                    type="text"
                    value={convFormData.note_en}
                    onChange={(e) => setConvFormData({ ...convFormData, note_en: e.target.value })}
                    placeholder="1 Master Carton = 24 Boxes"
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowConvModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  {t('cancel', 'Hủy Bỏ')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs cursor-pointer"
                >
                  {t('luu_ty_le_quy_doi', 'Lưu Tỷ Lệ Quy Đổi UOM')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSCategoriesUnitsPage;
