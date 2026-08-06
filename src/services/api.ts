import axios from 'axios';

// Create Axios instance for ERP SaaS Backend
const api = axios.create({
  baseURL: ((import.meta as any).env?.VITE_API_BASE_URL) || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: Automatically attach JWT token from user's storage
api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      sessionStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle common HTTP status errors (e.g. 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear invalid credentials
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
      sessionStorage.removeItem('token');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('unauthorized_logout'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
