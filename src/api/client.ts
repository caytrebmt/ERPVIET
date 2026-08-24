import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { storage } from "../utils/storage";
import i18n from "../i18n";

// Since frontend and backend run on the same Origin in AI Studio (Port 3000), 
// we use a relative base URL or fall back to window.location.origin
const client = axios.create({
  baseURL: "",
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor for sending access token and guest cart session ID
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // SaaS endpoints require the ERP JWT token; shop endpoints use the shop access token.
    // Fall back to whichever token is available so mixed-origin calls still authenticate.
    const erpToken = storage.getErpToken();
    const shopToken = storage.getAccessToken();
    const isSaasApi = config.url?.startsWith('/api/saas/');
    const isSaasScreen = typeof window !== 'undefined' && window.location.pathname.startsWith('/saas');
    const isErpScopedShopApi = isSaasScreen && config.url?.startsWith('/api/shop/');
    const token = isSaasApi || isErpScopedShopApi ? (erpToken || shopToken) : (shopToken || erpToken);

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Resolve the storefront tenant on every shop request. This keeps a
    // tenant-specific WebShop isolated even when the user changes route or
    // opens the URL in a new tab.
    if (!isSaasApi && typeof window !== 'undefined' && !window.location.pathname.startsWith('/saas')) {
      const pathMatch = window.location.pathname.match(/^\/shop\/([^/]+)/i);
      const queryTenant = new URLSearchParams(window.location.search).get('tenant');
      const storedTenant = localStorage.getItem('shop_tenant');
      let storedSlug = '';
      if (storedTenant) {
        try {
          storedSlug = String(JSON.parse(storedTenant)?.slug || '');
        } catch {
          storedSlug = '';
        }
      }
      const tenantSlug = (pathMatch?.[1] || queryTenant || storedSlug || '').trim();
      if (tenantSlug && tenantSlug !== 'default') {
        config.headers['x-tenant-slug'] = tenantSlug;
      }
    }

    // Always inject the guest cart session ID so the server can track guest carts
    const guestCartId = storage.getGuestCartId();
    if (guestCartId) {
      config.headers["x-cart-session-id"] = guestCartId;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

// Response Interceptor for token automatic refresh (401 error handler)
client.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (!error.response) {
      return Promise.reject(error);
    }

    // Handled 401 Unauthorized
    if (error.response.status === 401 && !originalRequest._retry) {
      const refreshToken = storage.getRefreshToken();
      
      // If we don't have a refresh token or this was already a retry, fail
      if (!refreshToken || originalRequest.url?.includes("/api/shop/auth/refresh")) {
        storage.clearAllAuth();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return client(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Run refresh request
        const res = await axios.post(
          "/api/shop/auth/refresh",
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`
            },
          }
        );

        if (res.data && res.data.ok && res.data.data.access_token) {
          const newAccessToken = res.data.data.access_token;
          storage.setAccessToken(newAccessToken);
          
          processQueue(null, newAccessToken);
          isRefreshing = false;

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return client(originalRequest);
        } else {
          throw new Error(i18n.t("api_refresh_token_error"));
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        storage.clearAllAuth();
        // Redirect to login or dispatch clean logout
        window.dispatchEvent(new Event("unauthorized_logout"));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
