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
const examOptions = [
  { key: 'ecografia', label: 'Ecografía' },
  { key: 'rayosX', label: 'Rayos X' },
  { key: 'hemograma', label: 'Hemograma' },
  { key: 'test', label: 'Test' },
  { key: 'heces', label: 'Examen de heces' },
  { key: 'orina', label: 'Examen de orina' },
  { key: 'tgoTgpFas', label: 'TGO, TGP y FAS' },
  { key: 'citologia', label: 'Citología' },
  { key: 'raspadoPiel', label: 'Raspado de piel' },
  { key: 'ureaCrea', label: 'Urea y crea' },
  { key: 'otros', label: 'Otros' },
];

function emptyExams() {
  return examOptions.reduce((acc, option) => ({ ...acc, [option.key]: false }), {});
}

const form = ref({
  reason: '',
  weightKg: null,
  temperatureC: null,
  fc: '',
  fr: '',
  mucosas: '',
  anamnesis: '',
  presumptiveDx: '',
  definitiveDx: '',
  prognosis: '',
  exams: emptyExams(),
  examOther: '',
  treatment: '',
  frequency: '',
  recommendations: '',
  nextControlAt: '',
});

const readyStatuses = ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'];
const visibleAppointments = computed(() => appointments.value.filter(a => readyStatuses.includes(a.status)));
const pendingAppointments = computed(() => appointments.value
  .filter(a => a.status === 'PENDING')
  .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  .slice(0, 5));
const todayAppointments = computed(() => appointments.value.filter(a => dateKey(a.scheduledAt) === dateKey()));
const attendedCount = computed(() => appointments.value.filter(a => a.status === 'ATTENDED').length);
const filteredPets = computed(() => pets.value.filter(pet => {
  const text = `${pet.name || ''} ${pet.species || ''} ${pet.breed || ''} ${pet.client?.fullName || ''}`.toLowerCase();
  return text.includes(petSearch.value.toLowerCase());
}).slice(0, 8));
const selectedPet = computed(() => selected.value?.pet || selectedStandalonePet.value);
const selectedClient = computed(() => selected.value?.client || selectedStandalonePet.value?.client);
const selectedProduct = computed(() => products.value.find(product => product.id === prescription.value.productId));

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

function sexLabel(sex) {
  const labels = {
    MALE: 'Macho',
    FEMALE: 'Hembra',
    UNKNOWN: 'No especificado',
  };
  return labels[sex] || 'No especificado';
}

