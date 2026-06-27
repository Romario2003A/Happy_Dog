<script setup>
import { useAuthStore } from '../stores/auth';

defineProps({ title: String, subtitle: String });

const auth = useAuthStore();
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar glass-panel">
      <div class="brand">
        <div class="logo" aria-hidden="true">🐶</div>
        <div>
          <strong>Happy Dog</strong>
          <small>{{ title }}</small>
        </div>
      </div>
      <nav><slot name="nav" /></nav>
      <button class="ghost" @click="auth.logout(); $router.push('/personal/login')">Cerrar sesion</button>
    </aside>
    <main class="dashboard-main">
      <header class="topbar glass-panel">
        <div>
          <h1>{{ title }}</h1>
          <p>{{ subtitle }}</p>
        </div>
        <div class="user-pill">{{ auth.user?.fullName || 'Usuario' }}</div>
      </header>
      <slot />
    </main>
  </div>
</template>
