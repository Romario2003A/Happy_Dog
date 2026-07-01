import axios from 'axios';
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api' });
api.interceptors.request.use(config => { const token = localStorage.getItem('vet_token'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
api.interceptors.response.use(r=>r, e=>{
  if([401,403].includes(e.response?.status)){
    localStorage.removeItem('vet_token');
    localStorage.removeItem('vet_user');
    const loginPath=window.location.pathname.startsWith('/cliente') ? '/cliente/login' : '/personal/login';
    if(window.location.pathname!==loginPath) window.location.assign(loginPath);
  }
  return Promise.reject(e);
});
