import React, { useEffect, useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ClipboardList, Plus, CheckCircle2, AlertTriangle, Warehouse, Save, ArrowRightLeft, FileSpreadsheet } from 'lucide-react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import client from '../../api/client';
import { useTranslation } from 'react-i18next';

interface StocktakingItem {
  id: number;
  code: string;
  warehouseName: string;
  date: string;
  creator: string;
  totalProducts: number;
  totalDiffQty: number; // Tổng chênh lệch số lượng (+thừa, -thiếu)
  totalDiffValue: number; // Tổng giá trị chênh lệch (VNĐ)
  status: 'Đã hoàn thành' | 'Đang kiểm kê' | 'Đã điều chỉnh kho';
  note: string;
}

interface ProductStocktakingRow {
  productId: number;
  sku: string;
  productName: string;
  unit: string;
  bookQty: number; // Tồn sổ sách
  actualQty: number; // Tồn thực tế
  unitPrice: number; // Đơn giá vốn
}

export const SaaSStocktakingPage: React.FC = () => {
  const { t } = useTranslation();
  const [stocktakings, setStocktakings] = useState<StocktakingItem[]>([]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [stockNote, setStockNote] = useState('');

  const [checkingRows, setCheckingRows] = useState<ProductStocktakingRow[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: number; name_vi: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadStocktakings = async () => {
    setLoading(true);
    try {
      const [sessionsResponse, warehousesResponse] = await Promise.all([
        client.get('/api/saas/stocktaking'),
        client.get('/api/saas/warehouses'),
      ]);
      if (!sessionsResponse.data?.ok) throw new Error(sessionsResponse.data?.message || 'Không tải được phiếu kiểm kê.');
      setStocktakings((sessionsResponse.data.data || []).map((row: any) => ({
        id: Number(row.id), code: row.code, warehouseName: row.warehouse_name || '',
        date: row.date ? String(row.date).slice(0, 10) : '', creator: row.creator || '',
        totalProducts: Number(row.total_products) || 0, totalDiffQty: Number(row.total_diff_qty) || 0,
        totalDiffValue: Number(row.total_diff_value) || 0,
        status: row.status === 'HOAN_THANH' ? 'Đã hoàn thành' : row.status === 'CHO_DUYET' ? 'Đang kiểm kê' : 'Đã điều chỉnh kho',
        note: row.note || '',
      })));
      if (warehousesResponse.data?.ok) setWarehouses((warehousesResponse.data.data || []).map((row: any) => ({ id: Number(row.id), name_vi: row.name_vi })));
      setLoadError(null);
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || error.message || 'Không tải được dữ liệu kiểm kê từ cơ sở dữ liệu.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadStocktakings(); }, []);

  const openCreateStocktaking = async () => {
    setShowCreateModal(true);
    try {
      const warehouseId = selectedWarehouse || String(warehouses[0]?.id || '');
      if (!warehouseId) return;
      setSelectedWarehouse(warehouseId);
      const response = await client.get(`/api/saas/stocktaking/products?warehouse_id=${warehouseId}`);
      if (response.data?.ok) setCheckingRows((response.data.data || []).map((row: any) => ({
        productId: Number(row.product_id), sku: row.sku, productName: row.product_name,
        unit: row.unit || '', bookQty: Number(row.book_qty) || 0, actualQty: Number(row.actual_qty) || 0,
        unitPrice: Number(row.unit_price) || 0,
      })));
    } catch (error: any) { setLoadError(error?.response?.data?.message || error.message || 'Không tải được tồn kho để kiểm kê.'); }
  };

  const handleActualQtyChange = (index: number, val: number) => {
    const updated = [...checkingRows];
    updated[index].actualQty = Math.max(0, val);
    setCheckingRows(updated);
  };

  const handleSaveStocktaking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || checkingRows.length === 0) return;
    try {
      await client.post('/api/saas/stocktaking', {
        warehouse_id: Number(selectedWarehouse),
        notes: stockNote,
        items: checkingRows.map((row) => ({ product_id: row.productId, actual_quantity: row.actualQty })),
      });
      await loadStocktakings();
      setShowCreateModal(false);
      setStockNote('');
      setCheckingRows([]);
    } catch (error: any) {
      setLoadError(error?.response?.data?.message || error.message || 'Không thể lưu phiếu kiểm kê.');
    }
  };

  const columns: ColumnDef<StocktakingItem>[] = [
    {
      accessorKey: 'code',
      header: t('saas_stocktaking_ma_phieu_kiem', 'Mã Phiếu Kiểm'),
      cell: (info) => (
        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-xs border border-amber-200 dark:border-amber-800">
          {info.getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: 'date',
      header: t('saas_stocktaking_ngay_kiem_kho', 'Ngày Kiểm Kho'),
    },
    {
      accessorKey: 'warehouseName',
      header: t('saas_stocktaking_kho_bai_kiem_ke', 'Kho Bãi Kiểm Ke'),
      cell: (info) => (
        <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-zinc-100">
          <Warehouse className="h-4 w-4 text-amber-500 shrink-0" />
          {info.getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'creator',
      header: t('saas_stocktaking_ng_oi_lap_phieu', 'Người Lập Phiếu'),
    },
    {
      accessorKey: 'totalProducts',
      header: t('saas_stocktaking_so_ma_kiem', 'Số Mã Kiểm'),
      cell: (info) => `${info.getValue() as number} SKU`,
    },
    {
      accessorKey: 'totalDiffQty',
      header: t('saas_stocktaking_lech_so_l_ong', 'Lệch Số Lượng'),
      cell: (info) => {
        const qty = info.getValue() as number;
        return (
          <span
            className={`font-bold text-xs ${
              qty === 0 ? 'text-emerald-600' : qty > 0 ? 'text-blue-600' : 'text-red-600'
            }`}
          >
            {qty > 0 ? `+${qty}` : qty}
          </span>
        );
      },
    },
    {
      accessorKey: 'totalDiffValue',
      header: t('gia_tri_lech_vnd', 'Giá Trị Lệch (VNĐ)'),
      cell: (info) => {
        const val = info.getValue() as number;
        return (
          <span
            className={`font-bold text-xs ${
              val === 0 ? 'text-emerald-600' : val > 0 ? 'text-blue-600' : 'text-red-600'
            }`}
          >
            {val.toLocaleString('vi-VN')} đ
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: t('status', 'Trạng Thái'),
      cell: (info) => <StatusBadge status={info.getValue() as string} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-amber-500" /> {t('kiem_ke_kho_dieu_chinh', 'Kiểm Kê Kho & Điều Chỉnh Tồn Kho')}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {t('so_sanh_ton_kho_so', 'So sánh tồn kho sổ sách vs tồn kho thực tế, xử lý chênh lệch thừa/thiếu và cập nhật kho tự động (`/app/templates/inventory/stocktaking`).')}</p>
        </div>

        <button
          onClick={openCreateStocktaking}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950 shadow-xs transition-all"
        >
          <Plus className="h-4 w-4" /> {t('saas_stocktaking_tao_phieu_kiem_ke_moi', 'Tạo Phiếu Kiểm Kê Mới')}</button>
      </div>

      {loading && <p className="text-xs text-zinc-500">{t('dang_tai_phieu_kiem_ke', 'Đang tải phiếu kiểm kê từ PostgreSQL...')}</p>}
      {loadError && <p className="text-xs text-red-600">{loadError}</p>}

      {/* Main Table */}
      <DataTable columns={columns} data={stocktakings} searchPlaceholder={t('tim_ma_phieu_kiem_ten', 'Tìm mã phiếu kiểm, tên kho, người kiểm...')} />

      {/* Create / Execute Stocktaking Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-4xl w-full p-6 border border-zinc-200 dark:border-zinc-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto no-scrollbar">
            <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-500" /> {t('lap_phieu_kiem_ke_kho', 'Lập Phiếu Kiểm Kê Kho & Cân Chỉnh')}</h3>
            </div>

            <form onSubmit={handleSaveStocktaking} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('saas_stocktaking_kho_kiem_ke', 'Kho Kiểm Ke *')}</label>
                  <select
                    value={selectedWarehouse}
                    onChange={(e) => setSelectedWarehouse(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 font-medium"
                  >
                    <option value="">{t('chon_kho', 'Chọn kho')}</option>
                    {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name_vi}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{t('saas_stocktaking_ghi_chu_kiem_ke', 'Ghi Chú Kiểm Kê')}</label>
                  <input
                    type="text"
                    value={stockNote}
                    onChange={(e) => setStockNote(e.target.value)}
                    placeholder={t('vd_kiem_ke_dinh_ky', 'VD: Kiểm kê định kỳ đợt cuối tháng...')}
                    className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              {/* Product Checking Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  {t('bang_chi_tiet_ton_so', 'Bảng Chi Tiết Tồn Sổ Sách & Tồn Thực Tế')}</h4>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                      <tr>
                        <th className="p-3">{t('saas_reports_ma_sku', 'Mã SKU')}</th>
                        <th className="p-3">{t('dashboard_product_name', 'Tên Sản Phẩm')}</th>
                        <th className="p-3 text-center">{t('saas_stocktaking_ton_so_sach', 'Tồn Sổ Sách')}</th>
                        <th className="p-3 text-center">{t('saas_stocktaking_ton_thuc_te', 'Tồn Thực Tế')}</th>
                        <th className="p-3 text-center">{t('saas_stocktaking_chenh_lech', 'Chênh Lệch')}</th>
                        <th className="p-3 text-right">{t('saas_stocktaking_gia_tri_chenh_lech', 'Giá Trị Chênh Lệch')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {checkingRows.map((row, idx) => {
                        const diff = row.actualQty - row.bookQty;
                        const diffVal = diff * row.unitPrice;
                        return (
                          <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                            <td className="p-3 font-mono font-bold text-amber-600 dark:text-amber-400">{row.sku}</td>
                            <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">{row.productName}</td>
                            <td className="p-3 text-center font-bold text-zinc-700 dark:text-zinc-300">
                              {row.bookQty} {row.unit}
                            </td>
                            <td className="p-3 text-center">
                              <input
                                type="number"
                                min={0}
                                value={row.actualQty}
                                onChange={(e) => handleActualQtyChange(idx, Number(e.target.value))}
                                className="w-20 px-2 py-1 text-center font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md text-amber-700 dark:text-amber-300 focus:outline-hidden"
                              />
                            </td>
                            <td className="p-3 text-center font-bold">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] ${
                                  diff === 0
                                    ? 'bg-zinc-100 text-zinc-600'
                                    : diff > 0
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {diff > 0 ? `Thừa +${diff}` : diff < 0 ? `Thiếu ${diff}` : 'Khớp'}
                              </span>
                            </td>
                            <td className="p-3 text-right font-bold">
                              <span className={diffVal < 0 ? 'text-red-600' : diffVal > 0 ? 'text-blue-600' : 'text-zinc-500'}>
                                {diffVal.toLocaleString('vi-VN')} đ
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {t('he_thong_se_tu_dong', 'Hệ thống sẽ tự động tạo phiếu điều chỉnh tăng/giảm tồn kho tương ứng với số lượng chênh lệch thực tế.')}</span>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  {t('cancel', 'Hủy Bỏ')}</button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-zinc-950 bg-amber-500 hover:bg-amber-600 rounded-lg shadow-xs flex items-center gap-2"
                >
                  <Save className="h-4 w-4" /> {t('hoan_tat_kiem_ke_dieu', 'Hoàn Tất Kiểm Kê & Điều Chỉnh Kho')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
