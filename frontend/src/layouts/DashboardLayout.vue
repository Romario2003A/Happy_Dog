<script setup>
import { useAuthStore } from '../stores/auth';
import happyDogLogo from '../assets/images/happy-dog-logo.jpeg';

defineProps({ title: String, subtitle: String, hideUserPill: Boolean, shellClass: String });

const auth = useAuthStore();
</script>

<template>
  <div class="app-shell" :class="shellClass">
    <aside class="sidebar glass-panel">
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
          <div v-if="!hideUserPill" class="user-pill">{{ auth.user?.fullName || 'Usuario' }}</div>
        </div>
      </header>
      <slot />
    </main>
  </div>
</template>
