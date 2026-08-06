import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Building2, Lock, User, ShieldCheck, ArrowRight, Eye, EyeOff, Globe, Sparkles, ShoppingBag } from "lucide-react";
import { useSaaSAuth } from "../../contexts/SaaSAuthContext";
import { useToast } from "../../contexts/ToastContext";
import { useLanguage } from "../../contexts/LanguageContext";

export const SaaSLoginPage: React.FC = () => {
  const { erpLogin } = useSaaSAuth();
  const { showToast } = useToast();
  const { language, toggleLanguage } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || "/saas/dashboard";
  const isEn = language === "en";

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      showToast("Vui lòng nhập tên đăng nhập và mật khẩu ERP", "error");
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

  const demoAccounts = [
    {
      title: "Quản Trị Viên (Admin)",
      username: "admin",
      password: "admin123",
      roleCode: "ADMIN",
      desc: "Toàn quyền hệ thống, cấu hình, dữ liệu & phân quyền",
      badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    },
    {
      title: "Kế Toán Trưởng",
      username: "accountant1",
      password: "accountant123",
      roleCode: "ACCOUNTANT",
      desc: "Hóa đơn, Công nợ, Kê khai thuế GTGT, Sổ cái TT200",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    {
      title: "Kinh Doanh (Sales)",
      username: "sales1",
      password: "sales123",
      roleCode: "SALES",
      desc: "Quản lý Báo giá, Đơn hàng WebShop & Khách hàng",
      badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    {
      title: "Thủ Kho (Warehouse)",
      username: "warehouse1",
      password: "warehouse123",
      roleCode: "WAREHOUSE",
      desc: "Nhập/Xuất kho, Địa điểm kho & Kiểm kê lệch kho",
      badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    {
      title: "Nhân Viên Mua Hàng",
      username: "purchasing1",
      password: "purchasing123",
      roleCode: "PURCHASING",
      desc: "Quản lý Nhà cung cấp, Yêu cầu mua hàng & Nhập kho",
      badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    },
  ];

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
              Hệ Thống Quản Trị Doanh Nghiệp ERP-VIET 
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span className="uppercase">{language}</span>
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-xs font-bold text-zinc-300 transition-all cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">WebShop Front</span>
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
                <span>CỔNG ĐĂNG NHẬP DÀNH CHO NHÂN VIÊN</span>
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
              Đăng Nhập Portal ERP
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed mb-6">
              Vui lòng sử dụng tài khoản cán bộ công nhân viên đã được phân quyền để truy cập vào hệ thống quản lý.
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Tên Đăng Nhập / Email ERP
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
                    placeholder="VD: admin, sales1, accountant1..."
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1.5">
                  Mật Khẩu Phân Quyền
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
                    placeholder="Nhập mật khẩu..."
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
                    defaultChecked
                    className="rounded bg-zinc-950 border-zinc-800 text-amber-500 focus:ring-0"
                  />
                  <span>Ghi nhớ phiên đăng nhập</span>
                </label>
                <span className="text-zinc-500 text-[11px]">Bảo mật JWT 256-bit</span>
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
                    <span>ĐĂNG NHẬP ERP SYSTEM</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/80 text-center">
            <p className="text-[11px] text-zinc-500">
              Mọi hoạt động được ghi lại trong nhật ký truy cập (System Audit Log)
            </p>
          </div>
        </div>

        {/* Right Demo Presets Section */}
        <div className="w-full lg:w-1/2 bg-zinc-900/50 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400">
                CHỌN TÀI KHOẢN MẪU ĐỂ TEST PHÂN QUYỀN RBAC
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Bấm trực tiếp vào các vai trò dưới đây để hệ thống tự động điền thông tin và đăng nhập kiểm tra ma trận phân quyền:
            </p>

            <div className="space-y-2.5">
              {demoAccounts.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => fillAndLogin(acc.username, acc.password)}
                  className="p-3 bg-zinc-950/80 hover:bg-zinc-800/80 border border-zinc-800 hover:border-amber-500/50 rounded-2xl transition-all cursor-pointer group flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-extrabold text-zinc-100 group-hover:text-amber-400 transition-colors">
                        {acc.title}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${acc.badgeClass}`}>
                        {acc.roleCode}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate leading-snug">
                      {acc.desc}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono font-semibold text-zinc-400 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800 block">
                      {acc.username}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-800/60 text-center">
            <Link
              to="/"
              className="text-xs font-semibold text-zinc-400 hover:text-amber-400 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Quay về trang bán hàng WebShop</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t border-zinc-900 text-center text-[11px] text-zinc-600 relative z-10">
        © 2026 ERP-VIET ENTERPRISE. Bản quyền được bảo hộ.
      </footer>
    </div>
  );
};
