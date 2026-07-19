<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import happyDogLogo from '../assets/images/happy-dog-logo.jpeg';

defineProps({ title: String, subtitle: String, hideUserPill: Boolean, hideSidebar: Boolean, accountPath: String, shellClass: String });

const auth = useAuthStore();
const accountOpen = ref(false);
const accountLoading = ref(false);
const accountError = ref('');
const accountSuccess = ref('');
const accountForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });

async function changeAccountPassword() {
  accountError.value = '';
  accountSuccess.value = '';
  if (accountForm.value.newPassword !== accountForm.value.confirmPassword) {
    accountError.value = 'La nueva contraseña no coincide.';
    return;
  }
  accountLoading.value = true;
  try {
    const data = await auth.changePassword({
      currentPassword: accountForm.value.currentPassword,
      newPassword: accountForm.value.newPassword,
    });
    accountForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    accountSuccess.value = data.message || 'Contraseña actualizada correctamente.';
  } catch (e) {
    accountError.value = e.response?.data?.message || 'No se pudo cambiar la contraseña.';
  } finally {
    accountLoading.value = false;
  }
}
</script>

<template>
  <div class="app-shell" :class="[shellClass, { 'sidebar-hidden': hideSidebar }]">
    <aside v-if="!hideSidebar" class="sidebar glass-panel">
      <div class="brand brand-with-wordmark">
        <img class="brand-wordmark" :src="happyDogLogo" alt="Happy Dog">
        <small>{{ title }}</small>
      </div>
      <nav><slot name="nav" /></nav>
      <button class="ghost" @click="auth.logout(); $router.push('/personal/login')">Cerrar sesión</button>
    </aside>
    <main class="dashboard-main">
      <header class="topbar glass-panel">
        <div>
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </div>
        <div class="topbar-actions">
          <slot name="top-actions" />
          <button v-if="!hideUserPill && accountPath" type="button" class="user-pill account-pill" :aria-expanded="accountOpen" @click="accountOpen = true">
            <span>{{ (auth.user?.fullName || 'U').slice(0, 1).toUpperCase() }}</span>
            <div><strong>{{ auth.user?.fullName || 'Usuario' }}</strong><small>Mi cuenta</small></div>
          </button>
          <div v-else-if="!hideUserPill" class="user-pill">{{ auth.user?.fullName || 'Usuario' }}</div>
        </div>
      </header>
      <nav v-if="hideSidebar && $slots.nav" class="calm-section-nav"><slot name="nav" /></nav>
      <slot />
    </main>
    <div v-if="accountOpen" class="account-overlay" @click.self="accountOpen = false">
      <aside class="account-drawer glass-card" role="dialog" aria-modal="true" aria-labelledby="shared-account-title">
        <div class="account-drawer-head">
          <div><span class="badge">Mi cuenta</span><h2 id="shared-account-title">Perfil y seguridad</h2></div>
          <button type="button" class="secondary small" aria-label="Cerrar mi cuenta" @click="accountOpen = false">Cerrar</button>
        </div>
        <div class="account-identity">
          <span>{{ (auth.user?.fullName || 'U').slice(0, 1).toUpperCase() }}</span>
          <div><strong>{{ auth.user?.fullName || 'Usuario' }}</strong><small>{{ auth.user?.email || '' }}</small><small>{{ title }}</small></div>
        </div>
        <div class="account-divider"></div>
        <h3>Cambiar contraseña</h3>
        <p class="muted-text">Actualiza tu acceso sin salir de tu espacio de trabajo.</p>
        <form class="stack" @submit.prevent="changeAccountPassword">
          <label>Contraseña actual<input v-model="accountForm.currentPassword" type="password" required minlength="6" autocomplete="current-password"></label>
          <label>Nueva contraseña<input v-model="accountForm.newPassword" type="password" required minlength="8" autocomplete="new-password"></label>
          <label>Confirmar contraseña<input v-model="accountForm.confirmPassword" type="password" required minlength="8" autocomplete="new-password"></label>
          <p v-if="accountError" class="error">{{ accountError }}</p>
          <p v-if="accountSuccess" class="success">{{ accountSuccess }}</p>
          <button :disabled="accountLoading">{{ accountLoading ? 'Guardando...' : 'Guardar nueva contraseña' }}</button>
        </form>
        <div class="account-divider"></div>
        <div v-if="auth.role === 'ADMIN'" class="role-switch-box">
          <div>
            <strong>Cambiar espacio de trabajo</strong>
            <span>{{ accountPath === '/recepcion/cuenta' ? 'Accede al inventario, caja y control del negocio.' : 'Regresa a la agenda y coordinación diaria.' }}</span>
          </div>
          <button
            type="button"
            class="secondary full"
            @click="accountOpen = false; $router.push(accountPath === '/recepcion/cuenta' ? '/admin' : '/recepcion')"
          >
            {{ accountPath === '/recepcion/cuenta' ? 'Ir a Administración' : 'Ir a Recepción' }}
          </button>
        </div>
        <div v-if="auth.role === 'ADMIN'" class="account-divider"></div>
        <button type="button" class="danger full" @click="auth.logout(); $router.push('/personal/login')">Cerrar sesión</button>
      </aside>
    </div>
  </div>
</template>
