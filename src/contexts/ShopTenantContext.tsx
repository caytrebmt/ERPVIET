import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import client from "../api/client";

interface ShopTenantContextType {
  slug: string;
  name: string;
  companyId: number;
  settings: Record<string, any>;
}

const ShopTenantContext = createContext<ShopTenantContextType>({
  slug: 'default',
  name: 'WebShop',
  companyId: 0,
  settings: {},
});

function slugFromLocation(pathname: string, search: string): string {
  const pathMatch = pathname.match(/^\/shop\/([^/]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  return new URLSearchParams(search).get('tenant') || 'default';
}

export const ShopTenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [tenant, setTenant] = useState<ShopTenantContextType>(() => ({
    slug: slugFromLocation(window.location.pathname, window.location.search),
    name: 'WebShop',
    companyId: 0,
    settings: {},
  }));

  useEffect(() => {
    let cancelled = false;
    const requestedSlug = slugFromLocation(location.pathname, location.search);

    // Clear stale tenant data immediately when navigating between storefronts.
    setTenant({ slug: requestedSlug, name: 'WebShop', companyId: 0, settings: {} });

    client
      .get('/api/shop/tenant/info')
      .then((response) => {
        const data = response.data?.data;
        if (cancelled || !response.data?.ok || !data) return;
        const resolved = {
          slug: data.slug || requestedSlug,
          name: data.name || 'WebShop',
          companyId: Number(data.companyId) || 0,
          settings: data.settings || {},
        };
        setTenant(resolved);
        localStorage.setItem('shop_tenant', JSON.stringify(resolved));
      })
      .catch((error) => {
        // A storefront without a resolved tenant must not silently render data
        // from another company. The API will return the actual error to the
        // page; keep companyId=0 here rather than inventing a tenant.
        if (!cancelled) console.warn('[Shop Tenant] Could not load tenant info', error?.message);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);

  return (
    <ShopTenantContext.Provider value={tenant}>
      {children}
    </ShopTenantContext.Provider>
  );
};

export const useShopTenant = () => {
  const context = useContext(ShopTenantContext);
  if (!context) {
    throw new Error("useShopTenant must be used within a ShopTenantProvider");
  }
  return context;
};
