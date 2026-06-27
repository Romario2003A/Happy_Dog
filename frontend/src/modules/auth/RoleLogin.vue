<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';

const router = useRouter();
const auth = useAuthStore();
const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

function pathByRole(role) {
  if (role === 'VETERINARIAN') return '/veterinario';
  if (role === 'ADMIN') return '/admin';
  if (role === 'RECEPTIONIST') return '/recepcion';
  if (role === 'CLIENT') return '/cliente/dashboard';
  return '/cliente';
}

async function submit() {
  error.value = '';
  loading.value = true;

  try {
    const user = await auth.login(email.value, password.value);
    router.push(pathByRole(user.role));
  } catch (e) {
    error.value = 'Credenciales invalidas o usuario inactivo.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <form class="login-card glass-card" @submit.prevent="submit">
      <img class="login-logo" :src="happyDogLogo" alt="Happy Dog">
      <span class="badge">Acceso seguro</span>
      <h1>Acceso del personal</h1>
      <p>Ingresa con tu correo y contrasena. El sistema reconoce tu rol y abre tu panel automaticamente.</p>
      <label>Correo<input v-model="email" type="email" required placeholder="usuario@happydog.com"></label>
      <label>Contrasena<input v-model="password" type="password" required placeholder="********"></label>
      <p v-if="error" class="error">{{ error }}</p>
      <button :disabled="loading">{{ loading ? 'Ingresando...' : 'Ingresar' }}</button>
    </form>
  </div>
</template>
