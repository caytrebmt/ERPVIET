import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import client from "../api/client";
import { storage } from "../utils/storage";
import { ErpUser } from "../types";
import { useTranslation } from "react-i18next";

interface SaaSAuthContextType {
  erpUser: ErpUser | null;
  setErpUser: (user: ErpUser | null) => void;
  erpLoading: boolean;
  isErpAuthenticated: boolean;
  erpLogin: (username: string, password: string) => Promise<{ ok: boolean; message: string }>;
  erpLogout: () => void;
  hasRole: (roles: string[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

const SaaSAuthContext = createContext<SaaSAuthContextType | undefined>(undefined);

export const SaaSAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [erpUser, setErpUser] = useState<ErpUser | null>(null);
  const [erpLoading, setErpLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadErpProfile() {
      const token = storage.getErpToken();
      const cachedUser = storage.getErpUser();

      if (!token) {
        setErpLoading(false);
        return;
      }

      // On the public webshop, restore the cached ERP user without hitting /auth/me.
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/saas")) {
        if (cachedUser) setErpUser(cachedUser);
        setErpLoading(false);
        return;
      }

      if (cachedUser) {
        setErpUser(cachedUser);
      }

      try {
        const response = await client.get("/api/saas/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.data && response.data.ok) {
          setErpUser(response.data.data);
          storage.setErpUser(response.data.data);
        }
      } catch (err) {
        console.error("Failed to verify ERP auth session", err);
        if (!cachedUser) {
          storage.clearErpAuth();
          setErpUser(null);
        }
      } finally {
        setErpLoading(false);
      }
    }

    loadErpProfile();
  }, []);

  const erpLogin = async (username: string, password: string) => {
    try {
      const res = await client.post("/api/saas/auth/login", { username, password });
      if (res.data && res.data.ok) {
        const { token, user } = res.data.data;
        storage.setErpToken(token);
        storage.setErpUser(user);
        setErpUser(user);
        return { ok: true, message: t("erp_login_success") };
      }
      return { ok: false, message: res.data.message || t("erp_login_failed") };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || t("erp_login_failed_detail");
      return { ok: false, message: errMsg };
    }
  };

  const erpLogout = () => {
    storage.clearErpAuth();
    setErpUser(null);
  };

  const hasRole = (roles: string[]): boolean => {
    if (!erpUser) return false;
    if (erpUser.role_code === "ADMIN") return true;
    return roles.includes(erpUser.role_code);
  };

  const hasPermission = (permission: string): boolean => {
    if (!erpUser) return false;
    if (erpUser.role_code === "ADMIN" || erpUser.permissions?.includes("*")) return true;
    return erpUser.permissions?.includes(permission) || false;
  };

  return (
    <SaaSAuthContext.Provider
      value={{
        erpUser,
        setErpUser,
        erpLoading,
        isErpAuthenticated: !!erpUser,
        erpLogin,
        erpLogout,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </SaaSAuthContext.Provider>
  );
};

export const useSaaSAuth = () => {
  const context = useContext(SaaSAuthContext);
  if (!context) {
    throw new Error("useSaaSAuth must be used within a SaaSAuthProvider");
  }
  return context;
};
