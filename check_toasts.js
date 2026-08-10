const fs = require('fs');
const files = [
  'src/contexts/AuthContext.tsx',
  'src/contexts/CartContext.tsx',
  'src/contexts/SaaSAuthContext.tsx',
  'src/api/client.ts',
  'src/utils/format.ts',
  'src/pages/AccountPage.tsx',
  'src/pages/CheckoutPage.tsx',
  'src/pages/LoginPage.tsx',
  'src/pages/ProductPage.tsx',
  'src/pages/OrderDetailPage.tsx',
  'src/pages/GoogleCallbackPage.tsx',
  'src/pages/OrderSuccessPage.tsx',
  'src/pages/RegisterPage.tsx',
  'src/pages/saas/SaaSLoginPage.tsx',
  'src/pages/saas/SaaSRegisterPage.tsx',
  'src/pages/CatalogPage.tsx'
];
for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/showToast\([^)]*['"][A-Za-z][^'"]{5,}['"]/g);
  if (matches) {
    console.log(f + ':');
    matches.forEach(m => console.log('  ' + m));
  }
}
