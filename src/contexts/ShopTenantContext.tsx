import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface ShopTenantContextType {
  slug: string;
  name: string;
  companyId: number;
  settings: Record<string, any>;
}

const ShopTenantContext = createContext<ShopTenantContextType>({
  slug: 'default',
  name: 'WebShop',
  companyId: 1,
  settings: {},
});

export const ShopTenantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [tenant, setTenant] = useState<ShopTenantContextType>({
    slug: 'default',
    name: 'WebShop',
    companyId: 1,
    settings: {},
  });

  useEffect(() => {
    const pathParts = location.pathname.split('/');
    let detectedSlug = 'default';
    let detectedCompanyId = 1;
    let detectedName = 'WebShop';
    let detectedSettings: Record<string, any> = {};

    if (pathParts[1] === 'shop' && pathParts[2]) {
      detectedSlug = pathParts[2];
    } else if (location.search.includes('tenant=')) {
      const params = new URLSearchParams(location.search);
      detectedSlug = params.get('tenant') || 'default';
    }

    const stored = localStorage.getItem('shop_tenant');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.slug === detectedSlug) {
          setTenant({
            slug: parsed.slug,
            name: parsed.name || 'WebShop',
            companyId: parsed.companyId || 1,
            settings: parsed.settings || {},
          });
          return;
        }
      } catch {}
    }

    setTenant({
      slug: detectedSlug,
      name: detectedName,
      companyId: detectedCompanyId,
      settings: detectedSettings,
    });
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
