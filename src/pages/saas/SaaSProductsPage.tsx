import React, { useState, useEffect } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Package, Plus, Edit2, Trash2, Tag, CheckCircle2, AlertCircle, X, Sparkles, Upload, Image as ImageIcon, Star, FileText, Info, ShieldCheck, Eye, RefreshCw, Languages } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { SearchableSelect } from '../../components/SearchableSelect';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { generateSmartSKU } from '../../utils/format';
import client from '../../api/client';
import { getIntlLocale, pickLocalized } from '../../utils/localized';

interface ProductItem {
  id: number;
  sku: string;
  name: string;
  name_vi?: string;
  name_en?: string;
  category: string;
  category_vi?: string;
  category_en?: string;
  unit: string;
  unit_vi?: string;
  unit_en?: string;
  salePrice: number;
  costPrice: number;
  stock: number;
  minStock: number;
  allowNegativeStock?: boolean;
  status: 'active' | 'inactive';
  imageUrl?: string;
  images?: string[];
  description?: string;
  description_vi?: string;
  description_en?: string;
  brand?: string;
  origin?: string;
  origin_vi?: string;
  origin_en?: string;
  warranty?: string;
  warranty_vi?: string;
  warranty_en?: string;
  highlights?: string;
  highlights_vi?: string;
  highlights_en?: string;
}

