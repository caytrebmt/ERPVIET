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
  const { language } = useLanguage();
  const location = useLocation();

  const isEn = language === 'en';
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
      title: isEn ? 'OVERVIEW & SALES' : 'TỔNG QUAN & BÁN HÀNG',
      items: [
        { name: isEn ? 'Dashboard Overview' : 'Dashboard Overview', path: '/saas/dashboard', icon: LayoutDashboard },
        { name: isEn ? 'WebShop Orders' : 'Đơn Hàng WebShop', path: '/saas/web-orders', icon: ShoppingBag },
        { name: isEn ? 'Products & Materials' : 'Hàng hóa & Vật tư', path: '/saas/products', icon: Package },
        { name: isEn ? 'Categories & Units' : 'Danh mục & ĐVT', path: '/saas/categories-units', icon: Tag },
        { name: isEn ? 'CRM & Sales Pipeline' : 'CRM & KH Tiềm Năng', path: '/saas/crm', icon: Target },
        { name: isEn ? 'Customers' : 'Khách hàng', path: '/saas/customers', icon: Users },
        { name: isEn ? 'Suppliers' : 'Nhà cung cấp', path: '/saas/suppliers', icon: Truck },
      ],
    },
    {
      title: isEn ? 'WAREHOUSE & DOCUMENTS' : 'QUẢN LÝ KHO & CHỨNG TỪ',
      items: [
        { name: isEn ? 'Warehouse Locations' : 'Địa điểm Kho bãi', path: '/saas/warehouses', icon: Warehouse },
        { name: isEn ? 'Purchasing & Procurement' : 'Mua Hàng & Đơn PO', path: '/saas/purchasing', icon: ShoppingCart },
        { name: isEn ? 'Stock In Receipt' : 'Nhập kho (Stock In)', path: '/saas/stock-in', icon: ArrowDownLeft },
        { name: isEn ? 'Stock Out Issue' : 'Xuất kho (Stock Out)', path: '/saas/stock-out', icon: ArrowUpRight },
        { name: isEn ? 'Stocktaking & Discrepancies' : 'Kiểm kê Kho & Lệch kho', path: '/saas/stocktaking', icon: ClipboardList },
        { name: isEn ? 'Commercial Quotations' : 'Báo giá Commercial', path: '/saas/quotations', icon: FileSpreadsheet },
        { name: isEn ? 'Stock Balance Report' : 'Báo cáo Tồn kho', path: '/saas/inventory', icon: Boxes },
      ],
    },
    {
      title: isEn ? 'FINANCE & ACCOUNTING' : 'TÀI CHÍNH & KẾ TOÁN',
      items: [
        { name: isEn ? 'Debts & Cash Flow' : 'Sổ Công nợ & Thu Chi', path: '/saas/debt', icon: Receipt },
        { name: isEn ? 'Fixed Assets (TT200)' : 'Tài Sản Cố Định (TSCĐ)', path: '/saas/assets', icon: Layers },
        { name: isEn ? 'VAT Tax Filings' : 'Kê Khai Thuế GTGT (VAT)', path: '/saas/vat', icon: Percent },
        { name: isEn ? 'Accounting Ledger' : 'Hệ Thống Kế Toán (TT200)', path: '/saas/accounting', icon: Calculator },
        { name: isEn ? 'Financial Reports & P&L' : 'Báo cáo Tài chính & KQKD', path: '/saas/reports', icon: BarChart3 },
      ],
    },
    {
      title: isEn ? 'SYSTEM & ONLINE STORE' : 'HỆ THỐNG & KÊNH ONLINE',
      items: [
        { name: isEn ? 'Security Audit Logs' : 'Nhật Ký An Ninh (Audit)', path: '/saas/audit-logs', icon: ShieldAlert },
        { name: isEn ? 'System Settings' : 'Cài đặt Hệ thống', path: '/saas/settings', icon: Settings },
        { name: isEn ? 'WebShop Front' : 'WebShop Online', path: '/', icon: ShoppingBag },
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
                {isEn ? 'Menu Groups' : 'Menu'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAll}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {isEn ? 'Expand All' : 'Mở hết'}
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {isEn ? 'Collapse All' : 'Thu gọn'}
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
                    {isEn ? 'Database Connected' : 'Đã kết nối Dữ liệu'}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                  ONLINE
                </span>
              </div>

              <div className="text-[11px] space-y-1 text-zinc-400 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">{isEn ? 'Engine' : 'Hệ CSDL'}:</span>
                  <span className="font-semibold text-zinc-300">PostgreSQL / Supabase</span>
                </div>
                
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-center p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400"
              title={isEn ? 'Database Connected (PostgreSQL / Supabase)' : 'Đã kết nối Dữ liệu (PostgreSQL / Supabase)'}
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