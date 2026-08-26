import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShoppingCart, Search, Sun, Moon, LayoutDashboard, User, Package, LogOut, LogIn, UserPlus, ChevronDown, ShieldCheck, Globe, Building2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useShopTenant } from "../contexts/ShopTenantContext";
import { motion, AnimatePresence } from "motion/react";

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { cart } = useCart();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { slug, name, shopPath } = useShopTenant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync search input from URL
  useEffect(() => {
    const query = searchParams.get("search");
    if (query) {
      setSearchInput(query);
    } else {
      setSearchInput("");
    }
  }, [searchParams]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      navigate(shopPath(`/?search=${encodeURIComponent(searchInput.trim())}`));
    } else {
      navigate(shopPath("/"));
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-xs transition-colors duration-200">
      <div className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-2 sm:px-4 md:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-1 sm:gap-2 md:gap-4">
        {/* Logo */}
        <Link to={shopPath("/")} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-500 rounded-lg flex items-center justify-center font-bold text-zinc-950 text-base sm:text-lg leading-none shadow-xs">
            {slug !== 'default' ? name.charAt(0).toUpperCase() : 'W'}
          </div>
          <span className="hidden sm:inline text-base sm:text-xl font-bold tracking-tight text-[#111827] dark:text-white flex items-left uppercase">
            {slug !== 'default' ? name : 'WebShop'} <span className="text-amber-500 ml-0.5 sm:ml-1"></span>
          </span>
        </Link>

        {/* Search Bar - Desktop */}
        <form onSubmit={handleSearchSubmit} className="hidden md:flex items-center flex-1 max-w-md relative">
          <input
            type="text"
            placeholder={t("search_product_placeholder", "Tìm tên sản phẩm, mã SKU...")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-gray-100 dark:bg-gray-800 border-none rounded-full pl-4 pr-10 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white dark:focus:bg-gray-950 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all"
          />
          <button type="submit" className="absolute right-3 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer">
            <Search className="w-4 h-4" />
          </button>
        </form>

         {/* Right controls */}
         <div className="flex items-center gap-1 sm:gap-2 md:gap-3">
          {/* Theme Toggle Button - Desktop */}
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-100 rounded-full transition-colors cursor-pointer"
            title={theme === "dark" ? t("switch_light_mode", "Chuyển sang Giao diện Sáng") : t("switch_dark_mode", "Chuyển sang Giao diện Tối")}
          >
            {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Language Toggle Button */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-md border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
            title={t('topbar_language_toggle')}
          >
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            <span className="uppercase">{language === 'vi' ? 'EN' : 'VI'}</span>
          </button>

          {/* Tenant Badge */}
          {slug !== 'default' && (
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Building2 className="w-3 h-3" />
              {name}
            </span>
          )}

          {/* Cart Icon */}
          <Link to={shopPath("/cart")} className="relative p-2 text-gray-500 hover:text-gray-950 dark:text-gray-400 dark:hover:text-gray-100 transition-colors">
            <ShoppingCart className="w-6 h-6" />
            <AnimatePresence>
              {cart && cart.item_count > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 bg-amber-500 text-zinc-950 text-[10px] font-extrabold rounded-full w-5 h-5 flex items-center justify-center border border-white dark:border-gray-900 shadow-xs"
                >
                  {cart.item_count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>

          {/* User Profile / Account Section */}
          <div className="pl-1 sm:pl-2 border-l border-gray-200 dark:border-gray-800 relative" ref={dropdownRef}>
            {isAuthenticated && user ? (
              <div>
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[130px] leading-tight">
                      {user.name}
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-tight">
                      {user.customer_id ? `${t("customer_code", "Mã KH")}: KH-#${user.customer_id}` : t("webshop_customer", "Khách hàng WebShop")}
                    </p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showUserDropdown ? "rotate-180" : ""}`} />
                </button>

                {/* User Dropdown Menu */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fade-in_0.15s_ease-out]">
                    <div className="p-3.5 bg-gradient-to-r from-indigo-50/60 to-amber-50/60 dark:from-indigo-950/30 dark:to-amber-950/30 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                          {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                            {user.name}
                          </p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            {user.email || user.phone}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                            <ShieldCheck className="w-3 h-3" /> {t("verified_account", "Tài khoản đã xác thực")}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <Link
                        to="/saas/dashboard"
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-amber-500" />
                        <span>{t("erp_saas_admin", "Trang Quản Trị ERP SaaS")}</span>
                      </Link>

                      <Link
                        to={shopPath("/orders")}
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <Package className="w-4 h-4 text-indigo-500" />
                        <span>{t("nav_my_orders", "Đơn hàng của tôi")}</span>
                      </Link>

                      <Link
                        to={shopPath("/account")}
                        onClick={() => setShowUserDropdown(false)}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        <User className="w-4 h-4 text-amber-500" />
                        <span>{t("profile_password", "Hồ sơ cá nhân & Mật khẩu")}</span>
                      </Link>
                    </div>

                    <div className="p-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/50">
                      <button
                        onClick={() => {
                          setShowUserDropdown(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t("nav_logout", "Đăng xuất")}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
             ) : (
               <div className="flex items-center gap-1.5">
                 <Link
                   to={shopPath("/login")}
                   className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                 >
                   <LogIn className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                   <span>{t("nav_login", "Đăng nhập")}</span>
                 </Link>
                 <Link
                   to={shopPath("/register")}
                   className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all"
                 >
                   <UserPlus className="w-3.5 h-3.5" />
                   <span>{t("nav_register", "Đăng ký")}</span>
                 </Link>
                 <Link
                   to="/saas/register"
                   className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                 >
                   <Building2 className="w-3.5 h-3.5" />
                   <span className="hidden md:inline">{t("nav_erp_register", "Đăng ký Doanh nghiệp")}</span>
                   <span className="md:hidden">ERP</span>
                 </Link>
               </div>
             )}
          </div>
        </div>
      </div>

      {/* Search bar mobile */}
      <form onSubmit={handleSearchSubmit} className="md:hidden px-2 sm:px-4 pb-2 sm:pb-3">
        <div className="relative">
          <input
            type="text"
            placeholder={t("search_product_placeholder", "Tìm kiếm sản phẩm...")}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg pl-4 pr-10 py-2 text-sm focus:outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <button type="submit" className="absolute right-3 top-2.5 text-gray-400 cursor-pointer">
            <Search className="w-4 h-4" />
          </button>
        </div>
      </form>
    </header>
  );
};

export default Header;
