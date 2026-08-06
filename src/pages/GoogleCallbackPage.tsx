import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { storage } from "../utils/storage";

const GoogleCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      showToast("Đăng nhập Google bị huỷ hoặc thất bại.", "error");
      navigate("/login", { replace: true });
      return;
    }

    if (!code) {
      showToast("Thiếu mã xác thực từ Google.", "error");
      navigate("/login", { replace: true });
      return;
    }

    (async () => {
      try {
        const res = await fetch("/api/shop/auth/google/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json();
        if (data.ok && data.data) {
          const { access_token, refresh_token, customer } = data.data;
          storage.setAccessToken(access_token);
          storage.setRefreshToken(refresh_token);
          storage.setUser(customer);
          setUser(customer);
          showToast(data.message || "Đăng nhập Google thành công!", "success");
          navigate("/", { replace: true });
        } else {
          showToast(data.message || "Đăng nhập Google thất bại.", "error");
          navigate("/login", { replace: true });
        }
      } catch (e) {
        showToast("Lỗi kết nối máy chủ.", "error");
        navigate("/login", { replace: true });
      }
    })();
  }, [searchParams, navigate, setUser, showToast]);

  return (
    <div className="max-w-md w-full mx-auto my-auto flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 sm:p-8 shadow-xs flex flex-col gap-4 items-center justify-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">Đang xử lý đăng nhập Google...</p>
      </div>
    </div>
  );
};

export default GoogleCallbackPage;
export {};
