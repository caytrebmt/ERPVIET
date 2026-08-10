import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, UserPlus, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTranslation } from "react-i18next";
import { storage } from "../../utils/storage";

export const SaaSRegisterPage: React.FC = () => {
  const { showToast } = useToast();
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [isGoogleFlow, setIsGoogleFlow] = useState(false);

  const [form, setForm] = useState<{
    name_vi: string;
    tax_code: string;
    email: string;
    phone: string;
    address: string;
    owner_name: string;
    owner_email: string;
    owner_password: string;
    plan_type: string;
  }>({
    name_vi: "",
    tax_code: "",
    email: "",
    phone: "",
    address: "",
    owner_name: "",
    owner_email: "",
    owner_password: "",
    plan_type: "trial",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name_vi.trim()) errs.name_vi = t("saas_register_company_name_required");
    if (!form.tax_code.trim()) errs.tax_code = t("saas_register_tax_code_required");
    if (!form.owner_email.trim()) errs.owner_email = t("saas_register_admin_email_required");
    if (!form.owner_password || form.owner_password.length < 6) errs.owner_password = t("saas_register_admin_password_min");
    if (!form.owner_name.trim()) errs.owner_name = t("saas_register_admin_name_required");
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleFlow(true);
    setGoogleSubmitting(true);
    try {
      let googleProfile: any = null;

      if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
            client_id: (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '',
          scope: 'profile email',
          callback: (resp: any) => {
            if (resp.access_token) {
              fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${resp.access_token}` },
              })
                .then((r) => r.json())
                .then((profile) => {
                  prefillFromGoogle(profile);
                })
                .catch(() => showToast(t("page_saas_register_google_failed"), "error"))
                .finally(() => setGoogleSubmitting(false));
            } else {
              setGoogleSubmitting(false);
            }
          },
        });
        tokenClient.requestAccessToken();
        return;
      }

      googleProfile = {
        sub: 'mock-google-' + Date.now(),
        email: 'demo.user@gmail.com',
        name: 'Nguyễn Văn A',
        given_name: 'Nguyễn Văn',
        family_name: 'A',
        picture: '',
      };

      await new Promise((resolve) => setTimeout(resolve, 600));
      prefillFromGoogle(googleProfile);
      showToast(t("page_saas_register_google_demo"), "success");
    } catch (err) {
      showToast(t("page_saas_register_google_login_failed"), "error");
      setGoogleSubmitting(false);
      setIsGoogleFlow(false);
    }
  };

  const prefillFromGoogle = (profile: any) => {
    const email = profile.email || '';
    const name = profile.name || '';
    const givenName = profile.given_name || '';
    const familyName = profile.family_name || '';
    const fullName = name || `${givenName} ${familyName}`.trim();

    setForm((prev) => ({
      ...prev,
      owner_email: email,
      owner_name: fullName,
      email: email,
      owner_password: '',
    }));
    setGoogleSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast(t("page_saas_register_validation_error"), "error");
      return;
    }

    setSubmitting(true);
    try {
      const payload = isGoogleFlow
        ? {
            google_profile: {
              email: form.owner_email,
              name: form.owner_name,
              given_name: form.owner_name.split(' ').slice(-1)[0] || form.owner_name,
              family_name: form.owner_name.split(' ').slice(0, -1).join(' ') || '',
            },
            company_info: {
              name_vi: form.name_vi,
              tax_code: form.tax_code,
              email: form.email || form.owner_email,
              phone: form.phone,
              address: form.address,
            },
            plan_type: form.plan_type,
          }
        : form;

      const endpoint = isGoogleFlow ? '/api/saas/auth/google/callback' : '/api/saas/tenants/register';
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || t("page_saas_register_success"), "success");
        if (data.data?.token) {
          storage.setAccessToken(data.data.token);
        }
        setTimeout(() => navigate('/saas/login', { replace: true }), 800);
      } else {
        showToast(data.message || t("page_saas_register_failed"), "error");
        setSubmitting(false);
      }
    } catch {
      showToast(t("page_saas_register_server_error"), "error");
      setSubmitting(false);
    }
  };

  const isEn = language === "en";

  const plans = [
    { value: "trial", labelKey: "saas_register_plan_trial", price: "0₫", color: "border-zinc-700 bg-zinc-900" },
    { value: "starter", labelKey: "saas_register_plan_starter", price: "499K/tháng", color: "border-indigo-500/30 bg-indigo-500/5" },
    { value: "professional", labelKey: "saas_register_plan_professional", price: "1.2TR/tháng", color: "border-amber-500/30 bg-amber-500/5" },
    { value: "enterprise", labelKey: "saas_register_plan_enterprise", price: "Liên hệ", color: "border-emerald-500/30 bg-emerald-500/5" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden font-sans">
      {/* Background */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Bar */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 font-bold flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight leading-none text-zinc-100">ERP-VIET</h1>
             <span className="text-[10px] text-amber-400 font-semibold">{t('saas_register_subtitle')}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleLanguage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer">
            <span className="uppercase">{language === 'vi' ? 'EN' : 'VI'}</span>
          </button>
          <Link to="/saas/login" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer">
            {t('saas_register_have_account')}
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 sm:py-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-3 bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-6">
               <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-extrabold flex items-center gap-1 w-fit">
                 <UserPlus className="w-3.5 h-3.5" />
                 {t('saas_register_badge')}
               </span>
               <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-3 mb-1">
                 {t('saas_register_heading')}
               </h2>
               <p className="text-xs text-zinc-400 leading-relaxed">
                 {t('saas_register_desc')}
               </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                     <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                     {t('saas_register_company_name')} <span className="text-red-500">*</span>
                   </label>
                  <input
                    type="text"
                    required
                    value={form.name_vi}
                    onChange={(e) => update("name_vi", e.target.value)}
                    placeholder={isEn ? "Công ty TNHH ABC" : "Công ty TNHH ABC"}
                    className={`bg-zinc-950 border ${errors.name_vi ? "border-red-500" : "border-zinc-800"} rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-600`}
                  />
                  {errors.name_vi && <span className="text-[10px] text-red-400">{errors.name_vi}</span>}
                </div>
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                     {t('saas_register_tax_code')} <span className="text-red-500">*</span>
                   </label>
                  <input
                    type="text"
                    required
                    value={form.tax_code}
                    onChange={(e) => update("tax_code", e.target.value)}
                    placeholder="0312345678"
                    className={`bg-zinc-950 border ${errors.tax_code ? "border-red-500" : "border-zinc-800"} rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-600`}
                  />
                  {errors.tax_code && <span className="text-[10px] text-red-400">{errors.tax_code}</span>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                     <Mail className="w-3.5 h-3.5 text-emerald-400" />
                     {t('saas_register_company_email')}
                   </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="info@company.vn"
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-600"
                  />
                </div>
                <div className="flex flex-col gap-1">
                   <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                     <Phone className="w-3.5 h-3.5 text-emerald-400" />
                     {t('saas_register_company_phone')}
                   </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="028.7300.9999"
                    className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-600"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                 <label className="text-xs font-bold text-zinc-300">{t('saas_register_address')}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder={isEn ? "123 Nguyen Van Linh, District 7, HCMC" : "123 Nguyễn Văn Linh, Q.7, TP.HCM"}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-zinc-100 placeholder-zinc-600"
                />
              </div>

              {/* Owner / Admin Info */}
              <div className="border-t border-zinc-800 pt-4 mt-2">
                 <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                   {t('saas_register_admin_section')}
                 </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                     <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                       <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                       {t('saas_register_admin_name')} <span className="text-red-500">*</span>
                     </label>
                    <input
                      type="text"
                      required
                      value={form.owner_name}
                      onChange={(e) => update("owner_name", e.target.value)}
                      className={`bg-zinc-950 border ${errors.owner_name ? "border-red-500" : "border-zinc-800"} rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-zinc-100 placeholder-zinc-600`}
                    />
                    {errors.owner_name && <span className="text-[10px] text-red-400">{errors.owner_name}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                       <Mail className="w-3.5 h-3.5 text-amber-400" />
                       {t('saas_register_admin_email')} <span className="text-red-500">*</span>
                     </label>
                    <input
                      type="email"
                      required
                      value={form.owner_email}
                      onChange={(e) => update("owner_email", e.target.value)}
                      className={`bg-zinc-950 border ${errors.owner_email ? "border-red-500" : "border-zinc-800"} rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-zinc-100 placeholder-zinc-600`}
                    />
                    {errors.owner_email && <span className="text-[10px] text-red-400">{errors.owner_email}</span>}
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-1">
                     <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                       <Lock className="w-3.5 h-3.5 text-amber-400" />
                       {t('saas_register_admin_password')} <span className="text-red-500">*</span>
                     </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={form.owner_password}
                      onChange={(e) => update("owner_password", e.target.value)}
                       placeholder={t('saas_register_admin_password_placeholder')}
                      className={`w-full bg-zinc-950 border ${errors.owner_password ? "border-red-500" : "border-zinc-800"} rounded-xl pl-3 pr-10 py-2.5 text-xs focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-zinc-100 placeholder-zinc-600`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer">
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {errors.owner_password && <span className="text-[10px] text-red-400">{errors.owner_password}</span>}
                </div>
              </div>

              {/* Plan Selection */}
              <div className="border-t border-zinc-800 pt-4 mt-2">
                 <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                   {t('saas_register_plan_title')}
                 </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.value}
                      type="button"
                      onClick={() => update("plan_type", plan.value)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${form.plan_type === plan.value ? plan.color + " ring-1 ring-white/20" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"}`}
                    >
                       <div className="text-[10px] font-extrabold text-zinc-300 uppercase">{t(plan.labelKey)}</div>
                      <div className="text-xs font-bold text-white mt-1">{plan.price}</div>
                      {form.plan_type === plan.value && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-2" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleSubmitting}
                className="w-full bg-white hover:bg-gray-100 disabled:bg-zinc-800 disabled:text-zinc-500 text-gray-900 font-bold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-all border border-zinc-300 dark:border-zinc-700 cursor-pointer"
              >
                {googleSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('saas_register_google_connecting')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t('saas_register_google')}
                  </>
                )}
              </button>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-extrabold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 mt-4 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('saas_register_submitting')}
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    {t('saas_register_submit')}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Info */}
          <div className="lg:col-span-2 bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                  {t('saas_register_what_you_get')}
                </h3>
              </div>
              <ul className="space-y-3 text-xs text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {t('saas_register_benefit_1')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {t('saas_register_benefit_2')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {t('saas_register_benefit_3')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {t('saas_register_benefit_4')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {t('saas_register_benefit_5')}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {t('saas_register_benefit_6')}
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800/60">
               <p className="text-[11px] text-zinc-500 leading-relaxed">
                 {t('saas_register_terms')}
               </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

