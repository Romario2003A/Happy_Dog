<script setup>
import { computed, onMounted, ref } from 'vue';
import ReceptionLayout from '../../layouts/ReceptionLayout.vue';
import { api } from '../../services/api';

const appointments = ref([]);
const clients = ref([]);
const users = ref([]);
const summary = ref({});
const active = ref('citas');
const showQuick = ref(false);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const selectedDate = ref(new Date().toISOString().slice(0, 10));
const hours = Array.from({ length: 11 }, (_, i) => i + 8);
const quick = ref({
  fullName: '',
  phone: '',
  email: '',
  petName: '',
  species: '',
  breed: '',
  scheduledAt: '',
  reason: '',
});

const dayAppointments = computed(() => appointments.value.filter(item => {
  if (!item.scheduledAt) return false;
  return item.scheduledAt.slice(0, 10) === selectedDate.value;
}));

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function hourAppointments(hour) {
  return dayAppointments.value.filter(item => new Date(item.scheduledAt).getHours() === hour);
}

function statusLabel(status) {
  const labels = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    WAITING: 'En espera',
    IN_CONSULTATION: 'En consulta',
    ATTENDED: 'Atendida',
    CANCELLED: 'Cancelada',
  };
  return labels[status] || status;
}

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [appointmentsRes, clientsRes, usersRes, summaryRes] = await Promise.all([
      api.get('/appointments'),
      api.get('/clients'),
      api.get('/users'),
      api.get('/reports/summary'),
    ]);
    appointments.value = appointmentsRes.data;
    clients.value = clientsRes.data;
    users.value = usersRes.data;
    summary.value = summaryRes.data;
  } catch (e) {
    error.value = 'No se pudo cargar la informacion de recepcion.';
  } finally {
    loading.value = false;
  }
}

async function setStatus(appointment, status) {
  error.value = '';
  success.value = '';
  try {
    const { data } = await api.patch(`/appointments/${appointment.id}`, { status });
    appointments.value = appointments.value.map(item => item.id === data.id ? data : item);
    success.value = 'Cita actualizada correctamente.';
  } catch (e) {
    error.value = 'No se pudo actualizar la cita.';
  }
}

function resetQuick() {
  quick.value = { fullName: '', phone: '', email: '', petName: '', species: '', breed: '', scheduledAt: '', reason: '' };
}

