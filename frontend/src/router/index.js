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
 {path:'/personal/login', component:RoleLogin, meta:{title:'Acceso del personal'}},
 {path:'/recepcion/login', redirect:'/personal/login'},
 {path:'/veterinario/login', redirect:'/personal/login'},
 {path:'/admin/login', redirect:'/personal/login'},
 {path:'/recepcion', component:ReceptionDashboard, meta:{requiresAuth:true, roles:['RECEPTIONIST','ADMIN'], loginPath:'/personal/login'}},
 {path:'/recepcion/cuenta', component:AccountSettings, meta:{requiresAuth:true, roles:['RECEPTIONIST','ADMIN'], loginPath:'/personal/login'}},
 {path:'/veterinario', component:VetDashboard, meta:{requiresAuth:true, roles:['VETERINARIAN','ADMIN'], loginPath:'/personal/login'}},
 {path:'/veterinario/cuenta', component:AccountSettings, meta:{requiresAuth:true, roles:['VETERINARIAN','ADMIN'], loginPath:'/personal/login'}},
 {path:'/admin', component:AdminDashboard, meta:{requiresAuth:true, roles:['ADMIN'], loginPath:'/personal/login'}},
 {path:'/admin/cuenta', component:AccountSettings, meta:{requiresAuth:true, roles:['ADMIN'], loginPath:'/personal/login'}}
];

const router=createRouter({history:createWebHistory(),routes});

function homeByRole(role) {
 if(role==='CLIENT') return '/cliente/dashboard';
 if(role==='VETERINARIAN') return '/veterinario';
 if(role==='ADMIN') return '/admin';
 return '/recepcion';
}

router.beforeEach((to)=>{
 const auth=useAuthStore();
 if(to.meta.requiresAuth && !auth.isAuthenticated) return to.meta.loginPath || '/personal/login';
 if(to.meta.roles && !to.meta.roles.includes(auth.role)) return homeByRole(auth.role);
});

export default router;
