<script setup>
import { ref,onMounted } from 'vue';
import AdminLayout from '../../layouts/AdminLayout.vue';
import { api } from '../../services/api';

const summary=ref({});
const users=ref([]);
const active=ref('resumen');

onMounted(async()=>{
  try{
    summary.value=(await api.get('/reports/summary')).data;
    users.value=(await api.get('/users')).data;
  }catch(e){}
});
</script>
<template>
  <AdminLayout title="Administrador" subtitle="Usuarios, configuracion, inventario y reportes">
    <template #nav><button @click="active='resumen'">Resumen</button><button @click="active='usuarios'">Usuarios</button><button @click="active='inventario'">Inventario</button></template>
    <div class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ summary.clients ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ summary.pets ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ summary.appointments ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ summary.lowStock ?? 0 }}</strong></div>
    </div>
    <section class="glass-card">
      <h2>Gestion {{ active }}</h2>
      <table><tbody><tr v-if="active==='usuarios' && !users.length"><td class="empty">No hay usuarios registrados todavia.</td></tr><tr v-for="u in users" :key="u.id"><td>{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td></tr><tr v-if="active!=='usuarios'"><td class="empty">Panel preparado para configuracion modular.</td></tr></tbody></table>
    </section>
  </AdminLayout>
</template>
