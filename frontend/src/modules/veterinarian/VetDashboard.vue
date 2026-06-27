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
const patientSearch = ref(null);
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

const visibleAppointments = computed(() => appointments.value.filter(a => ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'].includes(a.status)));
const todayAppointments = computed(() => appointments.value.filter(a => a.scheduledAt?.slice(0, 10) === new Date().toISOString().slice(0, 10)));
const activePatients = computed(() => new Set(appointments.value.filter(a => a.status !== 'CANCELLED').map(a => a.petId)).size);
const attendedCount = computed(() => appointments.value.filter(a => a.status === 'ATTENDED').length);
const filteredPets = computed(() => pets.value.filter(pet => {
  const text = `${pet.name || ''} ${pet.species || ''} ${pet.breed || ''} ${pet.client?.fullName || ''}`.toLowerCase();
  return text.includes(petSearch.value.toLowerCase());
}).slice(0, 8));
const selectedPet = computed(() => selected.value?.pet || selectedStandalonePet.value);
const selectedClient = computed(() => selected.value?.client || selectedStandalonePet.value?.client);
const selectedProduct = computed(() => products.value.find(product => product.id === prescription.value.productId));

function formatDate(value) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos dias';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
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

function escapeHtml(value) {
  return String(value ?? '-').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function generatePrescriptionPdf() {
  if (!selectedPet.value) {
    error.value = 'Selecciona un paciente antes de generar la receta.';
    return;
  }

  const prescriptionRows = selectedProduct.value
    ? `
      <tr>
        <td>${escapeHtml(selectedProduct.value.name)}</td>
        <td>${escapeHtml(prescription.value.quantity || 1)}</td>
        <td>${escapeHtml(prescription.value.dosage || '-')}</td>
        <td>${escapeHtml(prescription.value.instructions || '-')}</td>
      </tr>
    `
    : '<tr><td colspan="4">Sin medicamento seleccionado. Completar indicaciones manuales si corresponde.</td></tr>';

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    error.value = 'El navegador bloqueo la ventana de impresion. Permite ventanas emergentes para generar el PDF.';
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Receta - ${escapeHtml(selectedPet.value.name || 'Paciente')}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#172522;margin:36px}
          .header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #155b66;padding-bottom:18px;margin-bottom:22px}
          .brand{font-size:30px;font-weight:800;color:#155b66}
          .muted{color:#66736f}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;margin:18px 0}
          .box{border:1px solid #d9e8e3;border-radius:12px;padding:14px;margin:14px 0}
          h1,h2{margin:0 0 10px}
          table{width:100%;border-collapse:collapse;margin-top:10px}
          th,td{border-bottom:1px solid #d9e8e3;text-align:left;padding:10px;vertical-align:top}
          .signature{margin-top:64px;text-align:right}
          .signature span{display:inline-block;border-top:1px solid #172522;padding:10px 42px 0}
          @media print{button{display:none}body{margin:24px}}
        </style>
      </head>
      <body>
        <section class="header">
          <div>
            <div class="brand">Happy Dog</div>
            <div class="muted">Receta veterinaria</div>
          </div>
          <div>
            <strong>Fecha:</strong> ${escapeHtml(formatDate(new Date()))}<br>
            <strong>Veterinario:</strong> ${escapeHtml(auth.user?.fullName || 'Doctor veterinario')}
          </div>
        </section>

        <section class="box">
          <h2>Paciente</h2>
          <div class="grid">
            <div><strong>Mascota:</strong> ${escapeHtml(selectedPet.value.name || '-')}</div>
            <div><strong>Especie:</strong> ${escapeHtml(selectedPet.value.species || '-')}</div>
            <div><strong>Raza:</strong> ${escapeHtml(selectedPet.value.breed || '-')}</div>
            <div><strong>Dueno:</strong> ${escapeHtml(selectedClient.value?.fullName || '-')}</div>
            <div><strong>Peso actual:</strong> ${escapeHtml(form.value.weightKg || selectedPet.value.weightKg || '-')} kg</div>
            <div><strong>Temperatura:</strong> ${escapeHtml(form.value.temperatureC || '-')} C</div>
          </div>
        </section>

        <section class="box">
          <h2>Evaluacion</h2>
          <p><strong>Motivo:</strong> ${escapeHtml(form.value.reason || selected.value?.reason || '-')}</p>
          <p><strong>Diagnostico:</strong> ${escapeHtml(form.value.diagnosis || '-')}</p>
          <p><strong>Evolucion / tratamiento:</strong> ${escapeHtml(form.value.treatment || '-')}</p>
          <p><strong>Observaciones:</strong> ${escapeHtml(form.value.observations || '-')}</p>
        </section>

        <section class="box">
          <h2>Medicacion indicada</h2>
          <table>
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Dosis</th><th>Indicaciones</th></tr></thead>
            <tbody>${prescriptionRows}</tbody>
          </table>
        </section>

        <div class="signature"><span>Firma y sello</span></div>
        <script>window.onload=function(){window.print()}<\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
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

    <section class="doctor-hero glass-card">
      <div>
        <span class="badge">Consultorio</span>
        <h2>{{ greeting() }}, {{ auth.user?.fullName || 'Doctor' }}</h2>
        <p class="muted-text">Gestiona tus atenciones del dia, revisa pacientes y registra historias clinicas desde un solo lugar.</p>
      </div>
      <div class="doctor-stats">
        <div><span>Citas hoy</span><strong>{{ todayAppointments.length }}</strong></div>
        <div><span>Pacientes activos</span><strong>{{ activePatients }}</strong></div>
        <div><span>Atenciones cerradas</span><strong>{{ attendedCount }}</strong></div>
      </div>
    </section>

    <section class="quick-actions glass-card">
      <div class="section-title">
        <div>
          <span class="badge">Accesos rapidos</span>
          <h2>Trabajo clinico</h2>
        </div>
      </div>
      <div class="quick-action-grid">
        <button @click="petSearch=''; selected=null; selectedStandalonePet=null">Ver citas listas</button>
        <button class="secondary" @click="$router.push('/veterinario/cuenta')">Mi cuenta</button>
      </div>
    </section>

    <div class="clinical-grid">
      <section class="glass-card appointment-list">
        <div class="section-title">
          <span class="badge">Agenda</span>
          <h2>{{ petSearch ? 'Pacientes encontrados' : 'Citas listas para atender' }}</h2>
        </div>
        <p class="muted-text">{{ petSearch ? 'Estos pacientes existen en el sistema. Selecciona uno para revisar historial o emitir una receta desde su ficha.' : 'Aqui aparecen citas confirmadas, en espera o en consulta. Cuando guardas el registro medico, la cita pasa a Atendida y sale de esta lista.' }}</p>
        <input ref="patientSearch" v-model="petSearch" class="search-field" placeholder="Buscar paciente en historial">
        <div v-if="petSearch" class="patient-search-results">
          <button v-for="pet in filteredPets" :key="pet.id" class="appointment-item" @click="selectPet(pet)">
            <strong>{{ pet.name }}</strong>
            <span>{{ pet.client?.fullName || 'Sin dueno' }}</span>
            <small>{{ pet.species }} {{ pet.breed ? '- ' + pet.breed : '' }}</small>
          </button>
          <p v-if="!filteredPets.length" class="empty">No se encontraron pacientes con esa busqueda.</p>
        </div>
        <p v-if="loading" class="muted-text">Cargando citas...</p>
        <p v-else-if="!petSearch && !visibleAppointments.length" class="empty">No hay citas listas para atender ahora. Recepcion debe confirmar o pasar una cita a consulta. Si ya guardaste el registro medico, esa cita ya quedo Atendida.</p>
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
            <div class="prescription-head">
              <div>
                <h3>Receta / inventario</h3>
                <p class="muted-text">Selecciona medicamento, dosis e indicaciones para entregarlo como PDF.</p>
              </div>
              <button class="secondary small" type="button" @click="generatePrescriptionPdf">{{ selectedPet ? 'Generar Receta en PDF' : 'Selecciona paciente para PDF' }}</button>
            </div>
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
          <p v-if="record.weightKg || record.temperatureC"><b>Control:</b> {{ record.weightKg ? record.weightKg + ' kg' : '' }} {{ record.temperatureC ? ' · ' + record.temperatureC + ' C' : '' }}</p>
          <p><b>Diagnostico:</b> {{ record.diagnosis }}</p>
          <p v-if="record.treatment"><b>Tratamiento:</b> {{ record.treatment }}</p>
          <p v-if="record.observations"><b>Observaciones:</b> {{ record.observations }}</p>
          <p v-if="record.prescriptions?.length"><b>Receta:</b> {{ record.prescriptions.map(i => `${i.product?.name || 'Producto'} x${i.quantity}`).join(', ') }}</p>
        </article>
      </section>
    </div>
  </VeterinarianLayout>
</template>
