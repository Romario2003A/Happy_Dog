<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../services/api';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';

const router = useRouter();
const auth = useAuthStore();
const mode = ref('login');
const form = ref({ fullName: '', phone: '', email: '', password: '' });
const loading = ref(false);
const error = ref('');
const googleLoginUrl = computed(() => `${api.defaults.baseURL}/auth/client/google`);

function normalizePhone() {
  form.value.phone = form.value.phone.replace(/\D/g, '');
}

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    if (mode.value === 'login') await auth.clientLogin(form.value.email, form.value.password);
    else {
      await auth.registerClient({
        ...form.value,
        phone: form.value.phone.replace(/\D/g, ''),
        email: form.value.email.trim().toLowerCase(),
      });
    }
    router.push('/cliente/dashboard');
  } catch (e) {
    error.value = e.response?.data?.message || (mode.value === 'login' ? 'Credenciales invalidas.' : 'No se pudo crear la cuenta.');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  const query = router.currentRoute.value.query;
  if (query.googleError) {
    error.value = String(query.googleError);
    router.replace('/cliente/login');
    return;
  }
  if (!query.googleToken || !query.googleUser) return;
  try {
    auth.setSession({
      accessToken: String(query.googleToken),
      user: JSON.parse(String(query.googleUser)),
    });
    router.replace('/cliente/dashboard');
  } catch {
    error.value = 'No se pudo completar el acceso con Google.';
    router.replace('/cliente/login');
  }
});
</script>

<template>
  <div class="login-page client-login-page">
    <section class="login-card client-login-card glass-panel">
      <button class="ghost small client-login-back" type="button" @click="router.push('/cliente')">Volver</button>
      <img class="login-logo client-login-logo" :src="happyDogLogo" alt="Happy Dog">
      <h1>{{ mode === 'login' ? 'Bienvenido' : 'Crea tu cuenta' }}</h1>
      <p class="muted-text client-login-copy">
        {{ mode === 'login' ? 'Ingresa para revisar tus mascotas, citas y carnet.' : 'Registra tus datos para gestionar tus visitas con Happy Dog.' }}
      </p>

      <a class="google-login-button" :href="googleLoginUrl">
        <span>G</span>
        Continuar con Google
      </a>

      <div class="login-divider"><span>o usa tu correo</span></div>

      <form class="stack" @submit.prevent="submit">
        <input v-if="mode === 'register'" v-model="form.fullName" required placeholder="Nombre completo">
        <input v-if="mode === 'register'" v-model="form.phone" inputmode="numeric" placeholder="Telefono / WhatsApp" @input="normalizePhone">
        <input v-model="form.email" type="email" required placeholder="Correo">
        <input v-model="form.password" type="password" required minlength="6" placeholder="Contrase&ntilde;a">
        <button :disabled="loading">{{ loading ? 'Validando...' : mode === 'login' ? 'Ingresar al portal' : 'Crear mi cuenta' }}</button>
      </form>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="client-login-switch">
        <span>{{ mode === 'login' ? 'Primera vez aqui?' : 'Ya tienes cuenta?' }}</span>
        <button class="ghost small" type="button" @click="mode = mode === 'login' ? 'register' : 'login'">
          {{ mode === 'login' ? 'Crear cuenta' : 'Ingresar' }}
        </button>
      </div>
    </section>
  </div>
</template>
