import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Context Providers
import { ToastProvider } from "./contexts/ToastContext";
import { AuthProvider } from "./contexts/AuthContext";
import { SaaSAuthProvider } from "./contexts/SaaSAuthContext";
import { CartProvider } from "./contexts/CartContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";

// Layouts & Protects
import ShopLayout from "./layouts/ShopLayout";
import SaaSLayout from "./layouts/SaaSLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import SaaSProtectedRoute from "./components/SaaSProtectedRoute";

import { useTranslation } from 'react-i18next';

// WebShop E-Commerce Pages (Lazy Loaded)
const CatalogPage = lazy(() => import("./pages/CatalogPage"));
const ProductPage = lazy(() => import("./pages/ProductPage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const OrderSuccessPage = lazy(() => import("./pages/OrderSuccessPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const OrderDetailPage = lazy(() => import("./pages/OrderDetailPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const GoogleCallbackPage = lazy(() => import("./pages/GoogleCallbackPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));

// SaaS ERP Enterprise Pages (Lazy Loaded)
const SaaSLoginPage = lazy(() => import("./pages/saas/SaaSLoginPage").then(m => ({ default: m.SaaSLoginPage })));
const SaaSRegisterPage = lazy(() => import("./pages/saas/SaaSRegisterPage").then(m => ({ default: m.SaaSRegisterPage })));
const SaaSDashboardPage = lazy(() => import("./pages/saas/SaaSDashboardPage").then(m => ({ default: m.SaaSDashboardPage })));
const SaaSTenantsPage = lazy(() => import("./pages/saas/SaaSTenantsPage").then(m => ({ default: m.SaaSTenantsPage })));
const SaaSWebOrdersPage = lazy(() => import("./pages/saas/SaaSWebOrdersPage").then(m => ({ default: m.SaaSWebOrdersPage })));
const SaaSProductsPage = lazy(() => import("./pages/saas/SaaSProductsPage").then(m => ({ default: m.SaaSProductsPage })));
const SaaSCategoriesUnitsPage = lazy(() => import("./pages/saas/SaaSCategoriesUnitsPage").then(m => ({ default: m.SaaSCategoriesUnitsPage })));
const SaaSCustomersPage = lazy(() => import("./pages/saas/SaaSCustomersPage").then(m => ({ default: m.SaaSCustomersPage })));
const SaaSSuppliersPage = lazy(() => import("./pages/saas/SaaSSuppliersPage").then(m => ({ default: m.SaaSSuppliersPage })));
const SaaSWarehousesPage = lazy(() => import("./pages/saas/SaaSWarehousesPage").then(m => ({ default: m.SaaSWarehousesPage })));
const SaaSStockInPage = lazy(() => import("./pages/saas/SaaSStockInPage").then(m => ({ default: m.SaaSStockInPage })));
const SaaSStockOutPage = lazy(() => import("./pages/saas/SaaSStockOutPage").then(m => ({ default: m.SaaSStockOutPage })));
const SaaSStocktakingPage = lazy(() => import("./pages/saas/SaaSStocktakingPage").then(m => ({ default: m.SaaSStocktakingPage })));
const SaaSQuotationsPage = lazy(() => import("./pages/saas/SaaSQuotationsPage").then(m => ({ default: m.SaaSQuotationsPage })));
const SaaSInventoryPage = lazy(() => import("./pages/saas/SaaSInventoryPage").then(m => ({ default: m.SaaSInventoryPage })));
const SaaSDebtPage = lazy(() => import("./pages/saas/SaaSDebtPage").then(m => ({ default: m.SaaSDebtPage })));
const SaaSVATPage = lazy(() => import("./pages/saas/SaaSVATPage").then(m => ({ default: m.SaaSVATPage })));
const SaaSAccountingPage = lazy(() => import("./pages/saas/SaaSAccountingPage").then(m => ({ default: m.SaaSAccountingPage })));
const SaaSReportsPage = lazy(() => import("./pages/saas/SaaSReportsPage").then(m => ({ default: m.SaaSReportsPage })));
const SaaSSettingsPage = lazy(() => import("./pages/saas/SaaSSettingsPage").then(m => ({ default: m.SaaSSettingsPage })));
const SaaSCRMPage = lazy(() => import("./pages/saas/SaaSCRMPage").then(m => ({ default: m.SaaSCRMPage })));
const SaaSPurchasingPage = lazy(() => import("./pages/saas/SaaSPurchasingPage").then(m => ({ default: m.SaaSPurchasingPage })));
const SaaSAssetsPage = lazy(() => import("./pages/saas/SaaSAssetsPage").then(m => ({ default: m.SaaSAssetsPage })));
const SaaSAuditLogsPage = lazy(() => import("./pages/saas/SaaSAuditLogsPage").then(m => ({ default: m.SaaSAuditLogsPage })));

const PageSkeleton = () => (
  <div className="w-full min-h-[60vh] p-6 animate-pulse flex flex-col gap-4">
    <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-1/3"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-2">
      <div className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
      <div className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
      <div className="h-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
    </div>
    <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-full"></div>
  </div>
);

export default function App() {
  const { t, ready } = useTranslation();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <SaaSAuthProvider>
              <CartProvider>
                <BrowserRouter>
                  <Suspense fallback={<PageSkeleton />}>
                    <Routes>
                      {/* ================= SaaS ERP SYSTEM LOGIN ================= */}
                      <Route path="/saas/login" element={<SaaSLoginPage />} />
                      <Route path="/saas/register" element={<SaaSRegisterPage />} />

                      {/* ================= SaaS ERP PROTECTED ROUTES ================= */}
                      <Route
                        path="/saas/dashboard"
                        element={
                          <SaaSProtectedRoute>
                            <SaaSLayout title={t('layout_dashboard')}>
                              <SaaSDashboardPage />
                            </SaaSLayout> 
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/tenants"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN"]} superAdminOnly>
                            <SaaSLayout title={t('layout_tenant_management', 'Quản lý Doanh nghiệp')}>
                              <SaaSTenantsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/web-orders"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "SALES", "ACCOUNTANT"]}>
                            <SaaSLayout title={t('layout_web_orders')}>
                              <SaaSWebOrdersPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/products"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "SALES", "WAREHOUSE", "PURCHASING"]}>
                            <SaaSLayout title={t('layout_products')}>
                              <SaaSProductsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/categories-units"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "SALES"]}>
                            <SaaSLayout title={t('layout_categories_units')}>
                              <SaaSCategoriesUnitsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/customers"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "SALES"]}>
                            <SaaSLayout title={t('layout_customers')}>
                              <SaaSCustomersPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/suppliers"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "PURCHASING"]}>
                            <SaaSLayout title={t('layout_suppliers')}>
                              <SaaSSuppliersPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/warehouses"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "WAREHOUSE"]}>
                            <SaaSLayout title={t('layout_warehouses')}>
                              <SaaSWarehousesPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/stock-in"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "WAREHOUSE", "PURCHASING"]}>
                            <SaaSLayout title={t('layout_stock_in')}>
                              <SaaSStockInPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/stock-out"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "WAREHOUSE"]}>
                            <SaaSLayout title={t('layout_stock_out')}>
                              <SaaSStockOutPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/stocktaking"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "WAREHOUSE"]}>
                            <SaaSLayout title={t('layout_stocktaking')}>
                              <SaaSStocktakingPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/quotations"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "SALES"]}>
                            <SaaSLayout title={t('layout_quotations')}>
                              <SaaSQuotationsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/inventory"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "WAREHOUSE"]}>
                            <SaaSLayout title={t('layout_inventory')}>
                              <SaaSInventoryPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/debt"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT"]}>
                            <SaaSLayout title={t('layout_debt')}>
                              <SaaSDebtPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/vat"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT"]}>
                            <SaaSLayout title={t('layout_vat')}>
                              <SaaSVATPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/accounting"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT"]}>
                            <SaaSLayout title={t('layout_accounting')}>
                              <SaaSAccountingPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/reports"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT"]}>
                            <SaaSLayout title={t('layout_reports')}>
                              <SaaSReportsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/crm"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "SALES"]}>
                            <SaaSLayout title={t('layout_crm')}>
                              <SaaSCRMPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/purchasing"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "PURCHASING", "WAREHOUSE"]}>
                            <SaaSLayout title={t('layout_purchasing')}>
                              <SaaSPurchasingPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/assets"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN", "ACCOUNTANT"]}>
                            <SaaSLayout title={t('layout_assets')}>
                              <SaaSAssetsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/audit-logs"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN"]}>
                            <SaaSLayout title={t('layout_audit_logs')}>
                              <SaaSAuditLogsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route
                        path="/saas/settings"
                        element={
                          <SaaSProtectedRoute allowedRoles={["ADMIN"]}>
                            <SaaSLayout title={t('layout_settings')}>
                              <SaaSSettingsPage />
                            </SaaSLayout>
                          </SaaSProtectedRoute>
                        }
                      />
                      <Route path="/saas" element={<Navigate to="/saas/dashboard" replace />} />

                      {/* ================= WEBSHOP STOREFRONT ROUTES ================= */}
                      <Route
                        path="/*"
                        element={
                          <ShopLayout>
                            <Suspense fallback={<PageSkeleton />}>
                              <Routes>
                                  <Route path="/" element={<CatalogPage />} />
                                  <Route path="/product/:slug" element={<ProductPage />} />
                                  <Route path="/cart" element={<CartPage />} />
                                  <Route path="/checkout" element={<CheckoutPage />} />
                                  <Route path="/order-success/:code" element={<OrderSuccessPage />} />
                                  <Route path="/login" element={<LoginPage />} />
                                  <Route path="/register" element={<RegisterPage />} />
                                  <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

                                  {/* A registered tenant gets a stable, isolated
                                      storefront URL. Keep the same page set under
                                      /shop/:tenant so all existing shop flows
                                      work on that URL as well as on root. */}
                                  <Route path="/shop/:tenant" element={<CatalogPage />} />
                                  <Route path="/shop/:tenant/product/:slug" element={<ProductPage />} />
                                  <Route path="/shop/:tenant/cart" element={<CartPage />} />
                                  <Route path="/shop/:tenant/checkout" element={<CheckoutPage />} />
                                  <Route path="/shop/:tenant/order-success/:code" element={<OrderSuccessPage />} />
                                  <Route path="/shop/:tenant/login" element={<LoginPage />} />
                                  <Route path="/shop/:tenant/register" element={<RegisterPage />} />
                                  <Route path="/shop/:tenant/auth/google/callback" element={<GoogleCallbackPage />} />

                                  <Route
                                    path="/orders"
                                    element={
                                      <ProtectedRoute>
                                        <OrdersPage />
                                      </ProtectedRoute>
                                    }
                                  />
                                  <Route
                                    path="/orders/:code"
                                    element={
                                      <ProtectedRoute>
                                        <OrderDetailPage />
                                      </ProtectedRoute>
                                    }
                                  />
                                  <Route
                                    path="/account"
                                    element={
                                      <ProtectedRoute>
                                        <AccountPage />
                                      </ProtectedRoute>
                                    }
                                  />
                                  <Route
                                    path="/shop/:tenant/orders"
                                    element={
                                      <ProtectedRoute>
                                        <OrdersPage />
                                      </ProtectedRoute>
                                    }
                                  />
                                  <Route
                                    path="/shop/:tenant/orders/:code"
                                    element={
                                      <ProtectedRoute>
                                        <OrderDetailPage />
                                      </ProtectedRoute>
                                    }
                                  />
                                  <Route
                                    path="/shop/:tenant/account"
                                    element={
                                      <ProtectedRoute>
                                        <AccountPage />
                                      </ProtectedRoute>
                                    }
                                  />
                                  <Route path="*" element={<Navigate to="/" replace />} />
                              </Routes>
                            </Suspense>
                          </ShopLayout>
                        }
                      />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </CartProvider>
            </SaaSAuthProvider>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}