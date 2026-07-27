import axios from 'axios';
import { useAuthStore } from '../stores/auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vet_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const path = window.location.pathname;
    const isClientArea = path.startsWith('/cliente');
    const isStaffArea =
      path.startsWith('/admin') ||
      path.startsWith('/recepcion') ||
      path.startsWith('/veterinario');

    if (status === 401 || (status === 403 && isStaffArea)) {
      try {
        const authStore = useAuthStore();
        authStore.logout();
      } catch {
        localStorage.removeItem('vet_token');
        localStorage.removeItem('vet_user');
      }

      const loginPath = isClientArea ? '/cliente/login' : '/personal/login';
      if (path !== loginPath) {
        window.location.assign(loginPath);
      }
    }
    return Promise.reject(error);
  }
);
