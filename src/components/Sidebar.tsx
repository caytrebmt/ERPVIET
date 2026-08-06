import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  ShoppingCart,
  Package,
  User,
  LogIn,
  UserPlus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  X,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useLanguage } from "../contexts/LanguageContext";
import client from "../api/client";
import { Category } from "../types";

const SIDEBAR_KEY = "webshop_sidebar_collapsed";

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string, search: string) => boolean;
  badge?: number;
}

const SidebarBody: React.FC<{
  collapsed: boolean;
  onNavigate?: () => void;
  categories: Category[];
}> = ({ collapsed, onNavigate, categories }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { cart } = useCart();
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(
    location.pathname === "/orders" || location.pathname === "/account"
  );

  const isActive = (item: NavItem) =>
    item.match
      ? item.match(location.pathname, location.search)
      : location.pathname === item.to;

  const storeItems: NavItem[] = [
    { label: t("nav_home", "Trang chủ"), to: "/", icon: Home, match: (p) => p === "/" },
    {
      label: t("nav_cart", "Giỏ hàng"),
      to: "/cart",
      icon: ShoppingCart,
      badge: cart?.item_count || 0,
    },
  ];

  const accountItems: NavItem[] = [
    { label: t("nav_my_orders", "Đơn hàng"), to: "/orders", icon: Package },
    { label: t("nav_my_profile", "Hồ sơ cá nhân"), to: "/account", icon: User },
  ];

  const selectCategory = (id: number | null) => {
    const params = new URLSearchParams(location.search);
    if (id) params.set("category_id", String(id));
    else params.delete("category_id");
    navigate(`/${params.toString() ? `?${params.toString()}` : ""}`);
    onNavigate?.();
  };

  const activeCategory = new URLSearchParams(location.search).get("category_id");

  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          active
            ? "bg-indigo-600 text-white shadow-xs"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400"
        }`}
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span
            className={`text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center ${
              active ? "bg-white/20 text-white" : "bg-indigo-600 text-white"
            }`}
          >
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  const renderGroup = (title: string, items: NavItem[], mt = "mt-1") => (
    <div className={`mb-1 ${mt}`}>
      {!collapsed && (
        <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">
          {title}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {items.map(renderItem)}
        {title === t("store_title", "Cửa hàng") &&
          collapsed &&
          items.map((it) => (
            <span key={`t-${it.to}`} className="sr-only">
              {it.label}
            </span>
          ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {renderGroup(t("store_title", "Cửa hàng"), storeItems)}

        {/* Danh mục sản phẩm */}
        <div className={`mb-1 ${collapsed ? "mt-1" : "mt-4"}`}>
          {!collapsed && (
            <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 flex items-center gap-1.5">
              <LayoutGrid className="w-3.5 h-3.5" />
              {t("nav_categories", "Danh mục")}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button
              onClick={() => selectCategory(null)}
              title={collapsed ? t("nav_all_products", "Tất cả sản phẩm") : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                !activeCategory
                  ? "bg-indigo-600 text-white shadow-xs font-semibold"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400"
              }`}
            >
              <LayoutGrid className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate">{t("nav_all_products", "Tất cả sản phẩm")}</span>}
            </button>
            {categories.map((cat) => {
              const active = String(cat.id) === activeCategory;
              const catDisplayName = language === 'en'
                ? (cat.name_en || cat.nameEn || cat.name)
                : (cat.name_vi || cat.name);
              return (
                <button
                  key={cat.id}
                  onClick={() => selectCategory(cat.id)}
                  title={collapsed ? catDisplayName : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                    active
                      ? "bg-indigo-600 text-white shadow-xs font-semibold"
                      : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 shrink-0" />
                  {!collapsed && <span className="truncate">{catDisplayName}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tài khoản */}
        {isAuthenticated ? (
          <div className={collapsed ? "mt-1" : "mt-4"}>
            {!collapsed && (
              <button
                onClick={() => setAccountOpen(!accountOpen)}
                className="w-full flex items-center justify-between px-3 py-1 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              >
                {t("nav_account", "Tài khoản")}
                <ChevronRight
                  className={`w-4 h-4 transition-transform ${accountOpen ? "rotate-90" : ""}`}
                />
              </button>
            )}
            <div
              className={`flex flex-col gap-1 overflow-hidden transition-all duration-200 ${
                accountOpen || collapsed ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              {accountItems.map((it) =>
                collapsed ? (
                  <Link
                    key={it.to}
                    to={it.to}
                    onClick={onNavigate}
                    title={it.label}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                      isActive(it)
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <it.icon className="w-5 h-5 shrink-0" />
                  </Link>
                ) : (
                  renderItem(it)
                )
              )}
              {collapsed && (
                <button
                  onClick={() => {
                    logout();
                    onNavigate?.();
                  }}
                  title={t("nav_logout", "Đăng xuất")}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 cursor-pointer"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                </button>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={() => {
                  logout();
                  onNavigate?.();
                }}
                className="mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-all cursor-pointer"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {t("nav_logout", "Đăng xuất")}
              </button>
            )}
          </div>
        ) : (
          <div className={collapsed ? "mt-1" : "mt-4"}>
            {!collapsed && (
              <div className="px-3 mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-600">
                {t("nav_account", "Tài khoản")}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Link
                to="/login"
                onClick={onNavigate}
                title={collapsed ? t("nav_login", "Đăng nhập") : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <LogIn className="w-5 h-5 shrink-0" />
                {!collapsed && t("nav_login", "Đăng nhập")}
              </Link>
              <Link
                to="/register"
                onClick={onNavigate}
                title={collapsed ? t("nav_register", "Đăng ký") : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs transition-all cursor-pointer ${
                  collapsed ? "justify-center" : ""
                }`}
              >
                <UserPlus className="w-5 h-5 shrink-0" />
                {!collapsed && t("nav_register", "Đăng ký")}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {!collapsed && isAuthenticated && user && (
        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
            {user.name || user.email}
          </p>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {user.email}
          </p>
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_KEY) === "1"
  );
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let active = true;
    client
      .get("/api/shop/categories")
      .then((res) => {
        if (active && res.data?.ok) setCategories(res.data.data.categories || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

  const width = collapsed ? "w-16" : "w-64";

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col sticky top-16 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-[width] duration-200 transition-colors`}
      >
        <div className={`${width} flex flex-col h-full transition-[width] duration-200`}>
          <SidebarBody collapsed={collapsed} categories={categories} />
          {/* Collapse toggle */}
          <div className="border-t border-gray-100 dark:border-gray-800 p-2 flex justify-center">
            <button
              onClick={toggleCollapse}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
              title={collapsed ? "Mở rộng" : "Thu gọn"}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronLeft className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-5 left-5 z-40 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg flex items-center justify-center cursor-pointer"
        title="Mở menu"
      >
        <span className="text-xl leading-none font-bold">≡</span>
      </button>

      {/* Mobile Drawer (always expanded) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="w-72 max-w-[80%] bg-white dark:bg-gray-900 h-full shadow-xl animate-[slide-in_0.2s_ease-out] flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100 dark:border-gray-800">
              <span className="font-bold text-gray-900 dark:text-white">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarBody
                collapsed={false}
                onNavigate={() => setMobileOpen(false)}
                categories={categories}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
