import { defineStore } from 'pinia';
import { api } from '../services/api';

const legacyToken = localStorage.getItem('vet_token');
const legacyUser = localStorage.getItem('vet_user');
if (legacyToken && !sessionStorage.getItem('vet_token')) sessionStorage.setItem('vet_token', legacyToken);
if (legacyUser && !sessionStorage.getItem('vet_user')) sessionStorage.setItem('vet_user', legacyUser);
localStorage.removeItem('vet_token');
localStorage.removeItem('vet_user');

export const useAuthStore = defineStore('auth',{
  state:()=>({ token:sessionStorage.getItem('vet_token'), user: JSON.parse(sessionStorage.getItem('vet_user') || 'null') }),
  getters:{ isAuthenticated:s=>!!s.token, role:s=>s.user?.role },
  actions:{
    setSession(data){
      this.token=data.accessToken;
      this.user=data.user;
      sessionStorage.setItem('vet_token',data.accessToken);
      sessionStorage.setItem('vet_user',JSON.stringify(data.user));
      return data.user;
    },
    async login(email,password){
      const {data}=await api.post('/auth/login',{email,password});
      return this.setSession(data);
    },
    async clientLogin(email,password){
      const {data}=await api.post('/auth/client/login',{email,password});
      return this.setSession(data);
    },
    async registerClient(payload){
      const {data}=await api.post('/auth/client/register',payload);
      return this.setSession(data);
    },
    async changePassword(payload){
      const {data}=await api.post('/auth/change-password',payload);
      return data;
    },
    logout(){
      this.token=null;
      this.user=null;
      sessionStorage.removeItem('vet_token');
      sessionStorage.removeItem('vet_user');
    }
  }
});
