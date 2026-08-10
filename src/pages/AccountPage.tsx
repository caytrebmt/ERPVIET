import React, { useState } from "react";
import { Link } from "react-router-dom";
import { User, Phone, Mail, KeyRound, Loader2, Package, LogOut, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { useTranslation } from "react-i18next";

const AccountPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { showToast } = useToast();

  // Profile Form State
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [updatingProfile, setUpdatingProfile] = useState(false);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      showToast(t("page_account_name_phone_required"), "error");
      return;
    }

    try {
      setUpdatingProfile(true);
      const res = await updateProfile(name.trim(), phone.trim());
      if (res.ok) {
        showToast(res.message, "success");
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      showToast(t("page_account_update_error"), "error");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast(t("page_account_password_required"), "error");
      return;
    }

    if (newPassword.length < 8) {
      showToast(t("page_account_password_min_length"), "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast(t("page_account_password_mismatch"), "error");
      return;
    }

    try {
      setUpdatingPassword(true);
      const res = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (res.ok) {
        showToast(res.message, "success");
        // Reset states
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        showToast(res.message, "error");
      }
    } catch (err) {
      showToast(t("page_account_password_change_failed"), "error");
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b border-gray-150 dark:border-gray-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-850 dark:text-white uppercase">HỒ SƠ CỦA BẠN</h1>
        
        {/* Quick action shortcuts */}
        <div className="flex gap-2">
          <Link
            to="/orders"
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-600 dark:hover:border-indigo-400 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Package className="w-4 h-4 text-indigo-600" /> Lịch sử đơn hàng
          </Link>
          <button
            onClick={logout}
            className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" /> Đăng xuất
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Profile Card details update */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <form onSubmit={handleUpdateProfile} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-2.5 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4.5 h-4.5 text-indigo-600" /> THÔNG TIN TÀI KHOẢN
            </h3>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-gray-600 dark:text-gray-400">Địa chỉ Email (Không được đổi)</label>
              <div className="bg-gray-100/70 dark:bg-gray-800/70 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                <span>{user?.email}</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-gray-600 dark:text-gray-400">Họ và tên</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Nguyễn Văn A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 w-full text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-gray-600 dark:text-gray-400">Số điện thoại</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  placeholder="0909123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-10 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 w-full text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={updatingProfile}
              className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs mt-2 cursor-pointer w-full md:w-auto md:px-6 md:self-start"
            >
              {updatingProfile ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Cập nhật hồ sơ
                </>
              )}
            </button>
          </form>
        </div>

        {/* Password updating panel */}
        <div className="lg:col-span-6 flex flex-col gap-6">
          <form onSubmit={handleChangePassword} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs flex flex-col gap-4 transition-colors duration-200">
            <h3 className="font-bold text-gray-900 dark:text-white text-xs border-b border-gray-100 dark:border-gray-800 pb-2.5 uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-4.5 h-4.5 text-indigo-600" /> ĐỔI MẬT KHẨU BẢO MẬT
            </h3>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-gray-600 dark:text-gray-400">Mật khẩu hiện tại</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  required
                  placeholder="Nhập mật khẩu đang dùng"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                  title={showCurrentPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-gray-600 dark:text-gray-400">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  required
                  placeholder="Tối thiểu 8 ký tự"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 cursor-pointer"
                  title={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-xs">
              <label className="font-semibold text-gray-600 dark:text-gray-400">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-gray-850 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-9 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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

            <button
              type="submit"
              disabled={updatingPassword}
              className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 font-bold rounded-xl py-2.5 text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs mt-2 cursor-pointer w-full md:w-auto md:px-6 md:self-start"
            >
              {updatingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Changing...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4" /> Thay đổi mật khẩu
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
export {};
