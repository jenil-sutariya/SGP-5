import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      try {
        refreshing =
          refreshing ??
          api
            .post('/auth/refresh', { refreshToken })
            .then((r) => {
              const { accessToken, refreshToken: next } = r.data.data;
              setTokens(accessToken, next);
              return accessToken as string;
            })
            .catch(() => {
              logout();
              return null;
            })
            .finally(() => {
              refreshing = null;
            });
        const token = await refreshing;
        if (!token) return Promise.reject(error);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        logout();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
