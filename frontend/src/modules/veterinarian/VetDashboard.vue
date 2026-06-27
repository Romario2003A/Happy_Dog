<script setup>
import { computed, onMounted, ref } from 'vue';
import VeterinarianLayout from '../../layouts/VeterinarianLayout.vue';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const appointments = ref([]);
const history = ref([]);
const products = ref([]);
const pets = ref([]);
const selected = ref(null);
const selectedStandalonePet = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const petSearch = ref('');
const prescription = ref({ productId: '', quantity: 1, dosage: '', instructions: '' });
const form = ref({
  reason: '',
  weightKg: null,
  temperatureC: null,
  diagnosis: '',
  treatment: '',
  observations: '',
  nextControlAt: '',
});

const visibleAppointments = computed(() => appointments.value.filter(a => a.status !== 'ATTENDED' && a.status !== 'CANCELLED'));
const filteredPets = computed(() => pets.value.filter(pet => {
  const text = `${pet.name || ''} ${pet.species || ''} ${pet.breed || ''} ${pet.client?.fullName || ''}`.toLowerCase();
  return text.includes(petSearch.value.toLowerCase());
}).slice(0, 8));
const selectedPet = computed(() => selected.value?.pet || selectedStandalonePet.value);
const selectedClient = computed(() => selected.value?.client || selectedStandalonePet.value?.client);

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
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

function resetForm(appointment) {
  form.value = {
    reason: appointment?.reason || '',
    weightKg: appointment?.pet?.weightKg ?? null,
    temperatureC: null,
    diagnosis: '',
    treatment: '',
    observations: '',
    nextControlAt: '',
  };
  prescription.value = { productId: '', quantity: 1, dosage: '', instructions: '' };
  success.value = '';
  error.value = '';
}

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [appointmentsRes, productsRes, petsRes] = await Promise.all([
      api.get('/appointments'),
      api.get('/inventory'),
      api.get('/pets'),
    ]);
    appointments.value = appointmentsRes.data;
    products.value = productsRes.data.filter(p => p.active !== false);
    pets.value = petsRes.data;
    if (!selected.value && visibleAppointments.value.length) await selectAppointment(visibleAppointments.value[0]);
  } catch (e) {
    error.value = 'No se pudieron cargar las citas del doctor.';
  } finally {
    loading.value = false;
  }
}

async function selectAppointment(appointment) {
  selected.value = appointment;
  selectedStandalonePet.value = null;
  resetForm(appointment);
  history.value = [];
  if (!appointment?.petId) return;
  try {
    history.value = (await api.get(`/medical-records/pet/${appointment.petId}`)).data;
  } catch (e) {
    error.value = 'No se pudo cargar el historial de la mascota.';
  }
}

async function selectPet(pet) {
  selected.value = null;
  selectedStandalonePet.value = pet;
  resetForm({ pet, reason: '' });
  history.value = [];
  try {
    history.value = (await api.get(`/medical-records/pet/${pet.id}`)).data;
  } catch (e) {
    error.value = 'No se pudo cargar el historial de la mascota.';
  }
}

async function startConsultation() {
  if (!selected.value) return;
  try {
    const { data } = await api.patch(`/appointments/${selected.value.id}`, { status: 'IN_CONSULTATION' });
    selected.value = data;
    appointments.value = appointments.value.map(a => a.id === data.id ? data : a);
  } catch (e) {
    error.value = 'No se pudo iniciar la atencion.';
  }
}

function buildPrescriptions() {
  if (!prescription.value.productId) return [];
  return [{
    productId: prescription.value.productId,
    quantity: Number(prescription.value.quantity || 1),
    dosage: prescription.value.dosage,
    instructions: prescription.value.instructions,
  }];
}

