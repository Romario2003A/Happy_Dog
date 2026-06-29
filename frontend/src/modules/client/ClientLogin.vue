<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';

const router=useRouter();
const auth=useAuthStore();
const mode=ref('login');
const form=ref({fullName:'',phone:'',email:'',password:''});
const loading=ref(false);
const error=ref('');

function normalizePhone(){
  form.value.phone=form.value.phone.replace(/\D/g,'');
}

async function submit(){
  error.value='';
  loading.value=true;
  try{
    if(mode.value==='login') await auth.clientLogin(form.value.email,form.value.password);
    else await auth.registerClient({...form.value,phone:form.value.phone.replace(/\D/g,''),email:form.value.email.trim().toLowerCase()});
    router.push('/cliente/dashboard');
  }catch(e){
    error.value=e.response?.data?.message || (mode.value==='login'?'Credenciales invalidas.':'No se pudo crear la cuenta.');
  }finally{
    loading.value=false;
  }
}
</script>
<template>
  <div class="login-page">
    <section class="login-card glass-panel">
      <img class="login-logo" :src="happyDogLogo" alt="Happy Dog">
      <span class="badge">Cliente</span>
      <h1>{{ mode==='login'?'Ingreso cliente':'Crear cuenta cliente' }}</h1>
      <form class="stack" @submit.prevent="submit">
        <input v-if="mode==='register'" v-model="form.fullName" required placeholder="Nombre completo">
        <input v-if="mode==='register'" v-model="form.phone" inputmode="numeric" placeholder="Telefono / WhatsApp" @input="normalizePhone">
        <input v-model="form.email" type="email" required placeholder="Correo">
        <input v-model="form.password" type="password" required minlength="6" placeholder="Contraseña">
        <button :disabled="loading">{{ loading?'Validando...':mode==='login'?'Entrar':'Crear cuenta' }}</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <button class="ghost full" @click="mode=mode==='login'?'register':'login'">{{ mode==='login'?'Crear cuenta cliente':'Ya tengo cuenta' }}</button>
    </section>
  </div>
</template>


