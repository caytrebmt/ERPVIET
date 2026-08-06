import React, { useState, useEffect } from 'react';
import { SaaSSidebar } from '../components/SaaSSidebar';
import { SaaSTopbar } from '../components/SaaSTopbar';

interface SaaSLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const SaaSLayout: React.FC<SaaSLayoutProps> = ({ children, title }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('saas_sidebar_collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('saas_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* Sidebar Navigation */}
      <SaaSSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main Content Body with Fluid Padding */}
      <div
        className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:pl-20' : 'lg:pl-64'
        }`}
      >
        <SaaSTopbar
          onOpenSidebar={() => setSidebarOpen(true)}
          title={title}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 w-full mx-auto space-y-6 max-w-7xl xl:max-w-screen-2xl">
          {children}
        </main>
      </div>
    </div>
  );
};

export default SaaSLayout;