async function saveQuickAppointment() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const { data: client } = await api.post('/clients', {
      fullName: quick.value.fullName,
      phone: quick.value.phone,
      email: quick.value.email || undefined,
    });
    const { data: pet } = await api.post('/pets', {
      name: quick.value.petName,
      species: quick.value.species,
      breed: quick.value.breed || undefined,
      clientId: client.id,
    });
    await api.post('/appointments', {
      clientId: client.id,
      petId: pet.id,
      scheduledAt: quick.value.scheduledAt,
      reason: quick.value.reason,
    });
    success.value = 'Registro rapido creado: cliente, mascota y cita fueron guardados.';
    resetQuick();
    showQuick.value = false;
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo crear el registro rapido.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <ReceptionLayout title="Recepcion / Administracion" subtitle="Agenda, clientes, caja, usuarios y reportes">
    <template #nav>
      <button @click="active='citas'">Citas</button>
      <button @click="active='clientes'">Clientes</button>
      <button @click="active='caja'">Caja</button>
      <button @click="active='usuarios'">Usuarios</button>
      <button @click="active='reportes'">Reportes</button>
      <button @click="$router.push('/recepcion/cuenta')">Mi cuenta</button>
    </template>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div v-if="active==='reportes'" class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ summary.clients ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ summary.pets ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ summary.appointments ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ summary.lowStock ?? 0 }}</strong></div>
    </div>

    <div v-else-if="active==='citas'" class="reception-grid">
      <section class="glass-card calendar-card">
        <div class="calendar-header">
          <div>
            <span class="badge">Agenda</span>
            <h2>Calendario de citas</h2>
            <p class="muted-text">Vista diaria para organizar la atencion como una agenda de recepcion.</p>
          </div>
          <input v-model="selectedDate" type="date">
        </div>

        <p v-if="loading" class="muted-text">Cargando agenda...</p>
        <div v-else class="day-calendar">
          <div v-for="hour in hours" :key="hour" class="calendar-row">
            <div class="calendar-time">{{ String(hour).padStart(2, '0') }}:00</div>
            <div class="calendar-slot">
              <article v-for="item in hourAppointments(hour)" :key="item.id" class="calendar-event" :data-status="item.status">
                <div>
                  <strong>{{ formatTime(item.scheduledAt) }} - {{ item.pet?.name || 'Mascota' }}</strong>
                  <span>{{ item.client?.fullName || 'Cliente' }} · {{ item.reason }}</span>
                </div>
                <div class="event-actions">
                  <span class="status">{{ statusLabel(item.status) }}</span>
                  <button class="small secondary" @click="setStatus(item,'CONFIRMED')">Confirmar</button>
                  <button class="small secondary" @click="setStatus(item,'WAITING')">En espera</button>
                </div>
              </article>
              <span v-if="!hourAppointments(hour).length" class="empty-slot">Libre</span>
            </div>
          </div>
        </div>
      </section>

      <section class="glass-card quick-card">
        <div class="section-title">
          <div>
            <span class="badge">Operacion</span>
            <h2>Registro rapido</h2>
          </div>
        </div>
        <p class="muted-text">Usalo cuando llega un cliente nuevo o llama por WhatsApp para agendar.</p>
        <button class="full" @click="showQuick=!showQuick">{{ showQuick ? 'Ocultar registro rapido' : '+ Registro rapido' }}</button>

        <form v-if="showQuick" class="stack quick-form" @submit.prevent="saveQuickAppointment">
          <label>Dueno<input v-model="quick.fullName" required placeholder="Nombre completo"></label>
          <label>Telefono / WhatsApp<input v-model="quick.phone" required placeholder="999 999 999"></label>
          <label>Correo opcional<input v-model="quick.email" type="email" placeholder="correo@ejemplo.com"></label>
          <label>Mascota<input v-model="quick.petName" required placeholder="Nombre de la mascota"></label>
          <label>Especie<input v-model="quick.species" required placeholder="Perro, gato, conejo"></label>
          <label>Raza<input v-model="quick.breed" placeholder="Raza o cruce"></label>
          <label>Fecha y hora<input v-model="quick.scheduledAt" required type="datetime-local"></label>
          <label>Motivo<textarea v-model="quick.reason" required placeholder="Motivo de consulta"></textarea></label>
          <button :disabled="saving">{{ saving ? 'Guardando...' : 'Crear cliente, mascota y cita' }}</button>
        </form>
      </section>
    </div>

    <div v-else class="panel-grid">
      <section class="glass-card">
        <h2>{{ active==='clientes'?'Clientes y mascotas':active==='usuarios'?'Usuarios del sistema':'Caja / POS' }}</h2>
        <p class="muted-text">Recepcion administra la operacion diaria y la configuracion del sistema.</p>
        <table v-if="active==='usuarios'">
          <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th></tr></thead>
          <tbody>
            <tr v-if="!users.length"><td colspan="3" class="empty">No hay usuarios registrados todavia.</td></tr>
            <tr v-for="u in users" :key="u.id"><td>{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td></tr>
          </tbody>
        </table>
        <table v-else-if="active==='clientes'">
          <thead><tr><th>Cliente</th><th>Contacto</th><th>Mascotas</th></tr></thead>
          <tbody>
            <tr v-if="!clients.length"><td colspan="3" class="empty">No hay clientes registrados todavia.</td></tr>
            <tr v-for="client in clients" :key="client.id"><td>{{ client.fullName }}</td><td>{{ client.phone || client.email || '-' }}</td><td>{{ client.pets?.map(p => p.name).join(', ') || '-' }}</td></tr>
          </tbody>
        </table>
        <div v-else class="empty">Modulo de caja listo para conectar ventas y pagos.</div>
      </section>
    </div>
  </ReceptionLayout>
</template>
