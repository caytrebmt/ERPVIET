const fs = require('fs');
const path = require('path');
const srcDir = path.resolve(__dirname, '..', 'src');

const missing = [
  'api_auth_google_login_success','assets_cancel','assets_net_value','assets_status',
  'datatable_next_page','datatable_previous_page','datatable_search_placeholder',
  'layout_tenant_management','layout_vat','nav_categories','nav_erp_register',
  'page_login_google_server_error','page_saas_register_failed','product_contact_for_price',
  'saas_register_have_account',
  'saas_web_orders_dang_van_chuyen_in_transit',
  'saas_web_orders_dong_bo_d_n_hang_truc_tiep_t_gian_hang_webshop_online_duyet_d_n_va_tu_dong_sinh_phieu_xuat_kho_px_vao_erp',
  'saas_web_orders_huy','saas_web_orders_luu_dong_bo_sang_web','saas_web_orders_ma_d_n_web',
  'saas_web_orders_quan_ly_d_n_hang_webshop_e_commerce_sync','saas_web_orders_san_pham_d_t_mua',
  'saas_web_orders_ten_san_pham','saas_web_orders_thanh_tien','saas_web_orders_thanh_toan',
  'saas_web_orders_thoi_gian_d_t','saas_web_orders_thue_vat_10','saas_web_orders_tong_gia_tri',
  'saas_web_orders_vi_du_da_dong_goi_xong_giao_cho_shipper_nguyen_v_n_a_ghn_ghn998822',
  'saas_web_orders_xac_nhan_giao_thanh_cong_chuyen_trang_thai_sang_hoan_tat_finish',
  'saas_web_orders_da_cap_nhat_d_n_order_code_giao_hang_thanh_cong_da_chuyen_trang_thai_hoan_tat_finish',
  'saas_web_orders_da_duyet_d_n_order_code_va_tu_dong_chuyen_thanh_phieu_xuat_kho_pxcode',
  'sidebar_accounting_ledger','sidebar_database_connected_detail','sidebar_stock_in',
  'sidebar_stock_out','sidebar_stocktaking','sidebar_vat_tax','sidebar_warehouse_locations'
];

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const files = walk(srcDir);
const relRoot = path.resolve(__dirname, '..');

for (const key of missing) {
  const usages = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\bt\\s*\\(\\s*(['"\`])(${escapedKey})\\1`, 'g');
    let m;
    while ((m = regex.exec(content)) !== null) {
      const afterMatch = content.substring(m.index + m[0].length);
      const fbMatch = afterMatch.match(/^\s*,\s*(['"`])([^'"`\\]*(?:\\.[^'"`\\]*)*)\1/);
      const fb = fbMatch ? fbMatch[2].trim() : null;
      const lineNum = content.substring(0, m.index).split('\n').length;
      usages.push({ file: path.relative(relRoot, file), line: lineNum, fallback: fb });
    }
  }
  if (usages.length === 0) {
    console.log(key + ' => NOT FOUND');
  } else {
    const fb = usages.find(u => u.fallback)?.fallback;
    const locs = usages.map(u => path.basename(u.file) + ':' + u.line).join(', ');
    console.log(key + ' => fallback: ' + JSON.stringify(fb) + ' | ' + locs);
  }
}
