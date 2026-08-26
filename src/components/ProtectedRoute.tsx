import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-900"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Keep the tenant context: a customer of /shop/<slug> must sign in on
    // THAT tenant's login page, not on the default storefront's one.
    const tenantMatch = location.pathname.match(/^\/shop\/([^/]+)/i);
    const loginPath = tenantMatch ? `/shop/${tenantMatch[1]}/login` : "/login";
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
