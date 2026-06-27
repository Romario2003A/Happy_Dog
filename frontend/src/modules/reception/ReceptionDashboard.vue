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
const search = ref('');
const quickMode = ref('new');
const agendaView = ref('day');
const selectedAppointment = ref(null);
const hours = Array.from({ length: 11 }, (_, i) => i + 8);

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const selectedDate = ref(dateKey());
const quick = ref({
  clientId: '',
  petId: '',
  fullName: '',
  phone: '',
  email: '',
  petName: '',
  species: '',
  breed: '',
  sex: 'UNKNOWN',
  age: '',
  weightKg: '',
  scheduledAt: '',
  reason: '',
});

const searchedAppointments = computed(() => appointments.value.filter(item => {
  if (!item.scheduledAt) return false;
  const text = `${item.client?.fullName || ''} ${item.client?.phone || ''} ${item.pet?.name || ''} ${item.reason || ''}`.toLowerCase();
  return text.includes(search.value.toLowerCase());
}));

const dayAppointments = computed(() => searchedAppointments.value.filter(item => {
  return dateKey(item.scheduledAt) === selectedDate.value;
}));

const weekDays = computed(() => {
  const base = new Date(`${selectedDate.value}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    const items = searchedAppointments.value
      .filter(item => dateKey(item.scheduledAt) === key)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    return {
      key,
      label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(date),
      items,
    };
  });
});

const upcomingAppointments = computed(() => {
  const now = new Date();
  return searchedAppointments.value
    .filter(item => new Date(item.scheduledAt) >= now && !['ATTENDED', 'CANCELLED'].includes(item.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 12);
});

const filteredClients = computed(() => clients.value.filter(client => {
  const text = `${client.fullName || ''} ${client.phone || ''} ${client.email || ''} ${client.pets?.map(p => p.name).join(' ') || ''}`.toLowerCase();
  return text.includes(search.value.toLowerCase());
}));

const selectedClientPets = computed(() => clients.value.find(client => client.id === quick.value.clientId)?.pets || []);

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(value));
}

function moveDay(days) {
  const date = new Date(`${selectedDate.value}T00:00:00`);
  date.setDate(date.getDate() + days);
  selectedDate.value = dateKey(date);
}

function setToday() {
  selectedDate.value = dateKey();
  agendaView.value = 'day';
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
    if (selectedAppointment.value?.id === data.id) selectedAppointment.value = data;
    success.value = 'Cita actualizada correctamente.';
  } catch (e) {
    error.value = 'No se pudo actualizar la cita.';
  }
}

function resetQuick() {
  quick.value = { clientId: '', petId: '', fullName: '', phone: '', email: '', petName: '', species: '', breed: '', sex: 'UNKNOWN', age: '', weightKg: '', scheduledAt: '', reason: '' };
}

async function saveQuickAppointment() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    let clientId = quick.value.clientId;
    let petId = quick.value.petId;

    if (quickMode.value === 'new') {
      const { data: client } = await api.post('/clients', {
        fullName: quick.value.fullName,
        phone: quick.value.phone,
        email: quick.value.email || undefined,
      });
      const { data: pet } = await api.post('/pets', {
        name: quick.value.petName,
        species: quick.value.species,
        breed: quick.value.breed || undefined,
        sex: quick.value.sex || 'UNKNOWN',
        age: quick.value.age || undefined,
        weightKg: quick.value.weightKg === '' ? undefined : Number(quick.value.weightKg),
        clientId: client.id,
      });
      clientId = client.id;
      petId = pet.id;
    }

    await api.post('/appointments', {
      clientId,
      petId,
      scheduledAt: quick.value.scheduledAt,
      reason: quick.value.reason,
    });
    success.value = 'Cita creada desde recepcion correctamente.';
    resetQuick();
    showQuick.value = false;
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo agendar desde recepcion.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <ReceptionLayout title="Recepcion" subtitle="Agenda, citas por llamada y coordinacion diaria">
    <template #nav>
      <button @click="active='citas'">Citas</button>
      <button @click="active='clientes'">Clientes</button>
      <button @click="$router.push('/admin')">Administracion</button>
      <button @click="$router.push('/recepcion/cuenta')">Mi cuenta</button>
    </template>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div v-if="active==='citas'" class="reception-grid">
      <section class="glass-card calendar-card">
        <div class="calendar-header">
          <div>
            <span class="badge">Agenda</span>
            <h2>Calendario de citas</h2>
            <p class="muted-text">Opera el dia y revisa lo que viene sin perder citas futuras.</p>
          </div>
          <div class="date-controls">
            <button class="small secondary" type="button" @click="setToday">Hoy</button>
            <button class="small secondary" type="button" @click="moveDay(-1)">Anterior</button>
            <input v-model="selectedDate" type="date">
            <button class="small secondary" type="button" @click="moveDay(1)">Siguiente</button>
          </div>
        </div>

        <div class="segmented agenda-tabs">
          <button type="button" :class="{active:agendaView==='day'}" @click="agendaView='day'">Dia</button>
          <button type="button" :class="{active:agendaView==='week'}" @click="agendaView='week'">Semana</button>
          <button type="button" :class="{active:agendaView==='upcoming'}" @click="agendaView='upcoming'">Proximas</button>
        </div>

        <input v-model="search" class="search-field" placeholder="Buscar por cliente, telefono, mascota o motivo">

        <p v-if="loading" class="muted-text">Cargando agenda...</p>
        <div v-else-if="agendaView==='day'" class="day-calendar">
          <div v-for="hour in hours" :key="hour" class="calendar-row">
            <div class="calendar-time">{{ String(hour).padStart(2, '0') }}:00</div>
            <div class="calendar-slot">
              <article v-for="item in hourAppointments(hour)" :key="item.id" class="calendar-event" :data-status="item.status" @click="selectedAppointment=item">
                <div>
                  <strong>{{ formatTime(item.scheduledAt) }} - {{ item.pet?.name || 'Mascota' }}</strong>
                  <span>{{ item.client?.fullName || 'Cliente' }} · {{ item.reason }}</span>
                </div>
                <div class="event-actions">
                  <span class="status">{{ statusLabel(item.status) }}</span>
                  <button class="small secondary" @click.stop="selectedAppointment=item">Ver</button>
                </div>
              </article>
              <span v-if="!hourAppointments(hour).length" class="empty-slot">Libre</span>
            </div>
          </div>
        </div>

        <div v-else-if="agendaView==='week'" class="week-calendar">
          <article v-for="day in weekDays" :key="day.key" class="week-day" :class="{ today: day.key === selectedDate }">
            <button class="week-day-head" type="button" @click="selectedDate = day.key; agendaView = 'day'">
              <span>{{ day.label }}</span>
              <strong>{{ day.day }}</strong>
              <small>{{ day.items.length }} citas</small>
            </button>
            <div class="week-events">
              <button v-for="item in day.items" :key="item.id" class="week-event" type="button" @click="selectedAppointment=item">
                <strong>{{ formatTime(item.scheduledAt) }} - {{ item.pet?.name || 'Mascota' }}</strong>
                <span>{{ item.client?.fullName || 'Cliente' }}</span>
                <small>{{ statusLabel(item.status) }}</small>
              </button>
              <span v-if="!day.items.length" class="empty-slot">Sin citas</span>
            </div>
          </article>
        </div>

        <div v-else class="upcoming-list">
          <article v-for="item in upcomingAppointments" :key="item.id" class="calendar-event" :data-status="item.status" @click="selectedAppointment=item">
            <div>
              <strong>{{ formatDate(item.scheduledAt) }} - {{ formatTime(item.scheduledAt) }}</strong>
              <span>{{ item.pet?.name || 'Mascota' }} · {{ item.client?.fullName || 'Cliente' }} · {{ item.reason }}</span>
            </div>
            <div class="event-actions">
              <span class="status">{{ statusLabel(item.status) }}</span>
              <button class="small secondary" @click.stop="selectedAppointment=item">Ver</button>
            </div>
          </article>
          <p v-if="!upcomingAppointments.length" class="empty">No hay citas futuras pendientes con este filtro.</p>
        </div>
      </section>

      <section class="glass-card quick-card">
        <div class="section-title">
          <div>
            <span class="badge">Recepcion</span>
            <h2>Agendar desde recepcion</h2>
          </div>
        </div>
        <p class="muted-text">Para citas que llegan por llamada, WhatsApp o atencion presencial.</p>
        <div class="use-cases">
          <span>Cliente nuevo</span>
          <span>Cliente existente</span>
          <span>Sin cuenta web</span>
        </div>
        <button class="full" @click="showQuick=!showQuick">{{ showQuick ? 'Ocultar formulario' : '+ Nueva cita por llamada o WhatsApp' }}</button>

        <div class="detail-box upcoming-summary">
          <span class="badge">Proximas</span>
          <h3>{{ upcomingAppointments.length }} citas por venir</h3>
          <button
            v-for="item in upcomingAppointments.slice(0, 4)"
            :key="item.id"
            class="summary-appointment"
            type="button"
            @click="selectedAppointment=item; agendaView='upcoming'"
          >
            <strong>{{ formatDate(item.scheduledAt) }} · {{ formatTime(item.scheduledAt) }}</strong>
            <span>{{ item.pet?.name || 'Mascota' }} - {{ item.client?.fullName || 'Cliente' }}</span>
          </button>
          <button v-if="upcomingAppointments.length > 4" class="secondary small full" type="button" @click="agendaView='upcoming'">Ver todas</button>
          <p v-if="!upcomingAppointments.length" class="muted-text">No tienes citas futuras pendientes.</p>
        </div>

        <form v-if="showQuick" class="stack quick-form" @submit.prevent="saveQuickAppointment">
          <div class="segmented">
            <button type="button" :class="{active:quickMode==='new'}" @click="quickMode='new'">Registrar cliente nuevo</button>
            <button type="button" :class="{active:quickMode==='existing'}" @click="quickMode='existing'">Agendar cliente existente</button>
          </div>

          <template v-if="quickMode==='existing'">
            <label>Cliente
              <select v-model="quick.clientId" required @change="quick.petId=''">
                <option value="">Seleccionar cliente</option>
                <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.fullName }} - {{ client.phone || client.email || 'sin contacto' }}</option>
              </select>
            </label>
            <label>Mascota
              <select v-model="quick.petId" required>
                <option value="">Seleccionar mascota</option>
                <option v-for="pet in selectedClientPets" :key="pet.id" :value="pet.id">{{ pet.name }} - {{ pet.species }}</option>
              </select>
            </label>
          </template>

          <template v-else>
            <label>Dueno<input v-model="quick.fullName" required placeholder="Nombre completo"></label>
            <label>Telefono / WhatsApp<input v-model="quick.phone" required placeholder="999 999 999"></label>
            <label>Correo opcional<input v-model="quick.email" type="email" placeholder="correo@ejemplo.com"></label>
            <label>Mascota<input v-model="quick.petName" required placeholder="Nombre de la mascota"></label>
            <label>Especie<input v-model="quick.species" required placeholder="Perro, gato, conejo"></label>
            <label>Raza<input v-model="quick.breed" placeholder="Raza o cruce"></label>
            <label>Sexo
              <select v-model="quick.sex">
                <option value="UNKNOWN">No especificado</option>
                <option value="MALE">Macho</option>
                <option value="FEMALE">Hembra</option>
              </select>
            </label>
            <label>Edad<input v-model="quick.age" placeholder="Ej. 2 anos"></label>
            <label>Peso kg<input v-model.number="quick.weightKg" type="number" min="0" step="0.01" placeholder="Ej. 8.5"></label>
          </template>

          <label>Fecha y hora<input v-model="quick.scheduledAt" required type="datetime-local"></label>
          <label>Motivo<textarea v-model="quick.reason" required placeholder="Motivo de consulta"></textarea></label>
          <button :disabled="saving">{{ saving ? 'Guardando...' : quickMode==='new' ? 'Guardar cliente, mascota y cita' : 'Guardar nueva cita' }}</button>
        </form>

        <div v-if="selectedAppointment" class="detail-box">
          <span class="badge">Detalle</span>
          <h3>{{ selectedAppointment.pet?.name || 'Mascota' }}</h3>
          <p><b>Cliente:</b> {{ selectedAppointment.client?.fullName || '-' }}</p>
          <p><b>Contacto:</b> {{ selectedAppointment.client?.phone || selectedAppointment.client?.email || '-' }}</p>
          <p><b>Hora:</b> {{ formatTime(selectedAppointment.scheduledAt) }}</p>
          <p><b>Motivo:</b> {{ selectedAppointment.reason }}</p>
          <p><b>Estado:</b> {{ statusLabel(selectedAppointment.status) }}</p>
          <div class="detail-actions">
            <button v-if="selectedAppointment.status==='PENDING'" class="small" @click="setStatus(selectedAppointment,'CONFIRMED')">Confirmar</button>
            <button v-if="selectedAppointment.status==='CONFIRMED'" class="small secondary" @click="setStatus(selectedAppointment,'WAITING')">En espera</button>
            <button v-if="['CONFIRMED','WAITING'].includes(selectedAppointment.status)" class="small secondary" @click="setStatus(selectedAppointment,'IN_CONSULTATION')">En consulta</button>
            <button v-if="selectedAppointment.status!=='CANCELLED'" class="small secondary" @click="setStatus(selectedAppointment,'CANCELLED')">Cancelar</button>
            <button v-if="selectedAppointment.status==='CANCELLED'" class="small" @click="setStatus(selectedAppointment,'PENDING')">Reactivar</button>
          </div>
        </div>
      </section>
    </div>

    <div v-else class="panel-grid">
      <section class="glass-card">
        <h2>Clientes y mascotas</h2>
        <p class="muted-text">Busca clientes para atender llamadas, WhatsApp o consultas rapidas.</p>
        <input v-model="search" class="search-field" placeholder="Buscar cliente, telefono, correo o mascota">
        <table>
          <thead><tr><th>Cliente</th><th>Contacto</th><th>Mascotas</th></tr></thead>
          <tbody>
            <tr v-if="!filteredClients.length"><td colspan="3" class="empty">No hay clientes registrados todavia.</td></tr>
            <tr v-for="client in filteredClients" :key="client.id"><td>{{ client.fullName }}</td><td>{{ client.phone || client.email || '-' }}</td><td>{{ client.pets?.map(p => p.name).join(', ') || '-' }}</td></tr>
          </tbody>
        </table>
      </section>
    </div>
  </ReceptionLayout>
</template>
