import React, { useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  Calculator,
  Calendar,
  DollarSign,
  Layers,
  ArrowUpRight,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';

interface Asset {
  id: number;
  asset_code: string;
  asset_name: string;
  category_code: string;
  original_cost: number;
  useful_life_months: number;
  monthly_depreciation: number;
  accumulated_depreciation: number;
  net_book_value: number;
  status: 'IN_USE' | 'DISPOSED' | 'FULLY_DEPRECIATED';
  purchase_date: string;
}

const MOCK_ASSETS: Asset[] = [
  {
    id: 1,
    asset_code: 'TSCD-2026-001',
    asset_name: 'Hệ Thống Máy Chủ Server Dell PowerEdge R750',
    category_code: 'MÁY MÓC THIẾT BỊ',
    original_cost: 180000000,
    useful_life_months: 60,
    monthly_depreciation: 3000000,
    accumulated_depreciation: 36000000,
    net_book_value: 144000000,
    status: 'IN_USE',
    purchase_date: '2025-08-01',
  },
  {
    id: 2,
    asset_code: 'TSCD-2026-002',
    asset_name: 'Xe Tải Chở Hàng Hyundai Mighty 2.5 Tấn',
    category_code: 'PHƯƠNG TIỆN VẬN TẢI',
    original_cost: 520000000,
    useful_life_months: 120,
    monthly_depreciation: 4333333,
    accumulated_depreciation: 104000000,
    net_book_value: 416000000,
    status: 'IN_USE',
    purchase_date: '2024-06-15',
  },
  {
    id: 3,
    asset_code: 'TSCD-2026-003',
    asset_name: 'Tòa Nhà Văn Phòng & Kho Bãi Trung Tâm',
    category_code: 'NHÀ CỬA VẬT KIẾN TRÚC',
    original_cost: 3500000000,
    useful_life_months: 240,
    monthly_depreciation: 14583333,
    accumulated_depreciation: 350000000,
    net_book_value: 3150000000,
    status: 'IN_USE',
    purchase_date: '2024-01-01',
  },
];

export const SaaSAssetsPage: React.FC = () => {
  const { language } = useLanguage();
  const { showToast } = useToast();
  const isEn = language === 'en';

  const [assets, setAssets] = useState<Asset[]>(MOCK_ASSETS);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const [newAsset, setNewAsset] = useState({
    asset_name: '',
    category_code: 'MÁY MÓC THIẾT BỊ',
    original_cost: 0,
    useful_life_months: 36,
  });

  const handleCreateAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.asset_name || !newAsset.original_cost) {
      showToast(isEn ? 'Please enter asset name and original cost' : 'Vui lòng điền tên tài sản và nguyên giá', 'error');
      return;
    }

    const monthly = Math.round(newAsset.original_cost / newAsset.useful_life_months);
    const created: Asset = {
      id: Date.now(),
      asset_code: `TSCD-2026-00${assets.length + 1}`,
      asset_name: newAsset.asset_name,
      category_code: newAsset.category_code,
      original_cost: Number(newAsset.original_cost),
      useful_life_months: Number(newAsset.useful_life_months),
      monthly_depreciation: monthly,
      accumulated_depreciation: 0,
      net_book_value: Number(newAsset.original_cost),
      status: 'IN_USE',
      purchase_date: new Date().toISOString().split('T')[0],
    };

    setAssets([created, ...assets]);
    setShowAddModal(false);
    setNewAsset({ asset_name: '', category_code: 'MÁY MÓC THIẾT BỊ', original_cost: 0, useful_life_months: 36 });
    showToast(isEn ? 'Added Fixed Asset successfully' : 'Khai báo Tài Sản Cố Định thành công!', 'success');
  };

  const handleRunDepreciation = () => {
    setAssets((prev) =>
      prev.map((a) => {
        const newAccum = a.accumulated_depreciation + a.monthly_depreciation;
        const newNet = Math.max(0, a.original_cost - newAccum);
        return {
          ...a,
          accumulated_depreciation: newAccum,
          net_book_value: newNet,
          status: newNet === 0 ? 'FULLY_DEPRECIATED' : a.status,
        };
      })
    );
    showToast(
      isEn ? 'Calculated and posted monthly depreciation to Accounting Ledger (TT200)' : 'Đã trích khấu hao tháng vào sổ kế toán (TT200)!',
      'success'
    );
  };

  const totalOriginalCost = assets.reduce((acc, curr) => acc + curr.original_cost, 0);
  const totalNetValue = assets.reduce((acc, curr) => acc + curr.net_book_value, 0);
  const totalMonthlyDepreciation = assets.reduce((acc, curr) => acc + curr.monthly_depreciation, 0);

  const filteredAssets = assets.filter(
    (a) =>
      a.asset_code.toLowerCase().includes(search.toLowerCase()) ||
      a.asset_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Total Original Cost' : 'Tổng Nguyên Giá TSCĐ'}
            </p>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalOriginalCost.toLocaleString('vi-VN')} đ
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Net Book Value' : 'Giá Trị Còn Lại'}
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalNetValue.toLocaleString('vi-VN')} đ
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-4 shadow-2xs">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              {isEn ? 'Monthly Depreciation' : 'Khấu Hao Hàng Tháng'}
            </p>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalMonthlyDepreciation.toLocaleString('vi-VN')} đ
            </p>
          </div>
        </div>
      </div>

      {/* Control Actions */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isEn ? 'Search asset code, name...' : 'Tìm kiếm mã tài sản, tên...'}
            className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-amber-500/50"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleRunDepreciation}
            className="w-full sm:w-auto px-4 py-2 border border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Calculator className="h-4 w-4" />
            <span>{isEn ? 'Run Monthly Depreciation' : 'Trích Khấu Hao Tháng Này'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded-lg text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>{isEn ? 'Add Fixed Asset' : 'Thêm Tài Sản Cố Định'}</span>
          </button>
        </div>
      </div>

      {/* Assets Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Asset Code' : 'Mã Tài Sản'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Asset Name & Category' : 'Tên Tài Sản & Phân Loại'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Original Cost' : 'Nguyên Giá'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Monthly Deprec.' : 'Khấu Hao/Tháng'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Accumulated' : 'Đã Khấu Hao'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Net Value' : 'Giá Trị Còn Lại'}</th>
                <th className="px-4 py-3 font-semibold">{isEn ? 'Status' : 'Trạng Thái'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredAssets.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-amber-600 dark:text-amber-400">{item.asset_code}</td>
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{item.asset_name}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{item.category_code}</div>
                  </td>
                  <td className="px-4 py-3.5 font-bold text-zinc-900 dark:text-zinc-100">
                    {item.original_cost.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-4 py-3.5 text-zinc-700 dark:text-zinc-300">
                    {item.monthly_depreciation.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-4 py-3.5 text-rose-500 font-medium">
                    {item.accumulated_depreciation.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-4 py-3.5 font-bold text-emerald-600 dark:text-emerald-400">
                    {item.net_book_value.toLocaleString('vi-VN')} đ
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        item.status === 'IN_USE'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              <span>{isEn ? 'Khai Báo Tài Sản Cố Định (TT200)' : 'Khai Báo Tài Sản Cố Định (TT200)'}</span>
            </h3>

            <form onSubmit={handleCreateAsset} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {isEn ? 'Asset Name *' : 'Tên Tài Sản Cố Định *'}
                </label>
                <input
                  type="text"
                  required
                  value={newAsset.asset_name}
                  onChange={(e) => setNewAsset({ ...newAsset, asset_name: e.target.value })}
                  placeholder="Ví dụ: Máy Tính Server Dell..."
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  {isEn ? 'Category' : 'Loại Tài Sản'}
                </label>
                <select
                  value={newAsset.category_code}
                  onChange={(e) => setNewAsset({ ...newAsset, category_code: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                >
                  <option value="MÁY MÓC THIẾT BỊ">Máy Móc Thiết Bị</option>
                  <option value="PHƯƠNG TIỆN VẬN TẢI">Phương Tiện Vận Tải</option>
                  <option value="NHÀ CỬA VẬT KIẾN TRÚC">Nhà Cửa Vật Kiến Trúc</option>
                  <option value="THIẾT BỊ VĂN PHÒNG">Thiết Bị Văn Phòng</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {isEn ? 'Original Cost (VND) *' : 'Nguyên Giá (VNĐ) *'}
                  </label>
                  <input
                    type="number"
                    required
                    value={newAsset.original_cost}
                    onChange={(e) => setNewAsset({ ...newAsset, original_cost: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    {isEn ? 'Useful Life (Months)' : 'Thời Gian Khấu Hao (Tháng)'}
                  </label>
                  <input
                    type="number"
                    value={newAsset.useful_life_months}
                    onChange={(e) => setNewAsset({ ...newAsset, useful_life_months: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-sm"
                >
                  {isEn ? 'Cancel' : 'Hủy bỏ'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded-lg text-sm"
                >
                  {isEn ? 'Save Asset' : 'Khai Báo TSCĐ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SaaSAssetsPage;
