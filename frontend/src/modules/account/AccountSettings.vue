<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import ReceptionLayout from '../../layouts/ReceptionLayout.vue';
import VeterinarianLayout from '../../layouts/VeterinarianLayout.vue';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const form = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
const loading = ref(false);
const error = ref('');
const success = ref('');

const isVet = computed(() => auth.role === 'VETERINARIAN');
const isAdmin = computed(() => auth.role === 'ADMIN');
const Layout = computed(() => isVet.value ? VeterinarianLayout : isAdmin.value ? AdminLayout : ReceptionLayout);
const dashboardPath = computed(() => isVet.value ? '/veterinario' : isAdmin.value ? '/admin' : '/recepcion');
const title = computed(() => isVet.value ? 'Doctor Veterinario' : isAdmin.value ? 'Administracion' : 'Recepcion');

async function submit() {
  error.value = '';
  success.value = '';
  if (form.value.newPassword !== form.value.confirmPassword) {
    error.value = 'La nueva contrasena no coincide.';
    return;
  }
  loading.value = true;
  try {
    const data = await auth.changePassword({
      currentPassword: form.value.currentPassword,
      newPassword: form.value.newPassword,
    });
    form.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    success.value = data.message || 'Contrasena actualizada correctamente.';
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo cambiar la contrasena.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <component :is="Layout" :title="title" subtitle="Cuenta y seguridad">
    <template #nav>
      <button @click="router.push(dashboardPath)">Panel</button>
      <button>Mi cuenta</button>
    </template>

    <section class="glass-card account-card">
      <span class="badge">Seguridad</span>
      <h2>Cambiar contrasena</h2>
      <p class="muted-text">Usa tu contrasena temporal solo para entrar por primera vez. Luego guarda una nueva que solo tu conozcas.</p>

      <form class="stack" @submit.prevent="submit">
        <label>Contrasena actual<input v-model="form.currentPassword" type="password" required minlength="6" autocomplete="current-password"></label>
        <label>Nueva contrasena<input v-model="form.newPassword" type="password" required minlength="8" autocomplete="new-password"></label>
        <label>Confirmar nueva contrasena<input v-model="form.confirmPassword" type="password" required minlength="8" autocomplete="new-password"></label>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="success" class="success">{{ success }}</p>
        <button :disabled="loading">{{ loading ? 'Guardando...' : 'Guardar nueva contrasena' }}</button>
      </form>
    </section>
  </component>
</template>
