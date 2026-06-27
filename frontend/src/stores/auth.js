import { defineStore } from 'pinia';
import { api } from '../services/api';

export const useAuthStore = defineStore('auth',{
  state:()=>({ token:localStorage.getItem('vet_token'), user: JSON.parse(localStorage.getItem('vet_user') || 'null') }),
  getters:{ isAuthenticated:s=>!!s.token, role:s=>s.user?.role },
  actions:{
    setSession(data){
      this.token=data.accessToken;
      this.user=data.user;
      localStorage.setItem('vet_token',data.accessToken);
      localStorage.setItem('vet_user',JSON.stringify(data.user));
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
      localStorage.removeItem('vet_token');
      localStorage.removeItem('vet_user');
    }
  }
});