function resetForm(appointment) {
  form.value = {
    reason: appointment?.reason || '',
    weightKg: appointment?.pet?.weightKg ?? null,
    temperatureC: null,
    fc: '',
    fr: '',
    mucosas: '',
    anamnesis: '',
    presumptiveDx: '',
    definitiveDx: '',
    prognosis: '',
    exams: emptyExams(),
    examOther: '',
    treatment: '',
    frequency: '',
    recommendations: '',
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
    error.value = 'No se pudo iniciar la atención.';
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

function checkedExams() {
  return examOptions
    .filter(option => form.value.exams?.[option.key])
    .map(option => option.label);
}

function buildDiagnosisText() {
  const diagnosis = [
    form.value.presumptiveDx && `DX presuntivo: ${form.value.presumptiveDx}`,
    form.value.definitiveDx && `DX definitivo: ${form.value.definitiveDx}`,
  ].filter(Boolean).join('\n');
  return diagnosis || '';
}

function buildTreatmentText() {
  return [
    form.value.treatment && `Tratamiento: ${form.value.treatment}`,
    form.value.frequency && `Frecuencia: ${form.value.frequency}`,
    form.value.recommendations && `Recomendaciones: ${form.value.recommendations}`,
  ].filter(Boolean).join('\n');
}

function buildObservationNotes() {
  const exams = checkedExams();
  return [
    form.value.fc && `FC: ${form.value.fc}`,
    form.value.fr && `FR: ${form.value.fr}`,
    form.value.mucosas && `Mucosas: ${form.value.mucosas}`,
    form.value.anamnesis && `Anamnesis: ${form.value.anamnesis}`,
    exams.length && `Exámenes complementarios: ${exams.join(', ')}`,
    form.value.examOther && `Otros exámenes: ${form.value.examOther}`,
    form.value.prognosis && `Pronóstico: ${form.value.prognosis}`,
    form.value.nextControlAt && `Próximo control: ${formatDate(form.value.nextControlAt)}`,
  ].filter(Boolean).join('\n');
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
    error.value = 'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para generar el PDF.';
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
            <div><strong>Dueño:</strong> ${escapeHtml(selectedClient.value?.fullName || '-')}</div>
            <div><strong>Peso actual:</strong> ${escapeHtml(form.value.weightKg || selectedPet.value.weightKg || '-')} kg</div>
            <div><strong>Temperatura:</strong> ${escapeHtml(form.value.temperatureC || '-')} C</div>
          </div>
        </section>

        <section class="box">
          <h2>Evaluación</h2>
          <p><strong>Motivo:</strong> ${escapeHtml(form.value.reason || selected.value?.reason || '-')}</p>
          <p><strong>Diagnóstico:</strong> ${escapeHtml(buildDiagnosisText() || '-')}</p>
          <p><strong>Evolución / tratamiento:</strong> ${escapeHtml(buildTreatmentText() || '-')}</p>
          <p><strong>Observaciones:</strong> ${escapeHtml(buildObservationNotes() || '-')}</p>
        </section>

        <section class="box">
          <h2>Medicación indicada</h2>
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
  const diagnosis = buildDiagnosisText();
  if (!diagnosis) {
    error.value = 'Completa al menos un diagnóstico presuntivo o definitivo.';
    return;
  }
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
      diagnosis,
      treatment: buildTreatmentText(),
      observations: buildObservationNotes(),
      nextControlAt: form.value.nextControlAt || undefined,
      prescriptions: buildPrescriptions(),
    });
    success.value = 'Atención guardada. La cita pasó a atendida y el historial fue actualizado.';
    await loadData();
    if (selected.value?.petId) history.value = (await api.get(`/medical-records/pet/${selected.value.petId}`)).data;
  } catch (e) {
    error.value = e.response?.status === 403
      ? 'Tu sesión no tiene permiso para guardar historias clínicas. Cierra sesión y entra nuevamente con la cuenta del doctor.'
      : e.response?.data?.message || 'No se pudo guardar la atención.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <VeterinarianLayout title="Doctor Veterinario" subtitle="Citas, pacientes, historial clínico y receta">
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
        <p class="muted-text">Gestiona tus atenciones del día, revisa pacientes y registra historias clínicas desde un solo lugar.</p>
      </div>
      <div class="doctor-stats">
        <div><span>Citas hoy</span><strong>{{ todayAppointments.length }}</strong></div>
        <div><span>Listas para atender</span><strong>{{ visibleAppointments.length }}</strong></div>
        <div><span>Atenciones cerradas</span><strong>{{ attendedCount }}</strong></div>
      </div>
    </section>

    <div class="clinical-grid">
      <section class="glass-card appointment-list">
        <div class="section-title">
          <span class="badge">Agenda</span>
          <h2>Citas listas para atender</h2>
        </div>
        <p class="muted-text">Recepción envía aquí las citas confirmadas, en espera o en consulta.</p>
        <p v-if="loading" class="muted-text">Cargando citas...</p>
        <div v-else-if="!visibleAppointments.length" class="empty-state">
          <strong>Sin citas por atender ahora</strong>
          <span>Cuando recepción confirme una cita, aparecerá en esta lista.</span>
        </div>
        <div v-if="!visibleAppointments.length && pendingAppointments.length" class="pending-note">
          <strong>{{ pendingAppointments.length }} cita{{ pendingAppointments.length === 1 ? '' : 's' }} pendiente{{ pendingAppointments.length === 1 ? '' : 's' }} de recepción</strong>
          <span>Existen solicitudes registradas, pero todavía no están confirmadas para atención médica.</span>
          <article
            v-for="appointment in pendingAppointments"
            :key="appointment.id"
            class="appointment-item pending-preview"
          >
            <strong>{{ appointment.pet?.name || 'Mascota sin nombre' }}</strong>
            <span>{{ appointment.client?.fullName || 'Cliente sin nombre' }}</span>
            <small>{{ formatDate(appointment.scheduledAt) }} - {{ statusLabel(appointment.status) }}</small>
          </article>
        </div>

        <button
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

        <div class="history-search-card">
          <span class="badge">Historial</span>
          <h3>Buscar paciente</h3>
          <p class="muted-text">Para revisar antecedentes, recetas anteriores o atender sin cita activa.</p>
          <input ref="patientSearch" v-model="petSearch" class="search-field" placeholder="Nombre de mascota o dueño">
          <div v-if="petSearch" class="patient-search-results">
            <button v-for="pet in filteredPets" :key="pet.id" class="appointment-item" @click="selectPet(pet)">
              <strong>{{ pet.name }}</strong>
              <span>{{ pet.client?.fullName || 'Sin dueño' }}</span>
              <small>{{ pet.species }} {{ pet.breed ? '- ' + pet.breed : '' }}</small>
            </button>
            <p v-if="!filteredPets.length" class="empty">No se encontraron pacientes.</p>
          </div>
        </div>
      </section>

      <section class="glass-card patient-card">
        <div class="section-title">
          <span class="badge">Paciente</span>
          <h2>{{ selectedPet?.name || 'Ficha del paciente' }}</h2>
        </div>
        <div v-if="!selectedPet" class="empty-state patient-empty">
          <strong>Selecciona una cita o un paciente</strong>
          <span>La ficha, historial y receta se activan cuando eliges una mascota.</span>
        </div>
        <div v-if="selectedPet" class="patient-grid">
          <div><span>Especie</span><strong>{{ selectedPet?.species || '-' }}</strong></div>
          <div><span>Raza</span><strong>{{ selectedPet?.breed || '-' }}</strong></div>
          <div><span>Sexo</span><strong>{{ sexLabel(selectedPet?.sex) }}</strong></div>
          <div><span>Edad</span><strong>{{ selectedPet?.age || '-' }}</strong></div>
          <div><span>Peso</span><strong>{{ selectedPet?.weightKg || '-' }} kg</strong></div>
          <div><span>Dueño</span><strong>{{ selectedClient?.fullName || '-' }}</strong></div>
          <div><span>Teléfono</span><strong>{{ selectedClient?.phone || '-' }}</strong></div>
          <div><span>Motivo</span><strong>{{ selected?.reason || 'Revisión de historial' }}</strong></div>
        </div>
        <button v-if="selected && selected.status !== 'IN_CONSULTATION'" class="secondary full" @click="startConsultation">Iniciar atención</button>
      </section>
    </div>

    <div class="clinical-grid main">
      <section class="glass-card">
        <div class="section-title">
          <span class="badge">Nueva atención</span>
          <h2>{{ selectedPet ? 'Registro médico' : 'Iniciar registro médico' }}</h2>
        </div>
        <div v-if="!selectedPet" class="empty-state medical-empty">
          <strong>Elige primero una mascota</strong>
          <span>Selecciona una cita lista o busca un paciente para activar el registro, la receta y el historial.</span>
        </div>
        <form v-else class="medical-form" @submit.prevent="saveRecord">
          <section class="clinical-sheet">
            <div class="sheet-top">
              <div class="sheet-code">FECHA: {{ dateKey() }}</div>
              <div class="sheet-brand">
                <strong>Happy Dog</strong>
                <span>Clínica veterinaria</span>
              </div>
              <div class="sheet-code">CÓDIGO: {{ selectedPet?.id?.slice(0, 8).toUpperCase() }}</div>
            </div>

            <h3 class="sheet-title">Historia clínica</h3>
            <div class="sheet-subtitle">Datos del propietario</div>
            <div class="clinical-table owner-grid">
              <div><span>Nombre:</span><strong>{{ selectedClient?.fullName || '-' }}</strong></div>
              <div><span>Telf:</span><strong>{{ selectedClient?.phone || '-' }}</strong></div>
              <div><span>Dirección:</span><strong>{{ selectedClient?.address || '-' }}</strong></div>
              <div><span>DNI:</span><strong>{{ selectedClient?.dni || '-' }}</strong></div>
            </div>

            <div class="sheet-subtitle">Datos de la mascota</div>
            <div class="clinical-table pet-grid">
              <div><span>Nombre:</span><strong>{{ selectedPet?.name || '-' }}</strong></div>
              <div><span>Especie:</span><strong>{{ selectedPet?.species || '-' }}</strong></div>
              <div><span>Raza:</span><strong>{{ selectedPet?.breed || '-' }}</strong></div>
              <div><span>Sexo:</span><strong>{{ sexLabel(selectedPet?.sex) }}</strong></div>
              <div><span>Edad:</span><strong>{{ selectedPet?.age || '-' }}</strong></div>
              <div><span>Peso base:</span><strong>{{ selectedPet?.weightKg || '-' }} kg</strong></div>
              <div><span>Color:</span><strong>{{ selectedPet?.color || '-' }}</strong></div>
              <div><span>Esterilizado:</span><strong>{{ selectedPet?.sterilized ? 'Sí' : 'No' }}</strong></div>
              <div><span>Procedencia:</span><strong>-</strong></div>
            </div>

            <div class="vitals-grid">
              <label>Motivo<input v-model="form.reason" required placeholder="Motivo de consulta"></label>
              <label>Fecha<input v-model="form.nextControlAt" type="datetime-local"></label>
              <label>Peso<input v-model.number="form.weightKg" type="number" step="0.01" placeholder="kg"></label>
              <label>T°<input v-model.number="form.temperatureC" type="number" step="0.1" placeholder="C"></label>
              <label>FC<input v-model="form.fc" placeholder="lpm"></label>
              <label>FR<input v-model="form.fr" placeholder="rpm"></label>
              <label>Mucosas<input v-model="form.mucosas" placeholder="Rosadas, pálidas..."></label>
            </div>

            <label class="clinical-line tall">
              <span>Anamnesis</span>
              <textarea v-model="form.anamnesis" placeholder="Qué comenta el dueño, evolución, apetito, ánimo, vómitos, diarrea, etc."></textarea>
            </label>

            <div class="exam-section">
              <span class="clinical-label">Exámenes complementarios</span>
              <label v-for="option in examOptions" :key="option.key" class="exam-option">
                <input v-model="form.exams[option.key]" type="checkbox">
                <span>{{ option.label }}</span>
              </label>
              <input v-model="form.examOther" class="exam-other" placeholder="Detalle de otros exámenes">
            </div>

            <div class="diagnosis-grid">
              <label>DX presuntivo<textarea v-model="form.presumptiveDx" placeholder="Diagnóstico presuntivo"></textarea></label>
              <label>DX definitivo<textarea v-model="form.definitiveDx" placeholder="Diagnóstico definitivo"></textarea></label>
              <label>Pronóstico<textarea v-model="form.prognosis" placeholder="Reservado, favorable..."></textarea></label>
            </div>

            <label class="clinical-line tall">
              <span>Tratamiento</span>
              <textarea v-model="form.treatment" placeholder="Procedimientos, medicación aplicada y evolución durante consulta"></textarea>
            </label>

            <div class="frequency-row">
              <label>Frecuencia<input v-model="form.frequency" placeholder="Cada 12 h, cada 24 h, por 5 días..."></label>
              <label>Recomendaciones<textarea v-model="form.recommendations" placeholder="Cuidados en casa, dieta, reposo, señales de alerta"></textarea></label>
            </div>

            <div class="doctor-sign">Médico: {{ auth.user?.fullName || 'Doctor veterinario' }}</div>
          </section>

          <section v-if="false" class="medical-section">
            <div class="section-title compact">
              <div>
                <span class="badge">Signos</span>
                <h3>Datos actuales</h3>
              </div>
            </div>
            <div class="form-grid compact-grid">
              <input v-model.number="form.weightKg" type="number" step="0.01" placeholder="Peso kg">
              <input v-model.number="form.temperatureC" type="number" step="0.1" placeholder="Temperatura C">
              <input v-model="form.nextControlAt" type="datetime-local" placeholder="Próximo control">
            </div>
          </section>

          <section v-if="false" class="medical-section">
            <div class="section-title compact">
              <div>
                <span class="badge">Consulta</span>
                <h3>Evaluación médica</h3>
              </div>
            </div>
            <div class="form-grid">
              <input v-model="form.reason" required placeholder="Motivo de consulta">
              <textarea v-model="form.diagnosis" required placeholder="Diagnóstico"></textarea>
              <textarea v-model="form.treatment" placeholder="Tratamiento / evolución"></textarea>
              <textarea v-model="form.observations" placeholder="Observaciones"></textarea>
            </div>
          </section>

          <section class="prescription-box">
            <div class="prescription-head">
              <div>
                <h3>Receta / inventario</h3>
                <p class="muted-text">Selecciona medicamento, dosis e indicaciones para entregarlo como PDF.</p>
              </div>
              <button class="secondary small" type="button" @click="generatePrescriptionPdf">Generar Receta en PDF</button>
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
          </section>

          <button :disabled="!selected || saving">{{ saving ? 'Guardando...' : selected ? 'Guardar atención' : 'Selecciona una cita para guardar atención' }}</button>
          <p v-if="!selected" class="muted-text">Puedes revisar historial y generar receta al buscar un paciente, pero para guardar una atención necesitas una cita seleccionada.</p>
        </form>
      </section>

      <section class="glass-card history-panel">
        <div class="section-title">
          <span class="badge">Historial</span>
          <h2>Consultas anteriores</h2>
        </div>
        <p v-if="!selectedPet" class="empty">Selecciona una cita o busca un paciente para ver el historial.</p>
        <p v-else-if="!history.length" class="empty">Esta mascota aún no tiene historial clínico.</p>
        <article v-for="record in history" :key="record.id" class="history-item">
          <div>
            <strong>{{ formatDate(record.visitDate) }}</strong>
            <span>{{ record.veterinarian?.fullName || 'Veterinario' }}</span>
          </div>
          <p><b>Motivo:</b> {{ record.reason }}</p>
          <p v-if="record.weightKg || record.temperatureC"><b>Control:</b> {{ record.weightKg ? record.weightKg + ' kg' : '' }} {{ record.temperatureC ? ' · ' + record.temperatureC + ' C' : '' }}</p>
          <p><b>Diagnóstico:</b> {{ record.diagnosis }}</p>
          <p v-if="record.treatment"><b>Tratamiento:</b> {{ record.treatment }}</p>
          <p v-if="record.observations"><b>Observaciones:</b> {{ record.observations }}</p>
          <p v-if="record.prescriptions?.length"><b>Receta:</b> {{ record.prescriptions.map(i => `${i.product?.name || 'Producto'} x${i.quantity}`).join(', ') }}</p>
        </article>
      </section>
    </div>
  </VeterinarianLayout>
</template>
