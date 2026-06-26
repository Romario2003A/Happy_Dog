<script setup>
import { useAuthStore } from '../stores/auth';
const props = defineProps({ title:String, subtitle:String });
const auth = useAuthStore();
</script>
<template>
  <div class="app-shell">
    <aside class="sidebar glass-panel">
      <div class="brand"><div class="logo">V2</div><div><strong>Veterinaria 2.0</strong><small>{{ title }}</small></div></div>
      <nav><slot name="nav" /></nav>
      <button class="ghost" @click="auth.logout(); $router.push('/cliente')">Cerrar sesión</button>
    </aside>
    <main class="dashboard-main">
      <header class="topbar glass-panel"><div><h1>{{ title }}</h1><p>{{ subtitle }}</p></div><div class="user-pill">{{ auth.user?.fullName || 'Usuario' }}</div></header>
      <slot />
    </main>
  </div>
</template>
