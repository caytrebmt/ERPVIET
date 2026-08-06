import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { storage } from "../utils/storage";

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
    const accessToken = storage.getAccessToken();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
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
          throw new Error("Không thể refresh token");
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
