import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { LogIn, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useShopTenant } from "../contexts/ShopTenantContext";
import { useToast } from "../contexts/ToastContext";
import { storage } from "../utils/storage";
import { useTranslation } from "react-i18next";
import { loadGoogleGsi } from "../utils/loadGoogleGsi";

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { login, isAuthenticated, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { shopPath, pathPrefix } = useShopTenant();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already logged in. The default target keeps the current
  // storefront (a tenant WebShop stays inside /shop/<slug>).
  const from = (location.state as any)?.from?.pathname || shopPath("/");

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      showToast(t("page_login_email_password_required"), "error");
      return;
    }

    try {
      setSubmitting(true);
      const result = await login(email.trim(), password);
      if (result.ok) {
        showToast(result.message, "success");
        navigate(from, { replace: true });
      } else {
        showToast(result.message, "error");
      }
    } catch (err) {
      showToast(t("page_login_server_error"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full mx-auto my-auto flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col gap-6 transition-colors duration-200">
        {/* Title branding header */}
        <div className="text-center flex flex-col items-center gap-1">

          <h2 className="text-xl font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-2">{t('dang-nhap-tai-khoan')}</h2>
        </div>

        {/* Credentials guide panel 
        <div className="bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4 text-[11px] leading-relaxed text-indigo-850 dark:text-indigo-300 flex flex-col gap-1">
          <span className="font-bold">Tài khoản demo có sẵn:</span>
          <p className="m-0">Email: <strong className="select-all">test@example.com</strong></p>
          <p className="m-0">Mật khẩu: <strong className="select-all">password123</strong></p>
        </div>
          */}
        {/* Login form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> {t('email_login')}
            </label>
            <input
              type="email"
              required
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> {t('mat-khau-login-web')}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                title={showPassword ? t('auth_web.hidePassword') : t('auth_web.showPassword')}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-150 disabled:text-gray-400 font-bold rounded-xl py-3 text-xs flex items-center justify-center gap-2 transition-all shadow-xs mt-2 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('dang-kiem-tra')}
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
              
                {t('dang-nhap')} 
              </>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
            {t('chua-co-tai-khoan-webshop')}{" "}
            <Link to={shopPath("/register")} className="font-bold text-indigo-600 dark:text-indigo-450 hover:underline inline-flex items-center gap-0.5">
              {t('dang-ky-tai-khoan')} <ArrowRight className="w-3 h-3" />
            </Link>
          </p>
        </div>

         {/* Google OAuth divider + button */}
         <div className="mt-4">
           <div className="relative mb-4">
             <div className="absolute inset-0 flex items-center">
               <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
             </div>
             <div className="relative flex justify-center text-xs">
               <span className="bg-white dark:bg-gray-900 px-2 text-gray-500 dark:text-gray-400">{t('hoac-dang-nhap-voi')}</span>
             </div>
           </div>
           <button
             type="button"
             onClick={async () => {
               try {
                 const clientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
                 try {
                   await loadGoogleGsi();
                 } catch {
                   showToast(t("page_login_google_init_failed"), "error");
                   return;
                 }
                 if (!clientId || typeof window === 'undefined' || !(window as any).google?.accounts?.oauth2) {
                    showToast(t("page_login_google_init_failed"), "error");
                   return;
                 }
                 setSubmitting(true);
                 const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
                   client_id: clientId,
                   scope: 'profile email',
                   callback: async (resp: any) => {
                     if (resp.access_token) {
                       try {
                         const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                           headers: { Authorization: `Bearer ${resp.access_token}` },
                         });
                         const profile = await profileRes.json();
                         // The raw fetch bypasses the axios interceptor, so
                         // attach the tenant from the current URL explicitly —
                         // otherwise the account is resolved in the DEFAULT
                         // WebShop instead of this tenant's WebShop.
                         const tenantHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
                         const slugMatch = pathPrefix.match(/^\/shop\/([^/]+)$/i);
                         if (slugMatch?.[1]) tenantHeaders['x-tenant-slug'] = slugMatch[1];
                         const res = await fetch('/api/shop/auth/google', {
                           method: 'POST',
                           headers: tenantHeaders,
                           body: JSON.stringify({ google_profile: profile }),
                         });
                         const data = await res.json();
                         if (data.ok && data.data?.access_token) {
                           storage.setAccessToken(data.data.access_token);
                           storage.setRefreshToken(data.data.refresh_token);
                           storage.setUser(data.data.customer);
                            showToast(data.message || t("api_auth_google_login_success"), "success");
                           navigate(from, { replace: true });
                         } else {
                           showToast(data.message || 'Đăng nhập Google thất bại.', 'error');
                         }
                       } catch (e) {
                          showToast(t("page_login_google_server_error"), "error");
                       } finally {
                         setSubmitting(false);
                       }
                     } else {
                       setSubmitting(false);
                     }
                   },
                 });
                 tokenClient.requestAccessToken();
               } catch (e) {
                  showToast(t("page_login_google_connect_error"), "error");
                 setSubmitting(false);
               }
             }}
             disabled={submitting}
             className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-750 font-semibold rounded-xl py-2.5 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
           >
             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
               <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.3v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
               <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
               <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
               <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
             </svg>
             {t('dang-nhap-bang-google')}
           </button>
         </div>
      </div>
    </div>
  );
};

export default LoginPage;
export {};
