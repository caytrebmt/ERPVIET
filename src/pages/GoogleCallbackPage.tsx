import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useShopTenant } from "../contexts/ShopTenantContext";
import { useToast } from "../contexts/ToastContext";
import { storage } from "../utils/storage";
import { useTranslation } from "react-i18next";

const GoogleCallbackPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { shopPath, pathPrefix } = useShopTenant();
  const { setUser } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      showToast(t("page_google_cancel_error"), "error");
      navigate(shopPath("/login"), { replace: true });
      return;
    }

    if (!code) {
      showToast(t("page_google_missing_code"), "error");
      navigate(shopPath("/login"), { replace: true });
      return;
    }

    (async () => {
      try {
        // Raw fetch: pass the tenant slug from the URL explicitly so the
        // Google account is bound to THIS tenant's WebShop.
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const slugMatch = pathPrefix.match(/^\/shop\/([^/]+)$/i);
        if (slugMatch?.[1]) headers["x-tenant-slug"] = slugMatch[1];
        const res = await fetch("/api/shop/auth/google/callback", {
          method: "POST",
          headers,
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.ok && data.data) {
          const { access_token, refresh_token, customer } = data.data;
          storage.setAccessToken(access_token);
          storage.setRefreshToken(refresh_token);
          storage.setUser(customer);
          setUser(customer);
          showToast(data.message || t("auth_login_success"), "success");
          navigate(shopPath("/"), { replace: true });
        } else {
          showToast(data.message || t("erp_login_failed"), "error");
          navigate(shopPath("/login"), { replace: true });
        }
      } catch (e) {
        showToast(t("page_google_server_error"), "error");
        navigate(shopPath("/login"), { replace: true });
      }
    })();
  }, [searchParams, navigate, setUser, showToast]);

  return (
    <div className="max-w-md w-full mx-auto my-auto flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col gap-4 items-center justify-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">{t("page_google_server_error")}</p>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
export {};
