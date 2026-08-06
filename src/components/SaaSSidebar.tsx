import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Boxes,
  Receipt,
  Calculator,
  Settings,
  ShoppingBag,
  Building2,
  ChevronRight,
  ChevronDown,
  LogOut,
  Warehouse,
  Tag,
  BarChart3,
  ClipboardList,
  Percent,
  ChevronLeft,
  Target,
  ShoppingCart,
  Layers,
  ShieldAlert,
  FolderClosed,
  FolderOpen,
  Database,
  Server,
  Wifi,
} from 'lucide-react';
import { useSaaSAuth } from '../contexts/SaaSAuthContext';
import { useLanguage } from '../contexts/LanguageContext';

interface SaaSSidebarProps {
  isOpen: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SaaSSidebar: React.FC<SaaSSidebarProps> = ({
  isOpen,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const { erpUser, erpLogout } = useSaaSAuth();
  const { language, t } = useLanguage();
  const location = useLocation();

   const role = erpUser?.role_code || 'ADMIN';

  // Role based filtering logic
  const isAllowedPath = (path: string): boolean => {
    if (role === 'ADMIN') return true;
    if (path === '/saas/dashboard' || path === '/') return true;

    if (role === 'SALES') {
      return ['/saas/web-orders', '/saas/products', '/saas/categories-units', '/saas/customers', '/saas/quotations'].includes(path);
    }
    if (role === 'ACCOUNTANT') {
      return ['/saas/web-orders', '/saas/debt', '/saas/vat', '/saas/accounting', '/saas/reports'].includes(path);
    }
    if (role === 'WAREHOUSE') {
      return ['/saas/products', '/saas/warehouses', '/saas/stock-in', '/saas/stock-out', '/saas/stocktaking', '/saas/inventory'].includes(path);
    }
    if (role === 'PURCHASING') {
      return ['/saas/products', '/saas/suppliers', '/saas/stock-in'].includes(path);
    }
    return true;
  };

  const navGroupsRaw = [
    {
        title: t('sidebar_overview_sales'),
      items: [
        { name: t('sidebar_dashboard'), path: '/saas/dashboard', icon: LayoutDashboard },
        { name: t('sidebar_web_orders'), path: '/saas/web-orders', icon: ShoppingBag },
        { name: t('sidebar_products_materials'), path: '/saas/products', icon: Package },
        { name: t('sidebar_categories_units'), path: '/saas/categories-units', icon: Tag },
        { name: t('sidebar_crm_pipeline'), path: '/saas/crm', icon: Target },
        { name: t('sidebar_customers'), path: '/saas/customers', icon: Users },
        { name: t('sidebar_suppliers'), path: '/saas/suppliers', icon: Truck },
      ],
    },
    {
        title: t('sidebar_warehouse_documents'),
      items: [
        { name: t('sidebar_warehouse_locations'), path: '/saas/warehouses', icon: Warehouse },
        { name: t('sidebar_purchasing_procurement'), path: '/saas/purchasing', icon: ShoppingCart },
        { name: t('sidebar_stock_in'), path: '/saas/stock-in', icon: ArrowDownLeft },
        { name: t('sidebar_stock_out'), path: '/saas/stock-out', icon: ArrowUpRight },
        { name: t('sidebar_stocktaking'), path: '/saas/stocktaking', icon: ClipboardList },
        { name: t('sidebar_commercial_quotations'), path: '/saas/quotations', icon: FileSpreadsheet },
        { name: t('sidebar_stock_balance'), path: '/saas/inventory', icon: Boxes },
      ],
    },
    {
        title: t('sidebar_finance_accounting'),
      items: [
        { name: t('sidebar_debts_cashflow'), path: '/saas/debt', icon: Receipt },
        { name: t('sidebar_fixed_assets'), path: '/saas/assets', icon: Layers },
        { name: t('sidebar_vat_tax'), path: '/saas/vat', icon: Percent },
        { name: t('sidebar_accounting_ledger'), path: '/saas/accounting', icon: Calculator },
        { name: t('sidebar_financial_reports'), path: '/saas/reports', icon: BarChart3 },
      ],
    },
    {
        title: t('sidebar_system_online_store'),
      items: [
        { name: t('sidebar_security_audit'), path: '/saas/audit-logs', icon: ShieldAlert },
        { name: t('sidebar_system_settings'), path: '/saas/settings', icon: Settings },
        { name: t('sidebar_webshop_front'), path: '/', icon: ShoppingBag },
      ],
    },
  ];

  // Filter groups and items
  const navGroups = navGroupsRaw
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isAllowedPath(item.path)),
    }))
    .filter((group) => group.items.length > 0);

  // Group collapse/expand state
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

  // Auto expand ONLY the group containing current route when location changes (Accordion style)
  useEffect(() => {
    const currentPath = location.pathname;
    let activeGroupIdx = -1;

    navGroups.forEach((group, idx) => {
      const isActiveChild = group.items.some((item) => item.path === currentPath);
      if (isActiveChild) {
        activeGroupIdx = idx;
      }
    });

    if (activeGroupIdx !== -1) {
      setOpenGroups({ [activeGroupIdx]: true });
    } else {
      setOpenGroups((prev) => (Object.keys(prev).length === 0 ? { 0: true } : prev));
    }
  }, [location.pathname]);

  const toggleGroup = (idx: number) => {
    setOpenGroups((prev) => {
      const isOpen = !!prev[idx];
      const openCount = Object.values(prev).filter(Boolean).length;

      // If this group is open and it's the only one open, collapse it
      if (isOpen && openCount === 1) {
        return {};
      }
      // Accordion effect: Close all other groups and open ONLY this clicked group
      return { [idx]: true };
    });
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    navGroups.forEach((_, idx) => (all[idx] = true));
    setOpenGroups(all);
  };

  const collapseAll = () => {
    setOpenGroups({});
  };


  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen bg-zinc-900 text-zinc-100 border-r border-zinc-800 flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'} w-64`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-zinc-950 font-bold shadow-lg shadow-amber-500/20 shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <h1 className="font-bold text-base text-zinc-100 tracking-tight leading-tight truncate">
                  ERP-VIET
                </h1>
                <span className="text-[10px] text-amber-400 font-medium px-1.5 py-0.5 rounded-xs bg-amber-500/10 border border-amber-500/20">
                  Enterprise
                </span>
              </div>
            )}
          </div>

          {/* Desktop Toggle Button in Header 
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
              title={isCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
            >
              <ChevronLeft className={`h-4 w-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          )}*/}
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 no-scrollbar">
          {/* Quick Collapse / Expand All Buttons */}
          {!isCollapsed && (
            <div className="px-2 pb-2 flex items-center justify-between border-b border-zinc-800/60 text-[11px] text-zinc-400">
                <span className="font-semibold text-zinc-500 uppercase tracking-wider text-[10px]">
                  {t('sidebar_menu_groups')}
                </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {t('sidebar_expand_all')}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {t('sidebar_collapse_all')}
                </button>
              </div>
            </div>
          )}

          {navGroups.map((group, idx) => {
            const isOpenGroup = !!openGroups[idx];

            return (
              <div key={idx} className="space-y-1">
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(idx)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold text-zinc-400 hover:text-amber-400 uppercase tracking-wider rounded-lg hover:bg-zinc-800/40 transition-colors group cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {isOpenGroup ? (
                        <FolderOpen className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <FolderClosed className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      )}
                      <span className="truncate">{group.title}</span>
                      <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 shrink-0">
                        {group.items.length}
                      </span>
                    </div>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-zinc-500 transition-transform duration-200 group-hover:text-amber-400 ${
                        isOpenGroup ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                ) : (
                  <div className="my-2 border-t border-zinc-800/80" />
                )}

                {/* Group Items List with Smooth Height Motion */}
                <AnimatePresence initial={false}>
                  {(isCollapsed || isOpenGroup) && (
                    <motion.div
                      key="accordion-content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className={!isCollapsed ? 'pl-1 py-1 space-y-1' : 'space-y-1'}>
                        {group.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <NavLink
                              key={item.path}
                              to={item.path}
                              onClick={onClose}
                              title={isCollapsed ? `${group.title}: ${item.name}` : undefined}
                              className={({ isActive }) =>
                                `flex items-center ${
                                  isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2'
                                } rounded-xl text-sm font-medium transition-all ${
                                  isActive
                                    ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                                }`
                              }
                            >
                              <div className="flex items-center gap-2.5">
                                <Icon className="h-4.5 w-4.5 shrink-0" />
                                {!isCollapsed && <span className="truncate text-xs">{item.name}</span>}
                              </div>
                              {!isCollapsed && <ChevronRight className="h-3 w-3 opacity-40 shrink-0" />}
                            </NavLink>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer Database Connection Info */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/70">
          {!isCollapsed ? (
            <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </div>
                  <span className="text-xs font-bold text-zinc-200">
                    {t('sidebar_database_connected')}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  ONLINE
                </span>
              </div>

              <div className="text-[11px] space-y-1 text-zinc-400 font-mono">
                <div className="flex items-center justify-between">
                    <span className="text-zinc-500">{t('sidebar_engine')}:</span>
                  <span className="font-semibold text-zinc-300">PostgreSQL / Supabase</span>
                </div>
                
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400"
               title={isCollapsed ? t('sidebar_database_connected_detail') : undefined}
            >
              <div className="relative">
                <Database className="h-5 w-5 text-amber-400" />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-zinc-900" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};