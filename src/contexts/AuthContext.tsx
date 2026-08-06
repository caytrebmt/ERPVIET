import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import client from "../api/client";
import { storage } from "../utils/storage";
import { Customer } from "../types";

interface AuthContextType {
  user: Customer | null;
  setUser: (user: Customer | null) => void;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string }>;
  register: (data: any) => Promise<{ ok: boolean; message: string }>;
  logout: () => void;
  updateProfile: (name: string, phone: string) => Promise<{ ok: boolean; message: string }>;
  changePassword: (data: any) => Promise<{ ok: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Customer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Load profile on startup if token exists
  useEffect(() => {
    async function loadProfile() {
      const token = storage.getAccessToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await client.get("/api/shop/customer/profile");
        if (response.data && response.data.ok) {
          setUser(response.data.data);
          storage.setUser(response.data.data);
        }
      } catch (err) {
        console.error("Failed to load customer profile", err);
        // Clear auth since token is invalid
        storage.clearAllAuth();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    // Listen to global logout event from axial client (401 failures)
    const handleUnauthorizedLogout = () => {
      logout();
    };

    window.addEventListener("unauthorized_logout", handleUnauthorizedLogout);
    return () => {
      window.removeEventListener("unauthorized_logout", handleUnauthorizedLogout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await client.post("/api/shop/auth/login", { email, password });
      if (res.data && res.data.ok) {
        const { access_token, refresh_token, customer } = res.data.data;
        storage.setAccessToken(access_token);
        storage.setRefreshToken(refresh_token);
        storage.setUser(customer);
        setUser(customer);
        return { ok: true, message: res.data.message || "Đăng nhập thành công" };
      }
      return { ok: false, message: res.data.message || "Đăng nhập thất bại" };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại.";
      return { ok: false, message: errMsg };
    }
  };

  const register = async (data: any) => {
    try {
      const res = await client.post("/api/shop/auth/register", data);
      if (res.data && res.data.ok) {
        const { access_token, refresh_token, customer } = res.data.data;
        storage.setAccessToken(access_token);
        storage.setRefreshToken(refresh_token);
        storage.setUser(customer);
        setUser(customer);
        return { ok: true, message: res.data.message || "Đăng ký thành công" };
      }
      return { ok: false, message: res.data.message || "Đăng ký thất bại" };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || "Đăng ký thất bại. Vui lòng thử lại.";
      return { ok: false, message: errMsg };
    }
  };

  const logout = () => {
    storage.clearAllAuth();
    setUser(null);
  };

  const updateProfile = async (name: string, phone: string) => {
    try {
      const res = await client.put("/api/shop/customer/profile", { name, phone });
      if (res.data && res.data.ok) {
        const updatedUser = res.data.data;
        storage.setUser(updatedUser);
        setUser(updatedUser);
        return { ok: true, message: "Cập nhật thông tin thành công!" };
      }
      return { ok: false, message: res.data.message || "Cập nhật thất bại" };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || "Cập nhật thông tin thất bại.";
      return { ok: false, message: errMsg };
    }
  };

  const changePassword = async (data: any) => {
    try {
      const res = await client.put("/api/shop/customer/password", data);
      if (res.data && res.data.ok) {
        return { ok: true, message: "Đổi mật khẩu thành công!" };
      }
      return { ok: false, message: res.data.message || "Đổi mật khẩu thất bại" };
    } catch (error: any) {
      const errMsg = error.response?.data?.message || "Mật khẩu hiện tại không chính xác hoặc dữ liệu không hợp lệ.";
      return { ok: false, message: errMsg };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
