import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus, User, Mail, Phone, Lock, Loader2, ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useShopTenant } from "../contexts/ShopTenantContext";
import { useToast } from "../contexts/ToastContext";
import { useTranslation } from "react-i18next";

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { register, isAuthenticated, loading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { shopPath } = useShopTenant();

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(shopPath("/"), { replace: true });
    }
  }, [isAuthenticated, loading, navigate, shopPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !phone.trim() || !password || !confirmPassword) {
      showToast(t("page_register_all_fields_required"), "error");
      return;
    }

    if (password.length < 8) {
      showToast(t("page_register_password_min_length"), "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast(t("page_register_password_mismatch"), "error");
      return;
    }

    try {
      setSubmitting(true);
      const result = await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        confirm_password: confirmPassword,
        confirmPassword: confirmPassword,
      });

      if (result.ok) {
        showToast(result.message, "success");
        navigate(shopPath("/"));
      } else {
        showToast(result.message, "error");
      }
    } catch (err) {
      showToast(t("page_register_failed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const isPasswordMismatch = Boolean(confirmPassword && password !== confirmPassword);

  return (
    <div className="max-w-md w-full mx-auto my-auto flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col gap-5 transition-colors duration-200">
        {/* Header Title */}
        <div className="text-center flex flex-col items-center gap-1">
          <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center">
            WebShop <span className="text-indigo-850 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/40 px-2 py-0.5 rounded-md ml-1 text-xs font-semibold uppercase"></span>
          </span>
          <h2 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mt-1">Đăng ký tài khoản mới</h2>
        </div>

        {/* Register form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> Họ và tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> Địa chỉ Email <span className="text-red-500">*</span>
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
              <Phone className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> Số điện thoại <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              placeholder="Ví dụ: 0909123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> Mật khẩu <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Tối thiểu 8 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full bg-gray-50 dark:bg-gray-850 border ${
                    isPasswordMismatch
                      ? "border-red-400 dark:border-red-600 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500"
                  } rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-450" /> Xác nhận <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Xác nhận mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-gray-50 dark:bg-gray-850 border ${
                    isPasswordMismatch
                      ? "border-red-400 dark:border-red-600 focus:ring-red-500"
                      : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500"
                  } rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                  title={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Inline password mismatch message */}
          {isPasswordMismatch && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg p-2.5 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>Mật khẩu và xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-150 disabled:text-gray-400 font-bold rounded-xl py-3 text-xs flex items-center justify-center gap-2 transition-all shadow-xs mt-3 cursor-pointer"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang khởi tạo...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Đăng ký tài khoản
              </>
            )}
          </button>
        </form>

        {/* Footer links */}
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 m-0">
            Đã sẵn có tài khoản?{" "}
            <Link to={shopPath("/login")} className="font-bold text-indigo-600 dark:text-indigo-450 hover:underline inline-flex items-center gap-0.5">
              Đăng nhập <ArrowLeft className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
export {};
