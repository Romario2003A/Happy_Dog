<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const router=useRouter();
const auth=useAuthStore();
const mode=ref('login');
const form=ref({fullName:'',phone:'',email:'',password:''});
const loading=ref(false);
const error=ref('');

async function submit(){
  error.value='';
  loading.value=true;
  try{
    if(mode.value==='login') await auth.clientLogin(form.value.email,form.value.password);
    else await auth.registerClient(form.value);
    router.push('/cliente/dashboard');
  }catch(e){
    error.value=mode.value==='login'?'Credenciales invalidas.':'No se pudo crear la cuenta.';
  }finally{
    loading.value=false;
  }
}
</script>
<template>
  <div class="login-page">
    <section class="login-card glass-panel">
      <span class="badge">Cliente</span>
      <h1>{{ mode==='login'?'Ingreso cliente':'Crear cuenta cliente' }}</h1>
      <form class="stack" @submit.prevent="submit">
        <input v-if="mode==='register'" v-model="form.fullName" required placeholder="Nombre completo">
        <input v-if="mode==='register'" v-model="form.phone" placeholder="Telefono / WhatsApp">
        <input v-model="form.email" type="email" required placeholder="Correo">
        <input v-model="form.password" type="password" required minlength="6" placeholder="Contrasena">
        <button :disabled="loading">{{ loading?'Validando...':mode==='login'?'Entrar':'Crear cuenta' }}</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="ghost full" @click="mode=mode==='login'?'register':'login'">{{ mode==='login'?'Crear cuenta cliente':'Ya tengo cuenta' }}</button>
    </section>
  </div>
</template>
