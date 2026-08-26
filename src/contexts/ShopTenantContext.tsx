import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import client from "../api/client";

interface ShopTenantContextType {
  slug: string;
  name: string;
  companyId: number;
  settings: Record<string, any>;
  /**
   * URL prefix of the CURRENT storefront ("/shop/<slug>" when the address bar
   * is on a tenant WebShop, "" on the default/root storefront). Derived from
   * the URL only — never from localStorage — so two storefronts can never
   * bleed into each other inside one browser.
   */
  pathPrefix: string;
  /** Build an in-storefront link that keeps the current tenant's URL prefix. */
  shopPath: (path: string) => string;
}

const ShopTenantContext = createContext<ShopTenantContextType>({
  slug: 'default',
  name: 'WebShop',
  companyId: 0,
  settings: {},
  pathPrefix: '',
  shopPath: (path: string) => path,
});

function slugFromLocation(pathname: string, search: string): string {
  const pathMatch = pathname.match(/^\/shop\/([^/]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  return new URLSearchParams(search).get('tenant') || 'default';
}

function prefixFromLocation(pathname: string, search: string): string {
  const slug = slugFromLocation(pathname, search);
  return slug === 'default' ? '' : `/shop/${slug}`;
}

export const ShopTenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const pathPrefix = prefixFromLocation(location.pathname, location.search);
  const [tenant, setTenant] = useState<Omit<ShopTenantContextType, 'pathPrefix' | 'shopPath'>>(() => ({
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
        setTenant({
          slug: data.slug || requestedSlug,
          name: data.name || 'WebShop',
          companyId: Number(data.companyId) || 0,
          settings: data.settings || {},
        });
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

  // Every in-shop link goes through this helper so a customer browsing
  // /shop/<tenant> never loses the tenant context mid-navigation, while the
  // default storefront keeps its clean root URLs.
  const shopPath = useCallback(
    (path: string) => {
      if (!pathPrefix) return path;
      if (!path || path === '/') return pathPrefix;
      return `${pathPrefix}${path.startsWith('/') ? path : `/${path}`}`;
    },
    [pathPrefix],
  );

  return (
    <ShopTenantContext.Provider value={{ ...tenant, pathPrefix, shopPath }}>
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
