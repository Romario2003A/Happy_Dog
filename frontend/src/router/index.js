import { createRouter, createWebHistory } from 'vue-router';
import ClientPortal from '../modules/client/ClientPortal.vue';
import ClientLogin from '../modules/client/ClientLogin.vue';
import ClientDashboard from '../modules/client/ClientDashboard.vue';
import RoleLogin from '../modules/auth/RoleLogin.vue';
import AccountSettings from '../modules/account/AccountSettings.vue';
import AdminDashboard from '../modules/admin/AdminDashboard.vue';
import ReceptionDashboard from '../modules/reception/ReceptionDashboard.vue';
import VetDashboard from '../modules/veterinarian/VetDashboard.vue';
import { useAuthStore } from '../stores/auth';

const routes=[
 {path:'/', redirect:'/cliente'},
 {path:'/cliente', component:ClientPortal},
 {path:'/cliente/login', component:ClientLogin},
 {path:'/cliente/dashboard', component:ClientDashboard, meta:{requiresAuth:true, roles:['CLIENT'], loginPath:'/cliente/login'}},
 {path:'/recepcion/login', component:RoleLogin, meta:{role:'RECEPTIONIST', title:'Recepcion'}},
 {path:'/veterinario/login', component:RoleLogin, meta:{role:'VETERINARIAN', title:'Doctor Veterinario'}},
 {path:'/admin/login', component:RoleLogin, meta:{role:'ADMIN', title:'Administracion'}},
 {path:'/recepcion', component:ReceptionDashboard, meta:{requiresAuth:true, roles:['RECEPTIONIST','ADMIN'], loginPath:'/recepcion/login'}},
 {path:'/recepcion/cuenta', component:AccountSettings, meta:{requiresAuth:true, roles:['RECEPTIONIST','ADMIN'], loginPath:'/recepcion/login'}},
 {path:'/veterinario', component:VetDashboard, meta:{requiresAuth:true, roles:['VETERINARIAN','ADMIN'], loginPath:'/veterinario/login'}},
 {path:'/veterinario/cuenta', component:AccountSettings, meta:{requiresAuth:true, roles:['VETERINARIAN','ADMIN'], loginPath:'/veterinario/login'}},
 {path:'/admin', component:AdminDashboard, meta:{requiresAuth:true, roles:['ADMIN'], loginPath:'/admin/login'}},
 {path:'/admin/cuenta', component:AccountSettings, meta:{requiresAuth:true, roles:['ADMIN'], loginPath:'/admin/login'}}
];

const router=createRouter({history:createWebHistory(),routes});

router.beforeEach((to)=>{
 const auth=useAuthStore();
 if(to.meta.requiresAuth && !auth.isAuthenticated) return to.meta.loginPath || '/recepcion/login';
 if(to.meta.roles && !to.meta.roles.includes(auth.role)) return to.meta.loginPath || '/cliente/login';
});

export default router;
