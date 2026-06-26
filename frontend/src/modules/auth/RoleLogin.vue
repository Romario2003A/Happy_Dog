<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
const route=useRoute(); const router=useRouter(); const auth=useAuthStore();
const email=ref(''); const password=ref(''); const error=ref(''); const loading=ref(false);
async function submit(){ error.value=''; loading.value=true; try{ const user=await auth.login(email.value,password.value); if(user.role!==route.meta.role && user.role!=='ADMIN'){ auth.logout(); error.value='No tienes permisos para este panel.'; return; } const path=route.meta.role==='VETERINARIAN'?'/veterinario':route.meta.role==='ADMIN'?'/admin':'/recepcion'; router.push(path); }catch(e){ error.value='Credenciales inválidas o usuario inactivo.' } finally{ loading.value=false } }
</script>
<template><div class="login-page"><form class="login-card glass-card" @submit.prevent="submit"><span class="badge">Acceso seguro</span><h1>{{ route.meta.title }}</h1><p>Ingresa con tu usuario asignado. No hay selector de rol público.</p><label>Correo<input v-model="email" type="email" required placeholder="usuario@veterinaria.com" /></label><label>Contraseña<input v-model="password" type="password" required placeholder="••••••••" /></label><p v-if="error" class="error">{{ error }}</p><button :disabled="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button></form></div></template>
