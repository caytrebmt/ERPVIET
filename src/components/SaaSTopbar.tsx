import React, { useState, useRef, useEffect } from 'react';
import { Menu, Bell, Sun, Moon, Plus, ShieldCheck, PanelLeftClose, PanelLeftOpen, ShoppingBag, AlertTriangle, FileText, CheckCircle2, X, ArrowRight, Globe, LogOut, ChevronDown, UserCheck } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useSaaSAuth } from '../contexts/SaaSAuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import client from '../api/client';

interface SaaSTopbarProps {
  onOpenSidebar: () => void;
  title?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NotificationItem {
  id: string;
  type: 'order' | 'stock' | 'debt' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  link: string;
}

export const SaaSTopbar: React.FC<SaaSTopbarProps> = ({
  onOpenSidebar,
  title = {t('tong-quan-he-thong')},
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const { erpUser, erpLogout } = useSaaSAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);


  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      const res = await client.get('/api/saas/notifications');
      if (res.data?.ok) setNotifications(res.data.data.map((item: any) => ({
        id: String(item.id), type: 'system',
        title: language === 'en' ? (item.title_en || item.title_vi) : item.title_vi,
        message: language === 'en' ? (item.content_en || item.content_vi || '') : (item.content_vi || ''),
        time: item.created_at ? new Date(item.created_at).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN') : '',
        read: Boolean(item.is_read), link: item.link_url || '/saas/dashboard',
      })));
    };
    loadNotifications().catch(console.error);
    const timer = window.setInterval(() => loadNotifications().catch(console.error), 30000);
    return () => window.clearInterval(timer);
  }, [language]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const isDashboard =
    location.pathname === '/saas' ||
    location.pathname === '/saas/' ||
    location.pathname === '/saas/dashboard';

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayedTitle = title;

  return (
    <header className="h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-6 flex items-center justify-between transition-colors">
      {/* Left Section: Mobile Toggle, Desktop Collapse & Page Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onOpenSidebar}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 lg:hidden transition-colors cursor-pointer"
          title={t('topbar_open_menu')}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Desktop sidebar collapse / expand button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title={
              isCollapsed
                ? t('topbar_expand_sidebar')
                : t('topbar_collapse_sidebar')
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        )}

        <div>
          <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {displayedTitle}
          </h1>
        </div>
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Toggle */}
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-700"
          title={t('topbar_language_toggle')}
        >
          <Globe className="h-3.5 w-3.5 text-blue-500" />
          <span className="uppercase">{language === 'vi' ? 'EN' : 'VI'}</span>
          <span className="text-[10px] text-zinc-400">({language === 'vi' ? '🇬🇧 EN' : '🇻🇳 VN'})</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          title={t('topbar_toggle_theme')}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-zinc-600" />}
        </button>

        {/* Notifications Bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors relative cursor-pointer"
            title={t('topbar_system_notifications')}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-zinc-950 text-[10px] font-extrabold flex items-center justify-center ring-2 ring-white dark:ring-zinc-900">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fade-in_0.15s_ease-out]">
              <div className="p-3.5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {t('topbar_erp_notifications')}
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full border border-amber-500/30">
                       {unreadCount} {t('topbar_new')}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    {t('topbar_mark_read')}
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      setNotifications((prev) =>
                        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
                      );
                      setShowNotifications(false);
                      navigate(item.link);
                    }}
                    className={`p-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer flex gap-3 items-start ${
                      !item.read ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''
                    }`}
                  >
                    <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-zinc-100 dark:bg-zinc-800">
                      {item.type === 'order' && <ShoppingBag className="h-4 w-4 text-amber-500" />}
                      {item.type === 'stock' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      {item.type === 'debt' && <FileText className="h-4 w-4 text-indigo-500" />}
                      {item.type === 'system' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className={`text-xs font-bold truncate ${!item.read ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {item.title}
                        </p>
                        <span className="text-[10px] text-zinc-400 shrink-0">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800 text-center">
                <Link
                  to="/saas/web-orders"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-500 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{t('topbar_view_all')}</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ERP Authenticated User Dropdown Menu */}
        <div className="pl-2 border-l border-zinc-200 dark:border-zinc-800 relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <div className="h-8 w-8 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              {erpUser?.full_name ? erpUser.full_name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="hidden sm:block text-left pr-1">
              <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate max-w-[130px]">
                {erpUser?.full_name || t('topbar_erp_staff')}
              </p>
              <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-tight flex items-center gap-1">
              {/* <ShieldCheck className="w-3 h-3 inline" /> {erpUser?.role_name_vi || erpUser?.role_name_en || 'ROLE'}*/}
              <div className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" /> 
              <span>
    {language === 'en' 
      ? (erpUser?.role_name_en || erpUser?.role_name_vi || 'ROLE') 
      : (erpUser?.role_name_vi || erpUser?.role_name_en || 'ROLE')}
  </span>
</div>
              </p>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-[fade-in_0.15s_ease-out]">
              <div className="p-3.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-amber-500 text-zinc-950 font-bold text-xs flex items-center justify-center shrink-0">
                    {erpUser?.full_name ? erpUser.full_name.charAt(0).toUpperCase() : 'A'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {erpUser?.full_name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">@{erpUser?.username} • {erpUser?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-extrabold uppercase rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {erpUser?.role_code}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2 space-y-1">
                <Link
                  to="/"
                  onClick={() => setShowUserDropdown(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <ShoppingBag className="w-4 h-4 text-amber-500" />
                  <span>{t('xem-webshop')}</span>
                </Link>

                <button
                  onClick={() => {
                    setShowUserDropdown(false);
                    erpLogout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('dang-xuat-tai-khoan-erp')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

