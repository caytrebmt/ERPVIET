import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useSaaSAuth } from "../contexts/SaaSAuthContext";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";

interface SaaSProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const SaaSProtectedRoute: React.FC<SaaSProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isErpAuthenticated, erpLoading, erpUser, hasRole } = useSaaSAuth();
  const location = useLocation();

  if (erpLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-amber-500">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
          <p className="text-xs font-semibold text-zinc-400">Đang kiểm tra quyền truy cập hệ thống ERP-VIỆT...</p>
        </div>
      </div>
    );
  }

  if (!isErpAuthenticated) {
    return <Navigate to="/saas/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !hasRole(allowedRoles)) {
    return (
      <div className="min-h-[75vh] flex flex-col items-center justify-center p-6 text-center bg-zinc-900/50 rounded-2xl border border-zinc-800 my-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">
          403 - Không Có Quyền Truy Cập Phân Hệ
        </h2>
        <p className="text-xs text-zinc-400 max-w-md mb-2">
          Tài khoản của bạn <strong className="text-amber-400">{erpUser?.full_name}</strong> ({erpUser?.role_name_vi}) không được cấp quyền truy cập tính năng này.
        </p>
        <p className="text-[11px] text-zinc-500 max-w-sm mb-6">
          Các vai trò có quyền: <span className="text-zinc-300 font-mono">{allowedRoles.join(", ")}</span>
        </p>
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại trang trước</span>
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export default SaaSProtectedRoute;
