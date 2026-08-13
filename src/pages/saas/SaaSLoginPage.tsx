import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, Lock, User, ShieldCheck, ArrowRight, Eye, EyeOff, Globe, Sparkles, ShoppingBag } from "lucide-react";
import { useSaaSAuth } from "../../contexts/SaaSAuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "react-i18next";

export const SaaSLoginPage: React.FC = () => {
  const { erpLogin } = useSaaSAuth();
  const { showToast } = useToast();
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/saas/dashboard";
  const isEn = language === "en";

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast(t("page_saas_login_erp_required"), "error");
      return;
    }

    setLoading(true);
    const result = await erpLogin(username.trim(), password.trim());
    setLoading(false);

    if (result.ok) {
      showToast(result.message, "success");
      navigate(from, { replace: true });
    } else {
      showToast(result.message, "error");
    }
  };

  const demoAccounts: { username: string; password: string; title: string; roleCode: string; desc: string; badgeClass: string }[] = [];

  const fillAndLogin = async (userAcc: string, passAcc: string) => {
    setUsername(userAcc);
    setPassword(passAcc);
    setLoading(true);
    const result = await erpLogin(userAcc, passAcc);
    setLoading(false);
    if (result.ok) {
      showToast(result.message, "success");
      navigate(from, { replace: true });
    } else {
      showToast(result.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Subtle Ambient Background Gradients */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 font-bold flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none text-zinc-100">
              ERP-VIET
            </h1>
             <span className="text-[10px] text-amber-400 font-semibold">
               {t('saas_login_subtitle')}
             </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="uppercase">{language === 'vi' ? 'EN' : 'VI'}</span>
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">{t('saas_login_front')}</span>
          </Link>
        </div>
      </header>

      {/* Main Content Form */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 sm:py-12 flex flex-col lg:flex-row items-stretch justify-center gap-8 relative z-10">
        {/* Left Form Box */}
        <div className="w-full lg:w-1/2 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-extrabold flex items-center gap-1">
                 <ShieldCheck className="w-3.5 h-3.5" />
                 <span>{t('saas_login_staff_portal')}</span>
               </span>
            </div>
             <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
               {t('saas_login_heading')}
             </h2>
             <p className="text-xs text-zinc-400 leading-relaxed mb-6">
               {t('saas_login_desc')}
             </p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
               <div>
                 <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                   {t('saas_login_username_label')}
                 </label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                     <User className="w-4 h-4" />
                   </div>
                   <input
                     type="text"
                     required
                     value={username}
                     onChange={(e) => setUsername(e.target.value)}
                     placeholder={t('saas_login_username_placeholder')}
                     className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                   />
                 </div>
               </div>

               <div>
                 <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                   {t('saas_login_password_label')}
                 </label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                     <Lock className="w-4 h-4" />
                   </div>
                   <input
                     type={showPassword ? "text" : "password"}
                     required
                     value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder={t('saas_login_password_placeholder')}
                     className="w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                   />
                   <button
                     type="button"
                     onClick={() => setShowPassword(!showPassword)}
                     className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                   >
                     {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                 </div>
               </div>

              <div className="flex items-center justify-between text-xs py-1">
                 <label className="flex items-center gap-2 text-zinc-400 cursor-pointer">
                   <input
                     type="checkbox"
                     
                     className="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0"
                   />
                   <span>{t('saas_login_remember')}</span>
                 </label>
                 <span className="text-zinc-500 text-[11px]">{t('saas_login_security')}</span>
               </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-400 active:scale-[0.99] text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{t('saas_login_button')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
             <p className="text-[11px] text-zinc-500">
               {t('saas_login_audit')}
             </p>
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-zinc-900 text-center text-[11px] text-zinc-600 relative z-10">
         {t('saas_login_copyright')}
       </footer>
    </div>
  );
};
