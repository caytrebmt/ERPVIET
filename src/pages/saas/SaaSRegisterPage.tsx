import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, UserPlus, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";

export const SaaSRegisterPage: React.FC = () => {
  const { showToast } = useToast();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
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
    if (!form.name_vi.trim()) errs.name_vi = "Tên doanh nghiệp là bắt buộc";
    if (!form.tax_code.trim()) errs.tax_code = "Mã số thuế là bắt buộc";
    if (!form.owner_email.trim()) errs.owner_email = "Email quản lý là bắt buộc";
    if (!form.owner_password || form.owner_password.length < 6) errs.owner_password = "Mật khẩu tối thiểu 6 ký tự";
    if (!form.owner_name.trim()) errs.owner_name = "Tên người quản lý là bắt buộc";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast("Vui lòng kiểm tra lại thông tin", "error");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/saas/tenants/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || "Đăng ký thành công!", "success");
        if (data.data?.token) {
          localStorage.setItem("erp_saas_access_token", data.data.token);
        }
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast(data.message || "Đăng ký thất bại", "error");
        setSubmitting(false);
      }
    } catch {
      showToast("Lỗi kết nối server", "error");
      setSubmitting(false);
    }
  };

  const isEn = language === "en";

  const plans = [
    { value: "trial", labelVi: "Dùng thử 14 ngày", labelEn: "14-Day Free Trial", price: "0₫", color: "border-zinc-700 bg-zinc-900" },
    { value: "starter", labelVi: "Starter", labelEn: "Starter", price: "499K/tháng", color: "border-indigo-500/30 bg-indigo-500/5" },
    { value: "professional", labelVi: "Professional", labelEn: "Professional", price: "1.2TR/tháng", color: "border-amber-500/30 bg-amber-500/5" },
    { value: "enterprise", labelVi: "Enterprise", labelEn: "Enterprise", price: "Liên hệ", color: "border-emerald-500/30 bg-emerald-500/5" },
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
            <span className="text-[10px] text-amber-400 font-semibold">{isEn ? "Enterprise SaaS Platform" : "Nền tảng ERP Doanh nghiệp"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={toggleLanguage} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer">
            <span className="uppercase">{language}</span>
          </button>
          <Link to="/saas/login" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer">
            {isEn ? "Already have account?" : "Đã có tài khoản?"}
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
                {isEn ? "TRIAL / SIGN UP" : "ĐĂNG KÝ DÙNG THỬ"}
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-3 mb-1">
                {isEn ? "Register your company" : "Đăng ký doanh nghiệp"}
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {isEn
                  ? "Create your ERP workspace. Get a 14-day free trial with full features."
                  : "Tạo không gian làm việc ERP cho doanh nghiệp. Dùng thử 14 ngày miễn phí toàn bộ tính năng."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Company Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    {isEn ? "Company Name" : "Tên doanh nghiệp"} <span className="text-red-500">*</span>
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
                    {isEn ? "Tax Code" : "Mã số thuế"} <span className="text-red-500">*</span>
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
                    {isEn ? "Company Email" : "Email công ty"}
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
                    {isEn ? "Company Phone" : "Số điện thoại"}
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
                <label className="text-xs font-bold text-zinc-300">{isEn ? "Address" : "Địa chỉ trụ sở"}</label>
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
                  {isEn ? "ADMINISTRATOR ACCOUNT" : "TÀI KHOẢN QUẢN TRỊ VIÊN"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                      {isEn ? "Admin Full Name" : "Họ tên quản lý"} <span className="text-red-500">*</span>
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
                      {isEn ? "Admin Email" : "Email quản lý"} <span className="text-red-500">*</span>
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
                    {isEn ? "Admin Password" : "Mật khẩu quản lý"} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={form.owner_password}
                      onChange={(e) => update("owner_password", e.target.value)}
                      placeholder={isEn ? "Min 6 characters" : "Tối thiểu 6 ký tự"}
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
                  {isEn ? "CHOOSE PLAN" : "CHỌN GÓI DỊCH VỤ"}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {plans.map((plan) => (
                    <button
                      key={plan.value}
                      type="button"
                      onClick={() => update("plan_type", plan.value)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${form.plan_type === plan.value ? plan.color + " ring-1 ring-white/20" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"}`}
                    >
                      <div className="text-[10px] font-extrabold text-zinc-300 uppercase">{isEn ? plan.labelEn : plan.labelVi}</div>
                      <div className="text-xs font-bold text-white mt-1">{plan.price}</div>
                      {form.plan_type === plan.value && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-2" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-extrabold rounded-xl py-3.5 text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20 mt-4 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isEn ? "Creating workspace..." : "Đang khởi tạo..."}
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    {isEn ? "Create Workspace" : "Tạo không gian làm việc"}
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
                  {isEn ? "WHAT YOU GET" : "BẠN NHẬN ĐƯỢC GÌ"}
                </h3>
              </div>
              <ul className="space-y-3 text-xs text-zinc-300">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {isEn ? "Full ERP module access (Inventory, Sales, Accounting, CRM, Purchasing)" : "Toàn bộ module ERP (Kho, Bán hàng, Kế toán, CRM, Mua hàng)"}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {isEn ? "Multi-user & role-based permissions (RBAC)" : "Đa người dùng & phân quyền RBAC"}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {isEn ? "Multi-branch & multi-warehouse support" : "Hỗ trợ đa chi nhánh & đa kho"}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {isEn ? "Vietnamese accounting standards (TT200) & VAT filing" : "Chuẩn kế toán Việt Nam (TT200) & kê khai thuế GTGT"}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {isEn ? "WebShop storefront for each tenant" : "Cửa hàng WebShop riêng cho từng doanh nghiệp"}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  {isEn ? "Complete data isolation between companies" : "Cách ly dữ liệu hoàn toàn giữa các công ty"}
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800/60">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {isEn
                  ? "By registering, you agree to our Terms of Service and Privacy Policy. Your data is securely stored and isolated per tenant."
                  : "Bằng cách đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật. Dữ liệu được lưu trữ an toàn và cách ly theo từng doanh nghiệp."}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

