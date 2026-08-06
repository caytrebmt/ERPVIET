const ACCESS_TOKEN_KEY = "erp_shop_access_token";
const REFRESH_TOKEN_KEY = "erp_shop_refresh_token";
const USER_KEY = "erp_shop_current_user";
const GUEST_CART_ID_KEY = "erp_shop_guest_cart_id";

const ERP_ACCESS_TOKEN_KEY = "erp_saas_access_token";
const ERP_USER_KEY = "erp_saas_user";

export const storage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  setAccessToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  },
  removeAccessToken(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  setRefreshToken(token: string): void {
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },
  removeRefreshToken(): void {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  getUser(): any | null {
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
  setUser(user: any): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  removeUser(): void {
    localStorage.removeItem(USER_KEY);
  },

  // ERP SaaS Auth Storage
  getErpToken(): string | null {
    return localStorage.getItem(ERP_ACCESS_TOKEN_KEY);
  },
  setErpToken(token: string): void {
    localStorage.setItem(ERP_ACCESS_TOKEN_KEY, token);
  },
  removeErpToken(): void {
    localStorage.removeItem(ERP_ACCESS_TOKEN_KEY);
  },

  getErpUser(): any | null {
    const userStr = localStorage.getItem(ERP_USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },
  setErpUser(user: any): void {
    localStorage.setItem(ERP_USER_KEY, JSON.stringify(user));
  },
  removeErpUser(): void {
    localStorage.removeItem(ERP_USER_KEY);
  },

  clearErpAuth(): void {
    localStorage.removeItem(ERP_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ERP_USER_KEY);
  },

  getGuestCartId(): string {
    let id = localStorage.getItem(GUEST_CART_ID_KEY);
    if (!id) {
      id = "cart_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem(GUEST_CART_ID_KEY, id);
    }
    return id;
  },

  clearAllAuth(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

