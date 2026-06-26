<script setup>
import { useAuthStore } from '../stores/auth';
const props = defineProps({ title:String, subtitle:String });
const auth = useAuthStore();
</script>
<template>
  <div class="client-shell">
    <header class="client-top glass-panel">
      <div class="brand"><div class="logo">C</div><div><strong>Portal Cliente</strong><small>{{ title }}</small></div></div>
      <nav><slot name="nav" /></nav>
      <div class="user-actions"><span class="user-pill">{{ auth.user?.fullName || 'Cliente' }}</span><button class="ghost" @click="auth.logout(); $router.push('/cliente/login')">Salir</button></div>
    </header>
    <main class="dashboard-main">
      <section class="page-heading"><h1>{{ title }}</h1><p>{{ subtitle }}</p></section>
      <slot />
    </main>
  </div>
</template>
