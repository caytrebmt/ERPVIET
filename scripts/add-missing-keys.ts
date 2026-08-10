import fs from 'fs';
import path from 'path';

const missingKeys: Record<string, { vi: string; en: string }> = {
  'saas_web_orders_xem_so_xuat_kho': { vi: 'Xem Sổ Xuất Kho', en: 'View Stock Ledger' },
  'saas_web_orders_don': { vi: 'đơn', en: 'orders' },
  'saas_web_orders_khach_hang_dat_hang_truc_tuyen': { vi: 'Khách hàng đặt hàng trực tuyến', en: 'Customers placed orders online' },
  'saas_web_orders_cho_duyet_xuat_kho': { vi: 'Chờ Duyệt Xuất Kho', en: 'Pending Stock Approval' },
  'saas_web_orders_can_bam_duyet_pxk_de_xuat_hang': { vi: 'Cần bấm "Duyệt & PXK" để xuất hàng', en: 'Click "Approve & PXK" to ship' },
  'saas_web_orders_da_dua_vao_so_xuat_kho_erp': { vi: 'Đã đưa vào sổ xuất kho ERP', en: 'Added to ERP stock ledger' },
  'saas_web_orders_doanh_thu_webshop': { vi: 'Doanh Thu WebShop', en: 'WebShop Revenue' },
  'saas_web_orders_danh_sach_mat_hang_dat_mua': { vi: 'Danh Sách Mặt Hàng Đặt Mua', en: 'Product List' },
  'saas_web_orders_tat_ca_don': { vi: 'Tất cả đơn', en: 'All Orders' },
  'saas_web_orders_da_lap_pxk': { vi: 'Đã lập PXK', en: 'PXK Created' },
  'saas_web_orders_dong': { vi: 'Đóng', en: 'Close' },
  'saas_web_orders_duyet_tao_phieu_xuat_kho_erp': { vi: 'Duyệt & Tạo Phiếu Xuất Kho ERP', en: 'Approve & Create ERP Delivery Note' },
};

for (const [locale, ext] of [['vi', 'vi.json'], ['en', 'en.json']] as const) {
  const filePath = path.join(process.cwd(), 'public', 'locales', ext);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  let added = 0;
  for (const [key, val] of Object.entries(missingKeys)) {
    if (!(key in data)) {
      data[key] = (locale === 'vi' ? val.vi : val.en);
      added++;
    }
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`${locale}.json: added ${added} keys`);
}
