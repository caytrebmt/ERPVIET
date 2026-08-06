import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import client from "../api/client";
import { Cart, CartItem } from "../types";
import { useToast } from "./ToastContext";
import { useAuth } from "./AuthContext";

interface CartContextType {
  cart: Cart | null;
  loading: boolean;
  fetchCart: () => Promise<void>;
  addToCart: (product_id: number, quantity?: number) => Promise<boolean>;
  updateQuantity: (item_id: number, quantity: number) => Promise<boolean>;
  removeFromCart: (item_id: number) => Promise<boolean>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const { showToast } = useToast();
  const { user } = useAuth();

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res = await client.get("/api/shop/cart");
      if (res.data && res.data.ok) {
        setCart(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi tải giỏ hàng", err);
    } finally {
      setLoading(false);
    }
  };

  // Automatically fetch cart on component mount and when user logs in/out
  useEffect(() => {
    // The ERP routes never render the storefront cart. Avoid a needless API
    // request (and database work) on every SaaS page load.
    if (window.location.pathname.startsWith('/saas')) {
      setLoading(false);
      return;
    }
    fetchCart();
  }, [user]);

  const addToCart = async (product_id: number, quantity: number = 1) => {
    try {
      const res = await client.post("/api/shop/cart/items", { product_id, quantity });
      if (res.data && res.data.ok) {
        setCart(res.data.data);
        showToast("Đã thêm sản phẩm vào giỏ hàng!", "success");
        return true;
      }
      showToast(res.data.message || "Không thể thêm sản phẩm", "error");
      return false;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Lỗi khi thêm vào giỏ hàng.";
      showToast(msg, "error");
      return false;
    }
  };

  const updateQuantity = async (item_id: number, quantity: number) => {
    try {
      const res = await client.put(`/api/shop/cart/items/${item_id}`, { quantity });
      if (res.data && res.data.ok) {
        setCart(res.data.data);
        showToast("Đã cập nhật số lượng thành công!", "success");
        return true;
      }
      showToast(res.data.message || "Cập nhật số lượng thất bại", "error");
      return false;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Lỗi khi cập nhật số lượng.";
      showToast(msg, "error");
      return false;
    }
  };

  const removeFromCart = async (item_id: number) => {
    try {
      const res = await client.delete(`/api/shop/cart/items/${item_id}`);
      if (res.data && res.data.ok) {
        setCart(res.data.data);
        showToast("Đã xóa sản phẩm khỏi giỏ hàng", "info");
        return true;
      }
      return false;
    } catch (err: any) {
      showToast("Lỗi khi xóa sản phẩm.", "error");
      return false;
    }
  };

  const clearCart = async () => {
    try {
      const res = await client.delete("/api/shop/cart");
      if (res.data && res.data.ok) {
        setCart(res.data.data);
      }
    } catch (err) {
      console.error("Lỗi khi xóa giỏ hàng", err);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        fetchCart,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
