<script setup>
import { useAuthStore } from '../stores/auth';
import happyDogLogo from '../assets/images/happy-dog-logo.jpeg';

defineProps({ title: String, subtitle: String, hideUserPill: Boolean, hideSidebar: Boolean, accountPath: String, shellClass: String });

const auth = useAuthStore();
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
          <button v-if="!hideUserPill && accountPath" type="button" class="user-pill account-pill" @click="$router.push(accountPath)">
            <span>{{ (auth.user?.fullName || 'U').slice(0, 1).toUpperCase() }}</span>
            <div><strong>{{ auth.user?.fullName || 'Usuario' }}</strong><small>Mi cuenta</small></div>
          </button>
          <div v-else-if="!hideUserPill" class="user-pill">{{ auth.user?.fullName || 'Usuario' }}</div>
        </div>
      </header>
      <nav v-if="hideSidebar && $slots.nav" class="calm-section-nav"><slot name="nav" /></nav>
      <slot />
    </main>
  </div>
</template>
