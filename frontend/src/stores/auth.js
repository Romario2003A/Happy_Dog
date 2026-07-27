import { defineStore } from 'pinia';
import { api } from '../services/api';

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return true;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const { exp } = JSON.parse(jsonPayload);
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

function getValidInitialState() {
  const token = localStorage.getItem('vet_token');
  const user = JSON.parse(localStorage.getItem('vet_user') || 'null');
  if (token && isTokenExpired(token)) {
    localStorage.removeItem('vet_token');
    localStorage.removeItem('vet_user');
    return { token: null, user: null };
  }
  return { token, user };
}

export const useAuthStore = defineStore('auth', {
  state: () => getValidInitialState(),
  getters: {
    isAuthenticated: (s) => !!s.token && !isTokenExpired(s.token),
    role: (s) => s.user?.role,
  },
  actions: {
    setSession(data) {
      this.token = data.accessToken;
      this.user = data.user;
      localStorage.setItem('vet_token', data.accessToken);
      localStorage.setItem('vet_user', JSON.stringify(data.user));
      return data.user;
    },
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      return this.setSession(data);
    },
    async clientLogin(email, password) {
      const { data } = await api.post('/auth/client/login', { email, password });
      return this.setSession(data);
    },
    async registerClient(payload) {
      const { data } = await api.post('/auth/client/register', payload);
      return this.setSession(data);
    },
    async changePassword(payload) {
      const { data } = await api.post('/auth/change-password', payload);
      return data;
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('vet_token');
      localStorage.removeItem('vet_user');
    },
  },
});
