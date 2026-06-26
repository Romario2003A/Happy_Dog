<script setup>
import { ref,onMounted } from 'vue';
import ClientLayout from '../../layouts/ClientLayout.vue';
import { api } from '../../services/api';

const profile=ref(null);
const appointments=ref([]);
const pets=ref([]);

onMounted(async()=>{
  try{
    profile.value=(await api.get('/client-portal/me')).data;
    pets.value=(await api.get('/client-portal/pets')).data;
    appointments.value=(await api.get('/client-portal/appointments')).data;
  }catch(e){}
});
</script>
<template>
  <ClientLayout title="Mi portal" subtitle="Tus mascotas, citas y datos registrados">
    <template #nav><button @click="$router.push('/cliente')">Solicitar cita</button></template>
    <div class="cards">
      <div class="glass-card metric"><span>Mascotas</span><strong>{{ pets.length }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ appointments.length }}</strong></div>
      <div class="glass-card metric"><span>Estado</span><strong>{{ profile?.active===false?'Inactivo':'Activo' }}</strong></div>
      <div class="glass-card metric"><span>Contacto</span><strong>{{ profile?.phone || '-' }}</strong></div>
    </div>
    <div class="panel-grid">
      <section class="glass-card">
        <h2>Mis citas</h2>
        <table><thead><tr><th>Mascota</th><th>Fecha</th><th>Estado</th></tr></thead><tbody><tr v-if="!appointments.length"><td colspan="3" class="empty">Aun no tienes citas registradas.</td></tr><tr v-for="a in appointments" :key="a.id"><td>{{ a.pet?.name }}</td><td>{{ new Date(a.scheduledAt).toLocaleString() }}</td><td><span class="status">{{ a.status }}</span></td></tr></tbody></table>
      </section>
      <section class="glass-card">
        <h2>Mis mascotas</h2>
        <table><tbody><tr v-if="!pets.length"><td class="empty">Sin mascotas registradas.</td></tr><tr v-for="p in pets" :key="p.id"><td>{{ p.name }}</td><td>{{ p.species }}</td></tr></tbody></table>
      </section>
    </div>
  </ClientLayout>
</template>
