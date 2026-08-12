const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'public/locales');
const srcDir = path.join(root, 'src');

const viPath = path.join(localesDir, 'vi.json');
const enPath = path.join(localesDir, 'en.json');

const viRaw = JSON.parse(fs.readFileSync(viPath, 'utf8'));
const enRaw = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const viGroups = viRaw._groups || {};
const enGroups = enRaw._groups || {};
delete viRaw._groups;
delete enRaw._groups;

const viKeySet = new Set(Object.keys(viRaw));
const enKeySet = new Set(Object.keys(enRaw));

// --- Walk source code ---
function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = walk(srcDir);

// Collect statically used keys
const usedKeys = new Set();
const keyRegex = /\bt\s*\(\s*(['"`])((?:[^'"`\\]|\\.)*)\1/g;
const i18nKeyRegex = /\bi18n\.t\s*\(\s*(['"`])((?:[^'"`\\]|\\.)*)\1/g;

const STATIC_FALSE_POSITIVES = new Set([
  'from', 'to', 'page', 'code', 'path', 'error', 'category_id', 'tenant',
  'search', '2d', 'a', 'T', 'canvas', '|', ':', '@', 'vi-VN', 'unauthorized_logout',
  'all', 'fs', 'setSearchInput', 'serializeCart',
]);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  for (const regex of [keyRegex, i18nKeyRegex]) {
    let m;
    while ((m = regex.exec(content)) !== null) {
      let key = m[2].replace(/\\(.)/g, '$1').trim();
      if (key.includes('{') || key.includes('\n') || key.includes('$')) continue;
      if (key.startsWith('./') || key.startsWith('/')) continue;
      if (key.length < 2) continue;
      if (STATIC_FALSE_POSITIVES.has(key)) continue;
      usedKeys.add(key);
    }
  }
}

// Add dynamically-used keys that can't be detected by static analysis
const dynamicPlans = ['saas_register_plan_trial', 'saas_register_plan_starter', 'saas_register_plan_professional', 'saas_register_plan_enterprise'];
dynamicPlans.forEach(k => usedKeys.add(k));

// All keys with prefix audit_action_ or audit_entity_ are dynamically used via template literals
for (const key of Object.keys(viRaw)) {
  if (key.startsWith('audit_action_') || key.startsWith('audit_entity_')) {
    usedKeys.add(key);
  }
}
for (const key of Object.keys(enRaw)) {
  if (key.startsWith('audit_action_') || key.startsWith('audit_entity_')) {
    usedKeys.add(key);
  }
}

console.log('Total used keys (including dynamic):', usedKeys.size);

// --- MISSING keys: used in source but not in locale ---
const viMissing = [...usedKeys].filter(k => !viKeySet.has(k));
const enMissing = [...usedKeys].filter(k => !enKeySet.has(k));
console.log('Missing from vi.json:', viMissing.length);
console.log('Missing from en.json:', enMissing.length);

// --- Values for ALL missing keys ---
const keyValues = {
  'api_auth_google_login_success': { vi: 'Đăng nhập Google thành công', en: 'Google login successful' },
  'assets_cancel': { vi: 'Hủy bỏ', en: 'Cancel' },
  'assets_net_value': { vi: 'Giá Trị Còn Lại', en: 'Net Book Value' },
  'assets_status': { vi: 'Trạng thái', en: 'Status' },
  'audit_action_FAILED_LOGIN_ATTEMPT': { vi: 'Đăng nhập thất bại', en: 'Failed Login Attempt' },
  'datatable_next_page': { vi: 'Trang sau', en: 'Next page' },
  'datatable_previous_page': { vi: 'Trang trước', en: 'Previous page' },
  'datatable_search_placeholder': { vi: 'Tìm kiếm...', en: 'Search...' },
  'layout_tenant_management': { vi: 'Quản lý Doanh nghiệp', en: 'Tenant Management' },
  'layout_vat': { vi: 'Kê Khai Thuế GTGT (VAT)', en: 'VAT Declaration' },
  'nav_categories': { vi: 'Danh mục', en: 'Categories' },
  'nav_erp_register': { vi: 'Đăng ký Doanh nghiệp', en: 'Register Enterprise' },
  'page_login_google_server_error': { vi: 'Có lỗi xảy ra khi kết nối máy chủ. Vui lòng thử lại.', en: 'An error occurred while connecting to the server. Please try again.' },
  'page_saas_register_failed': { vi: 'Đăng ký thất bại. Vui lòng thử lại.', en: 'Registration failed. Please try again.' },
  'product_contact_for_price': { vi: 'Liên hệ để lấy giá', en: 'Contact for price' },
  'saas_register_have_account': { vi: 'Đã có tài khoản?', en: 'Already have an account?' },
  'saas_web_orders_dang_van_chuyen_in_transit': { vi: 'Đang vận chuyển (In Transit)', en: 'In Transit' },
  'saas_web_orders_dong_bo_d_n_hang_truc_tiep_t_gian_hang_webshop_online_duyet_d_n_va_tu_dong_sinh_phieu_xuat_kho_px_vao_erp': { vi: 'Đồng bộ đơn hàng trực tiếp từ WebShop, duyệt đơn và tự động sinh phiếu xuất kho (PX) vào ERP.', en: 'Synchronous web orders directly from WebShop, approve orders and automatically generate delivery note (PX) into ERP.' },
  'saas_web_orders_huy': { vi: 'Hủy', en: 'Cancel' },
  'saas_web_orders_luu_dong_bo_sang_web': { vi: 'Lưu & Đồng Bộ Sang Web', en: 'Save & Sync to Web' },
  'saas_web_orders_ma_d_n_web': { vi: 'Mã Đơn Web', en: 'Web Order Code' },
  'saas_web_orders_quan_ly_d_n_hang_webshop_e_commerce_sync': { vi: 'Quản Lý Đơn Hàng WebShop (E-Commerce Sync)', en: 'WebShop Order Management (E-Commerce Sync)' },
  'saas_web_orders_san_pham_d_t_mua': { vi: 'Sản Phẩm Đặt Mua', en: 'Products Ordered' },
  'saas_web_orders_ten_san_pham': { vi: 'Tên Sản Phẩm', en: 'Product Name' },
  'saas_web_orders_thanh_tien': { vi: 'Thành Tiền', en: 'Amount' },
  'saas_web_orders_thanh_toan': { vi: 'Thanh Toán', en: 'Payment' },
  'saas_web_orders_thoi_gian_d_t': { vi: 'Thời Gian Đặt', en: 'Order Time' },
  'saas_web_orders_thue_vat_10': { vi: 'Thuế VAT 10%', en: 'VAT 10%' },
  'saas_web_orders_tong_gia_tri': { vi: 'Tổng Giá Trị', en: 'Total Value' },
  'saas_web_orders_vi_du_da_dong_goi_xong_giao_cho_shipper_nguyen_v_n_a_ghn_ghn998822': { vi: 'VD: Đã đóng gói xong, giao cho Shipper Nguyễn Văn A (GHN-GHN998822)', en: 'e.g., packed and shipped to Shipper Nguyen Van A (GHN-GHN998822)' },
  'saas_web_orders_xac_nhan_giao_thanh_cong_chuyen_trang_thai_sang_hoan_tat_finish': { vi: 'Xác Nhận Giao Thành Công - Chuyển Trạng Thái Sang Hoàn Tất / Finish', en: 'Confirm Delivered - Change Status to Completed / Finish' },
  'saas_web_orders_da_cap_nhat_d_n_order_code_giao_hang_thanh_cong_da_chuyen_trang_thai_hoan_tat_finish': { vi: 'Đã cập nhật đơn hàng {order_code} - giao hàng thành công, đã chuyển trạng thái hoàn tất / finish', en: 'Updated order {order_code} - delivered successfully, status changed to Completed / Finish' },
  'saas_web_orders_da_duyet_d_n_order_code_va_tu_dong_chuyen_thanh_phieu_xuat_kho_pxcode': { vi: 'Đã duyệt đơn hàng {order_code} và tự động tạo phiếu xuất kho ERP: {pxCode}', en: 'Approved order {order_code} and automatically created ERP delivery note: {pxCode}' },
  'sidebar_accounting_ledger': { vi: 'Sổ Cái Kế Toán', en: 'Accounting Ledger' },
  'sidebar_database_connected_detail': { vi: 'Đã kết nối Dữ liệu. Hệ CSDL PostgreSQL / Supabase, độ trễ 24ms.', en: 'Database connected. PostgreSQL / Supabase, latency 24ms.' },
  'sidebar_stock_in': { vi: 'Nhập Kho', en: 'Stock In' },
  'sidebar_stock_out': { vi: 'Xuất Kho', en: 'Stock Out' },
  'sidebar_stocktaking': { vi: 'Kiểm Kê', en: 'Stocktaking' },
  'sidebar_vat_tax': { vi: 'Thuế GTGT', en: 'VAT' },
  'sidebar_warehouse_locations': { vi: 'Địa Điểm Kho Bãi', en: 'Warehouse Locations' },
};

// --- UNUSED keys: in locale but not used ---
const viUnused = Object.keys(viRaw).filter(k => !usedKeys.has(k));
const enUnused = Object.keys(enRaw).filter(k => !usedKeys.has(k));
console.log('Unused in vi.json:', viUnused.length);
console.log('Unused in en.json:', enUnused.length);

// --- Build new locale files ---
function buildLocale(locale, missingVals, groups, isVi) {
  const result = {};
  
  // Keep only used keys
  for (const key of Object.keys(locale)) {
    if (usedKeys.has(key)) {
      result[key] = locale[key];
    }
  }
  
  // Add missing keys
  for (const key of Object.keys(missingVals)) {
    if (!result[key]) {
      const vals = missingVals[key];
      result[key] = isVi ? vals.vi : vals.en;
    }
  }
  
  // Rebuild _groups: only reference keys that exist in result
  const newGroups = {};
  for (const [cat, catVal] of Object.entries(groups)) {
    if (Array.isArray(catVal)) {
      const filtered = catVal.filter(k => result[k] !== undefined);
      if (filtered.length > 0) newGroups[cat] = filtered;
    } else if (typeof catVal === 'object' && catVal !== null) {
      const newSub = {};
      for (const [subCat, subKeys] of Object.entries(catVal)) {
        if (Array.isArray(subKeys)) {
          const filtered = subKeys.filter(k => result[k] !== undefined);
          if (filtered.length > 0) newSub[subCat] = filtered;
        }
      }
      if (Object.keys(newSub).length > 0) newGroups[cat] = newSub;
    }
  }
  result._groups = newGroups;
  return result;
}

const newVi = buildLocale(viRaw, keyValues, viGroups, true);
const newEn = buildLocale(enRaw, keyValues, enGroups, false);

const newViKeys = Object.keys(newVi).filter(k => k !== '_groups');
const newEnKeys = Object.keys(newEn).filter(k => k !== '_groups');

console.log('\nNew vi.json total keys:', newViKeys.length);
console.log('New en.json total keys:', newEnKeys.length);

// Verify: no missing keys remain
const newViSet = new Set(newViKeys);
const newEnSet = new Set(newEnKeys);
const remainingViMissing = [...usedKeys].filter(k => !newViSet.has(k));
const remainingEnMissing = [...usedKeys].filter(k => !newEnSet.has(k));
console.log('Remaining missing in vi.json:', remainingViMissing.length, remainingViMissing);
console.log('Remaining missing in en.json:', remainingEnMissing.length, remainingEnMissing);

// Verify: no unused keys remain (except _groups)
const remainingViUnused = newViKeys.filter(k => !usedKeys.has(k));
const remainingEnUnused = newEnKeys.filter(k => !usedKeys.has(k));
console.log('Remaining unused in vi.json:', remainingViUnused.length, remainingViUnused);
console.log('Remaining unused in en.json:', remainingEnUnused.length, remainingEnUnused);

// Verify _groups integrity
const viGroupsKeys = [];
for (const [cat, keys] of Object.entries(newVi._groups)) {
  if (Array.isArray(keys)) viGroupsKeys.push(...keys);
}
const danglingRefs = viGroupsKeys.filter(k => !newViSet.has(k));
console.log('Dangling _groups refs in vi.json:', danglingRefs.length, danglingRefs);

// Write files
fs.writeFileSync(viPath, JSON.stringify(newVi, null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(newEn, null, 2) + '\n', 'utf8');
console.log('\n✅ Done! Updated vi.json and en.json');
