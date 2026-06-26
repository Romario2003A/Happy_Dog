<script setup>
import { ref, onMounted } from 'vue';
import ReceptionLayout from '../../layouts/ReceptionLayout.vue';
import { api } from '../../services/api';

const appointments=ref([]);
const users=ref([]);
const summary=ref({});
const active=ref('citas');

onMounted(async()=>{
  try{
    appointments.value=(await api.get('/appointments')).data;
    users.value=(await api.get('/users')).data;
    summary.value=(await api.get('/reports/summary')).data;
  }catch(e){}
});
</script>
<template>
  <ReceptionLayout title="Recepcion / Administracion" subtitle="Agenda, clientes, caja, usuarios y reportes">
    <template #nav>
      <button @click="active='citas'">Citas</button>
      <button @click="active='clientes'">Clientes</button>
      <button @click="active='caja'">Caja</button>
      <button @click="active='usuarios'">Usuarios</button>
      <button @click="active='reportes'">Reportes</button>
    </template>

    <div v-if="active==='reportes'" class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ summary.clients ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ summary.pets ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ summary.appointments ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ summary.lowStock ?? 0 }}</strong></div>
    </div>

    <div v-else class="panel-grid">
      <section class="glass-card">
        <h2>{{ active==='citas'?'Calendario de citas':active==='clientes'?'Clientes y mascotas':active==='usuarios'?'Usuarios del sistema':'Caja / POS' }}</h2>
        <p class="muted-text">Recepcion administra la operacion diaria y la configuracion del sistema.</p>
        <table v-if="active==='usuarios'">
          <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th></tr></thead>
          <tbody><tr v-if="!users.length"><td colspan="3" class="empty">No hay usuarios registrados todavia.</td></tr><tr v-for="u in users" :key="u.id"><td>{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td></tr></tbody>
        </table>
        <table v-else>
          <thead><tr><th>Registro</th><th>Estado</th><th>Accion</th></tr></thead>
          <tbody><tr v-if="!appointments.length"><td colspan="3" class="empty">Sin datos registrados todavia.</td></tr><tr v-for="a in appointments" :key="a.id"><td>{{ a.pet?.name }} - {{ a.reason }}</td><td><span class="status">{{ a.status }}</span></td><td><button class="small">Marcar en espera</button></td></tr></tbody>
        </table>
      </section>
      <section class="glass-card">
        <h2>{{ active==='usuarios'?'Crear usuario':'Registro rapido' }}</h2>
        <form class="stack">
          <input :placeholder="active==='usuarios'?'Nombre del usuario':'Dueno'">
          <input :placeholder="active==='usuarios'?'Correo':'Telefono'">
          <input :placeholder="active==='usuarios'?'Rol':'Mascota'">
          <input v-if="active!=='usuarios'" placeholder="Especie">
          <button>Guardar</button>
        </form>
      </section>
    </div>
  </ReceptionLayout>
</template>
