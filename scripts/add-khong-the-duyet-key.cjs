const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'public/locales');

const viPath = path.join(localesDir, 'vi.json');
const enPath = path.join(localesDir, 'en.json');

const vi = JSON.parse(fs.readFileSync(viPath, 'utf8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

const newKey = 'saas_web_orders_khong_the_duyet_don_hang_webshop';
const newKeyEn = 'saas_web_orders_cannot_approve_webshop_orders';

// Add to top-level
vi[newKey] = 'Không thể duyệt các đơn hàng WebShop';
en[newKeyEn] = 'Cannot approve webshop orders';

// Wait - I should keep the key name consistent. Let me use the same key name for both languages.
delete en[newKeyEn];
en[newKey] = 'Cannot approve webshop orders';

// Add to _groups "SaaS Admin" category
if (vi._groups && vi._groups['SaaS Admin']) {
  vi._groups['SaaS Admin'].push(newKey);
}
if (en._groups && en._groups['SaaS Admin']) {
  en._groups['SaaS Admin'].push(newKey);
}

fs.writeFileSync(viPath, JSON.stringify(vi, null, 2) + '\n', 'utf8');
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');

console.log('Added key:', newKey);
console.log('vi:', vi[newKey]);
console.log('en:', en[newKey]);
console.log('Added to _groups SaaS Admin in both files');