async function saveRecord() {
  if (!selected.value) return;
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/medical-records', {
      appointmentId: selected.value.id,
      petId: selected.value.petId,
      veterinarianId: auth.user.id,
      reason: form.value.reason,
      weightKg: form.value.weightKg === null || form.value.weightKg === '' ? undefined : Number(form.value.weightKg),
      temperatureC: form.value.temperatureC === null || form.value.temperatureC === '' ? undefined : Number(form.value.temperatureC),
      diagnosis: form.value.diagnosis,
      treatment: form.value.treatment,
      observations: form.value.observations,
      nextControlAt: form.value.nextControlAt || undefined,
      prescriptions: buildPrescriptions(),
    });
    success.value = 'Atencion guardada. La cita paso a atendida y el historial fue actualizado.';
    await loadData();
    if (selected.value?.petId) history.value = (await api.get(`/medical-records/pet/${selected.value.petId}`)).data;
  } catch (e) {
    error.value = e.response?.status === 403
      ? 'Tu sesion no tiene permiso para guardar historias clinicas. Cierra sesion y entra nuevamente con la cuenta del doctor.'
      : e.response?.data?.message || 'No se pudo guardar la atencion.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <VeterinarianLayout title="Doctor Veterinario" subtitle="Citas, pacientes, historial clinico y receta">
    <template #nav>
      <button @click="loadData">Actualizar</button>
      <button @click="$router.push('/veterinario/cuenta')">Mi cuenta</button>
    </template>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div class="clinical-grid">
      <section class="glass-card appointment-list">
        <div class="section-title">
          <span class="badge">Agenda</span>
          <h2>{{ petSearch ? 'Resultados de pacientes' : 'Citas pendientes' }}</h2>
        </div>
        <input v-model="petSearch" class="search-field" placeholder="Buscar paciente o dueno">
        <div v-if="petSearch" class="patient-search-results">
          <button v-for="pet in filteredPets" :key="pet.id" class="appointment-item" @click="selectPet(pet)">
            <strong>{{ pet.name }}</strong>
            <span>{{ pet.client?.fullName || 'Sin dueno' }}</span>
            <small>{{ pet.species }} {{ pet.breed ? '- ' + pet.breed : '' }}</small>
          </button>
          <p v-if="!filteredPets.length" class="empty">No se encontraron pacientes con esa busqueda.</p>
        </div>
        <p v-if="loading" class="muted-text">Cargando citas...</p>
        <p v-else-if="!petSearch && !visibleAppointments.length" class="empty">No hay citas pendientes para atender. Puedes buscar un paciente para revisar su historial.</p>
        <button
          v-if="!petSearch"
          v-for="appointment in visibleAppointments"
          :key="appointment.id"
          class="appointment-item"
          :class="{ active: selected?.id === appointment.id }"
          @click="selectAppointment(appointment)"
        >
          <strong>{{ appointment.pet?.name || 'Mascota sin nombre' }}</strong>
          <span>{{ appointment.client?.fullName || 'Cliente sin nombre' }}</span>
          <small>{{ formatDate(appointment.scheduledAt) }} - {{ statusLabel(appointment.status) }}</small>
        </button>
      </section>

      <section class="glass-card patient-card">
        <div class="section-title">
          <span class="badge">Paciente</span>
          <h2>{{ selectedPet?.name || 'Selecciona una cita o busca un paciente' }}</h2>
        </div>
        <div v-if="selectedPet" class="patient-grid">
          <div><span>Especie</span><strong>{{ selectedPet?.species || '-' }}</strong></div>
          <div><span>Raza</span><strong>{{ selectedPet?.breed || '-' }}</strong></div>
          <div><span>Sexo</span><strong>{{ selectedPet?.sex || '-' }}</strong></div>
          <div><span>Edad</span><strong>{{ selectedPet?.age || '-' }}</strong></div>
          <div><span>Peso</span><strong>{{ selectedPet?.weightKg || '-' }} kg</strong></div>
          <div><span>Dueno</span><strong>{{ selectedClient?.fullName || '-' }}</strong></div>
          <div><span>Telefono</span><strong>{{ selectedClient?.phone || '-' }}</strong></div>
          <div><span>Motivo</span><strong>{{ selected?.reason || 'Revision de historial' }}</strong></div>
        </div>
        <button v-if="selected && selected.status !== 'IN_CONSULTATION'" class="secondary full" @click="startConsultation">Iniciar atencion</button>
      </section>
    </div>

    <div class="clinical-grid main">
      <section class="glass-card">
        <div class="section-title">
          <span class="badge">Nueva atencion</span>
          <h2>Registro medico</h2>
        </div>
        <form class="form-grid" @submit.prevent="saveRecord">
          <input v-model="form.reason" required placeholder="Motivo de consulta">
          <input v-model.number="form.weightKg" type="number" step="0.01" placeholder="Peso kg">
          <input v-model.number="form.temperatureC" type="number" step="0.1" placeholder="Temperatura C">
          <input v-model="form.nextControlAt" type="datetime-local" placeholder="Proximo control">
          <textarea v-model="form.diagnosis" required placeholder="Diagnostico"></textarea>
          <textarea v-model="form.treatment" placeholder="Tratamiento"></textarea>
          <textarea v-model="form.observations" placeholder="Observaciones"></textarea>

          <div class="prescription-box">
            <h3>Receta / inventario</h3>
            <select v-model="prescription.productId">
              <option value="">Sin medicamento</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} - stock {{ product.stock }}
              </option>
            </select>
            <input v-model.number="prescription.quantity" type="number" min="1" placeholder="Cantidad">
            <input v-model="prescription.dosage" placeholder="Dosis">
            <input v-model="prescription.instructions" placeholder="Indicaciones">
          </div>

          <button :disabled="!selected || saving">{{ saving ? 'Guardando...' : selected ? 'Guardar atencion' : 'Selecciona una cita para atender' }}</button>
        </form>
      </section>

      <section class="glass-card history-panel">
        <div class="section-title">
          <span class="badge">Historial</span>
          <h2>Consultas anteriores</h2>
        </div>
        <p v-if="!selectedPet" class="empty">Selecciona una cita o busca un paciente para ver el historial.</p>
        <p v-else-if="!history.length" class="empty">Esta mascota aun no tiene historial clinico.</p>
        <article v-for="record in history" :key="record.id" class="history-item">
          <div>
            <strong>{{ formatDate(record.visitDate) }}</strong>
            <span>{{ record.veterinarian?.fullName || 'Veterinario' }}</span>
          </div>
          <p><b>Motivo:</b> {{ record.reason }}</p>
          <p><b>Diagnostico:</b> {{ record.diagnosis }}</p>
          <p v-if="record.treatment"><b>Tratamiento:</b> {{ record.treatment }}</p>
          <p v-if="record.observations"><b>Observaciones:</b> {{ record.observations }}</p>
          <p v-if="record.prescriptions?.length"><b>Receta:</b> {{ record.prescriptions.map(i => `${i.product?.name || 'Producto'} x${i.quantity}`).join(', ') }}</p>
        </article>
      </section>
    </div>
  </VeterinarianLayout>
</template>