// Client-side image compression utility function
const compressImageFile = (
  file: File,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.8
): Promise<{ dataUrl: string; originalSize: number; compressedSize: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lỗi đọc file ảnh'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Không thể tải file hình ảnh'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas ctx error'));

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/webp', quality);
        const originalSize = file.size;
        const compressedSize = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, originalSize, compressedSize });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const SaaSProductsPage: React.FC = () => {
  const { addToast } = useToast();
  const { language, t } = useLanguage();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [previewProduct, setPreviewProduct] = useState<ProductItem | null>(null);

  // Form states with bilingual fields
  const [formData, setFormData] = useState({
    sku: '',
    name_vi: '',
    name_en: '',
    category_vi: 'Văn phòng phẩm',
    category_en: 'Office Supplies & Stationery',
    brand: 'Chính Hãng',
    unit_vi: 'Cái',
    unit_en: 'Piece (Pcs)',
    salePrice: 0,
    costPrice: 0,
    stock: 0,
    minStock: 5,
    allowNegativeStock: true,
    description_vi: '',
    description_en: '',
    origin_vi: 'Việt Nam',
    origin_en: 'Vietnam',
    warranty_vi: '12 Tháng',
    warranty_en: '12 Months',
    highlights_vi: '',
    highlights_en: '',
  });

  // Multiple product images state
  const [imagesList, setImagesList] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionStats, setCompressionStats] = useState<{ orig: number; comp: number } | null>(null);

  const fetchProductsFromApi = async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/shop/admin/products?limit=1000&include_inactive=true');
      if (res.data?.ok && Array.isArray(res.data.data?.items)) {
        const fetched: ProductItem[] = res.data.data.items.map((item: any) => ({
          id: item.id,
          sku: item.sku,
          name: item.name_vi || item.name,
          name_vi: item.name_vi || item.name,
          name_en: item.name_en || item.name,
          unit: item.unit || 'Cái',
          unit_vi: item.unit_vi || item.unit || 'Cái',
          unit_en: item.unit_en || (item.unit === 'Cái' ? 'Pcs' : item.unit === 'Thùng' ? 'Carton' : item.unit === 'Hộp' ? 'Box' : item.unit || 'Pcs'),
          salePrice: item.salePrice || 0,
          costPrice: item.costPrice || 0,
          stock: item.stock || 0,
          minStock: item.minStock || 5,
          status: 'active',
          imageUrl: item.imageUrl,
          images: item.images || (item.imageUrl ? [item.imageUrl] : []),
          description: item.description_vi || item.description || '',
          description_vi: item.description_vi || item.description || '',
          description_en: item.description_en || item.description || '',
          brand: item.brand || 'Khác',
          origin: item.origin_vi || item.origin || 'Chính hãng',
          origin_vi: item.origin_vi || item.origin || 'Chính hãng',
          origin_en: item.origin_en || 'Genuine Import',
          warranty: item.warranty_vi || item.warranty || '12 tháng',
          warranty_vi: item.warranty_vi || item.warranty || '12 Tháng',
          warranty_en: item.warranty_en || '12 Months Warranty',
          highlights: item.highlights_vi || item.highlights || '',
          highlights_vi: item.highlights_vi || item.highlights || '',
          highlights_en: item.highlights_en || item.highlights || '',
          category: item.category_vi || item.category_en || '',
          category_vi: item.category_vi || item.category_en || '',
          category_en: item.category_en || item.category_vi || '',
        }));
        setProducts(fetched);
      }
    } catch (err) {
      console.warn('Cannot fetch products from server', err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsFromApi();
  }, []);

  // Handle direct file uploads with client compression
  const handleImageFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    let totalOrig = 0;
    let totalComp = 0;
    const newCompressedImages: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const res = await compressImageFile(file, 800, 800, 0.75);
        newCompressedImages.push(res.dataUrl);
        totalOrig += res.originalSize;
        totalComp += res.compressedSize;
      }

      setImagesList((prev) => [...prev, ...newCompressedImages]);
      setCompressionStats({ orig: totalOrig, comp: totalComp });

      const origMB = (totalOrig / (1024 * 1024)).toFixed(2);
      const compKB = (totalComp / 1024).toFixed(0);
      const savedPercent = totalOrig > 0 ? Math.round(((totalOrig - totalComp) / totalOrig) * 100) : 0;

      addToast(
        t('da_tai_len_nen_thanh', 'Đã tải lên & nén thành công {{length}} ảnh (Tối ưu {{origmb}}MB -> {{compkb}}KB, tiết kiệm {{savedpercent}}% dung lượng)!', { length: newCompressedImages.length, origmb: origMB, compkb: compKB, savedpercent: savedPercent }),
        'success'
      );
    } catch (err) {
      addToast(t('khong_the_nen_tai_len', 'Không thể nén/tải lên file hình ảnh'), 'error');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImagesList(imagesList.filter((_, i) => i !== index));
    addToast(t('da_xoa_hinh_anh_khoi', 'Đã xóa hình ảnh khỏi danh sách sản phẩm'), 'info');
  };

  const handleSetPrimaryImage = (index: number) => {
    if (index === 0) return;
    const selected = imagesList[index];
    const rest = imagesList.filter((_, i) => i !== index);
    setImagesList([selected, ...rest]);
    addToast(t('da_chon_hinh_anh_lam', 'Đã chọn hình ảnh làm ảnh đại diện chính!'), 'success');
  };

  const handleGenerateAutoSKU = () => {
    const catCode = formData.category_vi === 'Laptop' || formData.category_en.includes('Laptop') ? 'LAP' : formData.category_vi === 'Văn phòng phẩm' ? 'VPP' : 'ELEC';
    const autoSku = generateSmartSKU(
      catCode,
      formData.brand || 'GEN',
      formData.name_vi || formData.name_en || 'ITEM',
      products.length + 1
    );
    setFormData((prev) => ({ ...prev, sku: autoSku }));
    addToast(t('da_tu_dong_tao_sku', 'Đã tự động tạo SKU thông minh: {{autosku}}', { autosku: autoSku }), 'info');
  };

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setImagesList([]);
    setCompressionStats(null);
    setFormData({
      sku: '',
      name_vi: '',
      name_en: '',
      category_vi: 'Văn phòng phẩm',
      category_en: 'Office Supplies & Stationery',
      brand: 'Chính Hãng',
      unit_vi: 'Cái',
      unit_en: 'Piece (Pcs)',
      salePrice: 0,
      costPrice: 0,
      stock: 0,
      minStock: 5,
      allowNegativeStock: true,
      description_vi: '',
      description_en: '',
      origin_vi: 'Việt Nam',
      origin_en: 'Vietnam',
      warranty_vi: '12 Tháng',
      warranty_en: '12 Months',
      highlights_vi: '',
      highlights_en: '',
    });
    setShowModal(true);
  };

  const handleOpenEdit = (product: ProductItem) => {
    setEditingProduct(product);
    setImagesList(product.images && product.images.length > 0 ? product.images : product.imageUrl ? [product.imageUrl] : []);
    setCompressionStats(null);
    setFormData({
      sku: product.sku,
      name_vi: product.name_vi || product.name,
      name_en: product.name_en || product.name,
      category_vi: product.category_vi || product.category,
      category_en: product.category_en || product.category,
      brand: product.brand || 'Chính Hãng',
      unit_vi: product.unit_vi || product.unit,
      unit_en: product.unit_en || product.unit,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      stock: product.stock,
      minStock: product.minStock,
      allowNegativeStock: product.allowNegativeStock ?? true,
      description_vi: product.description_vi || product.description || '',
      description_en: product.description_en || product.description || '',
      origin_vi: product.origin_vi || product.origin || 'Chính hãng',
      origin_en: product.origin_en || 'Genuine',
      warranty_vi: product.warranty_vi || product.warranty || '12 Tháng',
      warranty_en: product.warranty_en || '12 Months Warranty',
      highlights_vi: product.highlights_vi || product.highlights || '',
      highlights_en: product.highlights_en || product.highlights || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_vi || !formData.sku) return;

    const payload = {
      sku: formData.sku.toUpperCase(),
      name: formData.name_vi,
      name_vi: formData.name_vi,
      name_en: formData.name_en || formData.name_vi,
      categoryName: formData.category_vi,
      category_vi: formData.category_vi,
      category_en: formData.category_en,
      unit: formData.unit_vi,
      unit_vi: formData.unit_vi,
      unit_en: formData.unit_en,
      salePrice: Number(formData.salePrice),
      costPrice: Number(formData.costPrice),
      stock: Number(formData.stock),
      minStock: Number(formData.minStock),
      brand: formData.brand,
      description: formData.description_vi,
      description_vi: formData.description_vi,
      description_en: formData.description_en || formData.description_vi,
      origin: formData.origin_vi,
      origin_vi: formData.origin_vi,
      origin_en: formData.origin_en || formData.origin_vi,
      warranty: formData.warranty_vi,
      warranty_vi: formData.warranty_vi,
      warranty_en: formData.warranty_en || formData.warranty_vi,
      highlights: formData.highlights_vi,
      highlights_vi: formData.highlights_vi,
      highlights_en: formData.highlights_en || formData.highlights_vi,
      images: imagesList.length > 0 ? imagesList : [],
      imageUrl: imagesList[0] || '',
    };

    try {
      if (editingProduct) {
        await client.put(`/api/shop/admin/products/${editingProduct.id}`, payload);
        addToast(t('cap_nhat_san_pham_thanh', 'Cập nhật sản phẩm "{{name_vi}}" thành công!', { name_vi: formData.name_vi }), 'success');
      } else {
        await client.post('/api/shop/admin/products', payload);
        addToast(t('them_moi_san_pham_thanh', 'Thêm mới sản phẩm "{{name_vi}}" thành công!', { name_vi: formData.name_vi }), 'success');
      }
      fetchProductsFromApi();
    } catch (err: any) {
      addToast(
        err.response?.data?.message || (t('khong_the_luu_san_pham', 'Không thể lưu sản phẩm vào PostgreSQL.')),
        'error'
      );
      return;
    }

    setShowModal(false);
  };

  const handleDelete = async (id: number, prod: ProductItem) => {
    const prodName = pickLocalized(language === 'en', (prod.name_en || prod.name), (prod.name_vi || prod.name));
    if (window.confirm(t('ban_co_chac_muon_xoa_4', 'Bạn có chắc muốn xóa sản phẩm "{{prodname}}" khỏi danh mục ERP?', { prodname: prodName }))) {
      try {
        await client.delete(`/api/shop/admin/products/${id}`);
        addToast(t('da_xoa_san_pham_thanh', 'Đã xóa sản phẩm "{{prodname}}" thành công!', { prodname: prodName }), 'warning');
      } catch (err) {
        addToast(t('da_xoa_san_pham_deleted', 'Đã xóa sản phẩm "{{prodname}}"', { prodname: prodName }), 'warning');
      }
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  const columns: ColumnDef<ProductItem>[] = [
    {
      accessorKey: 'imageUrl',
      header: t('saas_products_hinh_anh', 'Hình Ảnh'),
      cell: ({ row }) => {
        const img = row.original.imageUrl || row.original.images?.[0];
        const count = row.original.images?.length || (img ? 1 : 0);
        return (
          <div
            onClick={() => setPreviewProduct(row.original)}
            className="relative group cursor-pointer w-11 h-11 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0"
            title={t('bam_de_xem_chi_tiet', 'Bấm để xem chi tiết & thư viện ảnh')}
          >
            {img ? (
              <img src={img} alt={row.original.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
            ) : (
              <ImageIcon className="w-5 h-5 text-zinc-400" />
            )}
            {count > 1 && (
              <span className="absolute bottom-0.5 right-0.5 bg-zinc-950/80 text-amber-400 text-[9px] font-bold px-1 rounded-xs">
                +{count}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: 'sku',
      header: t('saas_reports_ma_sku', 'Mã SKU'),
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 ">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: t('saas_products_ten_hang_hoa_thong_tin', 'Tên Hàng Hóa & Thông Tin'),
      cell: ({ row }) => {
        const prod = row.original;
        const name = pickLocalized(language === 'en', (prod.name_en || prod.name), (prod.name_vi || prod.name));
        const altName = pickLocalized(language === 'en', prod.name_vi, prod.name_en);
        const warranty = pickLocalized(language === 'en', (prod.warranty_en || prod.warranty), (prod.warranty_vi || prod.warranty));
        return (
          <div>
            <div
              onClick={() => setPreviewProduct(row.original)}
              className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer flex items-center gap-1.5"
            >
              {name}
            </div>
              
          </div>
        );
      },
    },
    {
      accessorKey: 'category',
      header: t('category', 'Danh Mục'),
      cell: ({ row }) => {
        const prod = row.original;
        const cat = pickLocalized(language === 'en', (prod.category_en || prod.category), (prod.category_vi || prod.category));
        return (
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Tag className="h-3 w-3 text-zinc-400" />
            {cat}
          </span>
        );
      },
    },
    {
      accessorKey: 'unit',
      header: t('dvt_uom', 'ĐVT'),
      cell: ({ row }) => {
        const prod = row.original;
        const unitStr = pickLocalized(language === 'en', (prod.unit_en || prod.unit), (prod.unit_vi || prod.unit));
        return <span className="text-xs font-semibold">{unitStr}</span>;
      },
    },
    {
      accessorKey: 'salePrice',
      header: t('selling_price', 'Giá Bán Niêm Yết'),
      cell: (info) => (
        <span className="font-bold text-zinc-900 dark:text-zinc-100">
          {(info.getValue() as number).toLocaleString(getIntlLocale(language === 'en'))} đ
        </span>
      ),
    },
    {
      accessorKey: 'stock',
      header: t('saas_products_ton_kho_erp', 'Tồn Kho ERP'),
      cell: ({ row }) => {
        const stock = row.original.stock;
        const minStock = row.original.minStock;
        const isLow = stock <= minStock;
        const unitStr = pickLocalized(language === 'en', (row.original.unit_en || row.original.unit), (row.original.unit_vi || row.original.unit));
        return (
          <div className="flex items-center gap-1.5">
            <span className={`font-mono font-bold ${isLow ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {stock} {unitStr}
            </span>
            {isLow && (
              <span className="text-[10px] bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 px-1.5 py-0.2 rounded-xs font-semibold">
                {t('saas_products_canh_bao_ton', 'Cảnh báo tồn')}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: t('actions', 'Thao Tác'),
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPreviewProduct(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title={t('saas_tenants_xem_chi_tiet', 'Xem chi tiết')}
          >
            <Eye className="h-4 w-4 text-blue-500" />
          </button>
          <button
            onClick={() => handleOpenEdit(row.original)}
            className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer"
            title={t('saas_products_sua_san_pham', 'Sửa sản phẩm')}
          >
            <Edit2 className="h-4 w-4 text-amber-500" />
          </button>
          <button
            onClick={() => handleDelete(row.original.id, row.original)}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 transition-colors cursor-pointer"
            title={t('saas_products_xoa_san_pham', 'Xóa sản phẩm')}
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
            <Package className="h-6 w-6 text-amber-500" />{' '}
            {t('quan_ly_danh_muc_hang', 'Quản Lý Danh Mục Hàng Hóa & Vật Tư (ERP Master)')}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t('dong_bo_toan_bo_danh', 'Đồng bộ toàn bộ danh mục sản phẩm 2 ngôn ngữ, bảng giá và tồn kho thời gian thực giữa ERP và WebShop.')}
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4" /> {t('saas_products_them_moi_hang_hoa', 'Thêm mới hàng hóa')}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={products}
        searchPlaceholder={t('tim_kiem_ma_sku_ten', 'Tìm kiếm mã SKU, tên hàng hóa, thương hiệu...')}
      />

      {/* Product Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-3xl w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-amber-500" />
                {editingProduct
                  ? t('chinh_sua_thong_tin_hang', 'Chỉnh Sửa Thông Tin Hàng Hóa')
                  : t('saas_products_them_moi_san_pham_hang_hoa', 'Thêm Mới Sản Phẩm Hàng Hóa')}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* SKU & General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {t('saas_products_ma_sku_ma_hang', 'Mã SKU / Mã Hàng *')}
                    </label>
                    <button
                      type="button"
                      onClick={handleGenerateAutoSKU}
                      className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" /> {t('saas_products_tao_sku_tu_dong', 'Tạo SKU Tự Động')}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder={t('vd_sp001', 'VD: SP001')}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_th_ng_hieu_hang', 'Thương Hiệu / Hãng')}
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder={t('vd_dell_logitech_double_a', 'VD: Dell, Logitech, Double A...')}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Bilingual Product Name */}
              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <Languages className="h-4 w-4" /> {t('product_name_2_languages_ten', 'Product Name (2 Languages) / Tên Sản Phẩm 2 Ngôn Ngữ')}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('saas_products_ten_tieng_viet', '🇻🇳 Tên tiếng Việt *')}</label>
                    <input
                      type="text"
                      required
                      value={formData.name_vi}
                      onChange={(e) => setFormData({ ...formData, name_vi: e.target.value })}
                      placeholder={t('vd_laptop_dell_inspiron_15', 'VD: Laptop Dell Inspiron 15 3520')}
                      className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('english_name', '🇬🇧 English Name')}</label>
                    <input
                      type="text"
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                      placeholder={t('e_g_dell_inspiron_15', 'e.g. Dell Inspiron 15 3520 Laptop')}
                      className="w-full px-3 py-2 text-sm font-semibold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              {/* Category & Unit selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_danh_muc_san_pham', 'Danh Mục Sản Phẩm')}
                  </label>
                  <select
                    value={formData.category_vi}
                    onChange={(e) => {
                      const val = e.target.value;
                      const enVal = val === 'Laptop' || val === 'Laptop & Máy tính' ? 'Laptops & Computers' : val === 'Văn phòng phẩm' ? 'Office Supplies & Stationery' : 'Electronics & Accessories';
                      setFormData({ ...formData, category_vi: val, category_en: enVal });
                    }}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                  >
                    <option value="Văn phòng phẩm">{t('van_phong_pham_office_supplies', 'Văn phòng phẩm (Office Supplies)')}</option>
                    <option value="Laptop & Máy tính">{t('laptop_may_tinh_laptops_computers', 'Laptop & Máy tính (Laptops & Computers)')}</option>
                    <option value="Linh kiện & Điện tử">{t('linh_kien_dien_tu_electronics', 'Linh kiện & Điện tử (Electronics & Accessories)')}</option>
                    <option value="Mực In & Phụ Kiện">{t('muc_in_phu_kien_printer', 'Mực In & Phụ Kiện (Printer Ink & Accessories)')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('don_vi_tinh_uom_unit', 'Đơn Vị Tính (UOM)')}
                  </label>
                  <select
                    value={formData.unit_vi}
                    onChange={(e) => {
                      const uVi = e.target.value;
                      const uEn = uVi === 'Cái' ? 'Piece (Pcs)' : uVi === 'Thùng' ? 'Carton' : uVi === 'Hộp' ? 'Box' : uVi === 'Ream' ? 'Ream (500 sheets)' : uVi;
                      setFormData({ ...formData, unit_vi: uVi, unit_en: uEn });
                    }}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-semibold"
                  >
                    <option value="Cái">{t('cai_piece_pcs', 'Cái (Piece / Pcs)')}</option>
                    <option value="Ream">{t('ream_500_to_sheets', 'Ream (500 tờ / sheets)')}</option>
                    <option value="Tệp">{t('tep_pack', 'Tệp (Pack)')}</option>
                    <option value="Hộp">{t('hop_box', 'Hộp (Box)')}</option>
                    <option value="Thùng">{t('thung_carton', 'Thùng (Carton)')}</option>
                    <option value="Kg">{t('kilogram_kg', 'Kilogram (Kg)')}</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_gia_ban_ban_le', 'Giá Bán Bán Lẻ')}
                  </label>
                  <input
                    type="number"
                    value={formData.salePrice}
                    onChange={(e) => setFormData({ ...formData, salePrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_gia_von_nhap_kho', 'Giá Vốn Nhập Kho')}
                  </label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('stock_quantity', 'Số Lượng Tồn Kho')}
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('saas_products_ton_toi_thieu', 'Tồn Tối Thiểu')}
                  </label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Image Upload Gallery */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <ImageIcon className="h-4 w-4 text-amber-500" />
                    {t('bo_anh_san_pham_tu', 'Bộ Ảnh Sản Phẩm (Tự động nén WebP siêu nhẹ)')}
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {imagesList.map((img, idx) => (
                    <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 shrink-0">
                      <img src={img} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                      {idx === 0 && (
                        <span className="absolute top-0 left-0 bg-amber-500 text-zinc-950 text-[8px] font-black px-1 rounded-br-xs uppercase">
                          {t('saas_products_chinh', 'Chính')}</span>
                      )}
                      <div className="absolute inset-0 bg-zinc-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {idx !== 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimaryImage(idx)}
                            className="p-1 rounded bg-amber-500 text-zinc-950 hover:scale-110 transition-transform cursor-pointer"
                            title={t('saas_products_d_t_lam_anh_chinh', 'Đặt làm ảnh chính')}
                          >
                            <Star className="h-3 w-3 fill-current" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="p-1 rounded bg-red-600 text-white hover:scale-110 transition-transform cursor-pointer"
                          title={t('saas_products_xoa_anh_nay', 'Xóa ảnh này')}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <label className="w-16 h-16 rounded-xl border-2 border-dashed border-amber-500/50 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center text-amber-600 dark:text-amber-400 cursor-pointer transition-colors shrink-0">
                    <Upload className="h-5 w-5 mb-0.5" />
                    <span className="text-[9px] font-bold">{t('saas_products_tai_anh', '+ Tải Ảnh')}</span>
                    <input type="file" multiple accept="image/*" onChange={handleImageFileUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Rich Information Fields - Bilingual */}
              <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  <FileText className="h-4 w-4 text-amber-500" />
                  {t('thong_tin_chi_tiet_thong', 'Thông Tin Chi Tiết & Thông Số Kỹ Thuật (2 Ngôn Ngữ)')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('xuat_xu_tieng_viet', '🇻🇳 Xuất xứ (Tiếng Việt)')}</label>
                    <input
                      type="text"
                      value={formData.origin_vi}
                      onChange={(e) => setFormData({ ...formData, origin_vi: e.target.value })}
                      placeholder={t('saas_products_vd_viet_nam_nhap_khau_my', 'VD: Việt Nam, Nhập khẩu Mỹ')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('origin_english', '🇬🇧 Origin (English)')}</label>
                    <input
                      type="text"
                      value={formData.origin_en}
                      onChange={(e) => setFormData({ ...formData, origin_en: e.target.value })}
                      placeholder={t('e_g_usa_china', 'e.g. USA / China')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('bao_hanh_tieng_viet', '🇻🇳 Bảo hành (Tiếng Việt)')}</label>
                    <input
                      type="text"
                      value={formData.warranty_vi}
                      onChange={(e) => setFormData({ ...formData, warranty_vi: e.target.value })}
                      placeholder={t('saas_products_vd_12_thang_chinh_hang', 'VD: 12 Tháng chính hãng')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('warranty_english', '🇬🇧 Warranty (English)')}</label>
                    <input
                      type="text"
                      value={formData.warranty_en}
                      onChange={(e) => setFormData({ ...formData, warranty_en: e.target.value })}
                      placeholder={t('e_g_12_months_official', 'e.g. 12 Months Official Warranty')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                <div className="space-y-3 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('saas_products_mo_ta_tieng_viet', '🇻🇳 Mô tả tiếng Việt')}</label>
                    <textarea
                      rows={2}
                      value={formData.description_vi}
                      onChange={(e) => setFormData({ ...formData, description_vi: e.target.value })}
                      placeholder={t('nhap_gioi_thieu_chi_tiet', 'Nhập giới thiệu chi tiết sản phẩm...')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      {t('english_description', '🇬🇧 English Description')}</label>
                    <textarea
                      rows={2}
                      value={formData.description_en}
                      onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                      placeholder={t('enter_english_product_description', 'Enter English product description...')}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="allowNegativeStock"
                  checked={formData.allowNegativeStock}
                  onChange={(e) => setFormData({ ...formData, allowNegativeStock: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
                <label htmlFor="allowNegativeStock" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  {t('linh_hoat_cho_phep_ban', 'Linh hoạt: Cho phép bán trước / xuất âm kho khi chưa kịp nhập kho')}
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 sticky bottom-0 bg-white dark:bg-zinc-900 z-10">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
                >
                  {t('cancel', 'Hủy Bỏ')}
                </button>
                <button
                  type="submit"
                  disabled={isCompressing}
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {editingProduct
                    ? t('saas_products_cap_nhat_san_pham', 'Cập Nhật Sản Phẩm')
                    : t('saas_products_l_u_san_pham', 'Lưu Sản Phẩm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Preview Modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-50 bg-zinc-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-xl w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Info className="h-5 w-5 text-amber-500" />
                {t('saas_products_chi_tiet_san_pham', 'Chi Tiết Sản Phẩm')}: {pickLocalized(language === 'en', (previewProduct.name_en || previewProduct.name), (previewProduct.name_vi || previewProduct.name))}
              </h3>
              <button
                onClick={() => setPreviewProduct(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Images gallery preview */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {t('bo_anh_san_pham_anh', 'Bộ Ảnh Sản Phẩm ({{length}} ảnh):', { length: previewProduct.images?.length || 1 })}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(previewProduct.images || [previewProduct.imageUrl || '']).map((img, i) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                    <img src={img} alt={`Image ${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Info details */}
            <div className="grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl text-xs space-y-1">
              <div><strong>{t('saas_products_ma_sku_1', 'Mã SKU:')}</strong> <span className="font-mono text-amber-600 dark:text-amber-400">{previewProduct.sku}</span></div>
              <div><strong>{t('saas_products_danh_muc_1', 'Danh mục:')}</strong> {pickLocalized(language === 'en', (previewProduct.category_en || previewProduct.category), (previewProduct.category_vi || previewProduct.category))}</div>
              <div><strong>{t('saas_products_hang_san_xuat', 'Hãng sản xuất:')}</strong> {previewProduct.brand || 'Other'}</div>
              <div><strong>{t('saas_products_xuat_xu', 'Xuất xứ:')}</strong> {pickLocalized(language === 'en', (previewProduct.origin_en || previewProduct.origin), (previewProduct.origin_vi || previewProduct.origin))}</div>
              <div><strong>{t('saas_products_bao_hanh', 'Bảo hành:')}</strong> {pickLocalized(language === 'en', (previewProduct.warranty_en || previewProduct.warranty), (previewProduct.warranty_vi || previewProduct.warranty))}</div>
              <div><strong>{t('saas_products_d_n_vi_tinh', 'Đơn vị tính:')}</strong> {pickLocalized(language === 'en', (previewProduct.unit_en || previewProduct.unit), (previewProduct.unit_vi || previewProduct.unit))}</div>
              <div><strong>{t('saas_products_gia_ban_niem_yet_1', 'Giá bán niêm yết:')}</strong> <span className="font-bold text-emerald-600 dark:text-emerald-400">{previewProduct.salePrice.toLocaleString(getIntlLocale(language === 'en'))} đ</span></div>
              <div><strong>{t('saas_products_ton_kho_erp_1', 'Tồn kho ERP:')}</strong> <span className="font-bold">{previewProduct.stock} {pickLocalized(language === 'en', (previewProduct.unit_en || previewProduct.unit), (previewProduct.unit_vi || previewProduct.unit))}</span></div>
            </div>

            {(previewProduct.highlights_en || previewProduct.highlights_vi || previewProduct.highlights) && (
              <div className="text-xs space-y-1">
                <strong className="text-zinc-800 dark:text-zinc-200">{t('saas_products_d_c_diem_noi_bat', 'Đặc điểm nổi bật:')}</strong>
                <p className="text-zinc-600 dark:text-zinc-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                  {pickLocalized(language === 'en', (previewProduct.highlights_en || previewProduct.highlights), (previewProduct.highlights_vi || previewProduct.highlights))}
                </p>
              </div>
            )}

            {(previewProduct.description_en || previewProduct.description_vi || previewProduct.description) && (
              <div className="text-xs space-y-1">
                <strong className="text-zinc-800 dark:text-zinc-200">{t('saas_products_mo_ta_chi_tiet', 'Mô tả chi tiết:')}</strong>
                <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                  {pickLocalized(language === 'en', (previewProduct.description_en || previewProduct.description), (previewProduct.description_vi || previewProduct.description))}
                </p>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => setPreviewProduct(null)}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 cursor-pointer"
              >
                {t('saas_products_dong_xem', 'Đóng Xem')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSProductsPage;
