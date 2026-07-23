<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import VeterinarianLayout from '../../layouts/VeterinarianLayout.vue';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';

const auth = useAuthStore();
const appointments = ref([]);
const history = ref([]);
const preventiveRecords = ref([]);
const products = ref([]);
const pets = ref([]);
const selected = ref(null);
const selectedStandalonePet = ref(null);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
let automaticRefreshId = null;
let refreshInProgress = false;
const activeWorkspace = ref('agenda');
const consultationTab = ref('evaluation');
const taskChosen = ref(false);
const activeTask = ref('');
const consultationTabs = [
  { value: 'evaluation', label: 'Evaluación', help: 'Motivo y signos' },
  { value: 'diagnosis', label: 'Diagnóstico', help: 'Exámenes y hallazgos' },
  { value: 'plan', label: 'Plan médico', help: 'Tratamiento y control' },
];
const selectedDocuments = reactive({ prescription: false, clinicalHistory: false, surgeryConsent: false });
const preventiveForm = reactive({ type:'DEWORMING', appliedAt:dateKey(), productName:'', nextProductName:'', weightKg:null, amountCharged:null, nextAppointmentAt:'', sterilizationRecommended:false, notes:'' });
const preventiveSaving = ref(false);
const accountOpen = ref(false);
const accountLoading = ref(false);
const accountError = ref('');
const accountSuccess = ref('');
const accountForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' });
const petSearch = ref('');
const historySearch = ref('');
const expandedRecordId = ref(null);
const patientSearch = ref(null);
const prescription = ref({ productId: '', quantity: 1, dosage: '', instructions: '' });
const attentionType = ref('CONSULTATION');
const attentionTypes = [
  { value: 'CONSULTATION', label: 'Consulta', help: 'Evaluación, diagnóstico y tratamiento' },
  { value: 'VACCINE', label: 'Vacunación', help: 'Aplicación y próximo control' },
  { value: 'SURGERY', label: 'Cirugía', help: 'Incluye autorización quirúrgica' },
  { value: 'FOLLOW_UP', label: 'Control', help: 'Seguimiento o procedimiento médico' },
];
const surgeryConsent = reactive({
  ownerDni: '',
  ownerAddress: '',
  petAge: '',
  petColor: '',
  lastMeal: '',
  digestiveIssue: false,
  medicalCondition: false,
  medicalConditionDetail: '',
  medication: '',
  alternativeName: '',
  alternativePhone: '',
  staffNotes: '',
});
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
function isGroomingAppointment(appointment) {
  const text = `${appointment?.notes || ''} ${appointment?.service?.category || ''} ${appointment?.service?.name || ''} ${appointment?.reason || ''}`.toLowerCase();
  return ['baño', 'bano', 'corte', 'grooming', 'peluquer'].some(word => text.includes(word));
}
const visibleAppointments = computed(() => appointments.value.filter((appointment) => {
  if (!readyStatuses.includes(appointment.status) || isGroomingAppointment(appointment)) return false;
  const patientAlreadyArrived = ['WAITING', 'IN_CONSULTATION'].includes(appointment.status);
  return patientAlreadyArrived || dateKey(appointment.scheduledAt) === dateKey();
}));
const groomingAppointments = computed(() => appointments.value.filter(a => readyStatuses.includes(a.status) && isGroomingAppointment(a)));
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
const filteredHistory = computed(() => {
  const query = historySearch.value.trim().toLowerCase();
  if (!query) return history.value;
  return history.value.filter(record => [
    record.reason, record.diagnosis, record.treatment, record.observations,
    record.veterinarian?.fullName,
    ...(record.prescriptions || []).map(item => item.product?.name),
  ].filter(Boolean).join(' ').toLowerCase().includes(query));
});
const lastVisit = computed(() => history.value[0]?.visitDate || null);
const nextControl = computed(() => history.value.find(record => record.nextControlAt)?.nextControlAt || null);
const surgeryCode = computed(() => selectedPet.value?.id
  ? `CX-${String(selectedPet.value.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`
  : 'CX-00000000');

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

function lines(value) {
  return String(value || '').split('\n').map(line => line.trim()).filter(Boolean);
}

function fileUrl(url) {
  if (!url || /^https?:\/\//i.test(url)) return url || '#';
  return `${api.defaults.baseURL.replace(/\/api\/?$/, '')}${url.startsWith('/') ? '' : '/'}${url}`;
}

function toggleRecord(recordId) {
  expandedRecordId.value = expandedRecordId.value === recordId ? null : recordId;
}

function startClinicalTask(task) {
  activeTask.value = task;
  selectedDocuments.prescription = false;
  selectedDocuments.clinicalHistory = false;
  selectedDocuments.surgeryConsent = false;
  if (task === 'consultation') {
    attentionType.value = 'CONSULTATION';
    consultationTab.value = 'evaluation';
  } else if (task === 'prescription') {
    consultationTab.value = 'documents';
    selectedDocuments.prescription = true;
  } else if (task === 'preventive') {
    consultationTab.value = 'documents';
    selectedDocuments.clinicalHistory = true;
  } else if (task === 'history') {
    consultationTab.value = 'documents';
    selectedDocuments.clinicalHistory = true;
  } else if (task === 'surgery') {
    attentionType.value = 'SURGERY';
    consultationTab.value = 'documents';
    selectedDocuments.surgeryConsent = true;
  }
  taskChosen.value = true;
}

function returnToPatients() {
  activeWorkspace.value = 'agenda';
  taskChosen.value = false;
  activeTask.value = '';
}

function returnToPatientActions() {
  activeWorkspace.value = 'consultation';
  taskChosen.value = false;
  activeTask.value = '';
}

function goBackOneStep() {
  if (taskChosen.value || activeWorkspace.value === 'history') {
    returnToPatientActions();
    return;
  }
  returnToPatients();
}

async function changeAccountPassword() {
  accountError.value = '';
  accountSuccess.value = '';
  if (accountForm.value.newPassword !== accountForm.value.confirmPassword) {
    accountError.value = 'La nueva contraseña no coincide.';
    return;
  }
  accountLoading.value = true;
  try {
    const data = await auth.changePassword({
      currentPassword: accountForm.value.currentPassword,
      newPassword: accountForm.value.newPassword,
    });
    accountForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' };
    accountSuccess.value = data.message || 'Contraseña actualizada correctamente.';
  } catch (e) {
    accountError.value = e.response?.data?.message || 'No se pudo cambiar la contraseña.';
  } finally {
    accountLoading.value = false;
  }
}

function formatShortDate(value = new Date()) {
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
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
  const serviceText = `${appointment?.service?.name || ''} ${appointment?.reason || ''}`.toLowerCase();
  attentionType.value = serviceText.includes('vacun') ? 'VACCINE' : serviceText.includes('cirug') || serviceText.includes('esteriliz') || serviceText.includes('castr') ? 'SURGERY' : 'CONSULTATION';
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
  selectedDocuments.prescription = false;
  selectedDocuments.clinicalHistory = false;
  selectedDocuments.surgeryConsent = false;
  taskChosen.value = false;
  activeTask.value = '';
  success.value = '';
  error.value = '';
}

async function loadData({ background = false } = {}) {
  if (refreshInProgress) return;
  refreshInProgress = true;
  if (!background) {
    loading.value = true;
    error.value = '';
  }
  try {
    const [appointmentsRes, productsRes, petsRes] = await Promise.all([
      api.get('/appointments'),
      api.get('/inventory'),
      api.get('/pets'),
    ]);
    appointments.value = appointmentsRes.data;
    products.value = productsRes.data.filter(p => p.active !== false);
    pets.value = petsRes.data;
    if (selected.value?.id) {
      const updatedSelection = appointments.value.find(appointment => appointment.id === selected.value.id);
      if (updatedSelection) selected.value = updatedSelection;
    }
  } catch (e) {
    if (!background) error.value = 'No se pudieron cargar las citas del doctor.';
  } finally {
    refreshInProgress = false;
    if (!background) loading.value = false;
  }
}

function refreshWhenVisible() {
  if (document.visibilityState === 'visible') loadData({ background: true });
}

async function selectAppointment(appointment) {
  selected.value = appointment;
  selectedStandalonePet.value = null;
  resetForm(appointment);
  history.value = [];
  historySearch.value = '';
  expandedRecordId.value = null;
  if (!appointment?.petId) return;
  activeWorkspace.value = 'consultation';
  consultationTab.value = 'evaluation';
  try {
    const [historyRes, preventiveRes] = await Promise.all([api.get(`/medical-records/pet/${appointment.petId}`),api.get(`/preventive-care/pet/${appointment.petId}`).catch(() => ({data:[]}))]);
    history.value = historyRes.data;
    preventiveRecords.value = preventiveRes.data;
  } catch (e) {
    error.value = 'No se pudo cargar el historial de la mascota.';
  }
}

async function selectPet(pet) {
  selected.value = null;
  selectedStandalonePet.value = pet;
  resetForm({ pet, reason: '' });
  history.value = [];
  historySearch.value = '';
  expandedRecordId.value = null;
  activeWorkspace.value = 'consultation';
  consultationTab.value = 'evaluation';
  try {
    const [historyRes, preventiveRes] = await Promise.all([api.get(`/medical-records/pet/${pet.id}`),api.get(`/preventive-care/pet/${pet.id}`).catch(() => ({data:[]}))]);
    history.value = historyRes.data;
    preventiveRecords.value = preventiveRes.data;
  } catch (e) {
    error.value = 'No se pudo cargar el historial de la mascota.';
  }
}

async function savePreventiveRecord() {
  if (!selectedPet.value || !preventiveForm.productName.trim()) return;
  preventiveSaving.value = true;
  error.value = '';
  try {
    const { data } = await api.post('/preventive-care', {
      ...preventiveForm,
      petId:selectedPet.value.id,
      veterinarianId:auth.user.id,
      weightKg:preventiveForm.weightKg === null || preventiveForm.weightKg === '' ? undefined : Number(preventiveForm.weightKg),
      amountCharged:preventiveForm.amountCharged === null || preventiveForm.amountCharged === '' ? undefined : Number(preventiveForm.amountCharged),
      nextAppointmentAt:preventiveForm.nextAppointmentAt || undefined,
    });
    preventiveRecords.value = [data, ...preventiveRecords.value];
    preventiveForm.productName = ''; preventiveForm.nextProductName = ''; preventiveForm.weightKg = null; preventiveForm.amountCharged = null; preventiveForm.nextAppointmentAt = ''; preventiveForm.sterilizationRecommended = false; preventiveForm.notes = '';
  } catch (e) { error.value = e.response?.data?.message || 'No se pudo guardar el registro preventivo.'; }
  finally { preventiveSaving.value = false; }
}

async function removePreventiveRecord(record) {
  if (!window.confirm(`Eliminar el registro de ${record.productName}?`)) return;
  try { await api.delete(`/preventive-care/${record.id}`); preventiveRecords.value = preventiveRecords.value.filter(item => item.id !== record.id); }
  catch (e) { error.value = 'No se pudo eliminar el registro preventivo.'; }
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
  if (!selectedDocuments.prescription || !prescription.value.productId) return [];
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
    `Tipo de atención: ${attentionTypes.find(type => type.value === attentionType.value)?.label || 'Consulta'}`,
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

function createPrintDocument() {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.style.opacity = '0';
  document.body.appendChild(frame);
  const printDocument = frame.contentWindow;
  if (!printDocument) {
    frame.remove();
    return null;
  }
  printDocument.addEventListener('afterprint', () => frame.remove(), { once: true });
  return printDocument;
}

function generatePrescriptionPdf() {
  if (!selectedPet.value) {
    error.value = 'Selecciona un paciente antes de generar la receta.';
    return;
  }
  if (!selectedProduct.value) {
    error.value = 'Selecciona un medicamento antes de generar la receta.';
    return;
  }
  if (!prescription.value.dosage.trim() || !prescription.value.instructions.trim()) {
    error.value = 'Completa la dosis y las indicaciones antes de generar la receta.';
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

  const printWindow = createPrintDocument();
  if (!printWindow) {
    error.value = 'No se pudo preparar el documento para impresión.';
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

function generateClinicalHistoryPdf() {
  if (!selectedPet.value) {
    error.value = 'Selecciona un paciente antes de generar la historia clínica.';
    return;
  }

  const pet = selectedPet.value;
  const client = selectedClient.value || {};
  const printWindow = createPrintDocument();
  if (!printWindow) {
    error.value = 'No se pudo preparar el documento para impresión.';
    return;
  }
  const blankRows = (count, columns) => Array.from({ length: count }, () => `<tr>${'<td>&nbsp;</td>'.repeat(columns)}</tr>`).join('');
  const preventiveRows = (type, minimumRows) => {
    const records = preventiveRecords.value.filter(record => record.type === type);
    const rows = records.map(record => type === 'DEWORMING'
      ? `<tr><td>${escapeHtml(formatShortDate(record.appliedAt))}</td><td>${escapeHtml(record.productName)}</td><td>${escapeHtml(record.weightKg || '')}</td><td>${escapeHtml(record.veterinarian?.fullName || '')}</td><td>${escapeHtml(record.nextAppointmentAt ? formatShortDate(record.nextAppointmentAt) : '')}</td></tr>`
      : `<tr><td>${escapeHtml(formatShortDate(record.appliedAt))}</td><td>${escapeHtml(record.productName)}</td><td>${escapeHtml(record.veterinarian?.fullName || '')}</td><td>${escapeHtml(record.nextAppointmentAt ? formatShortDate(record.nextAppointmentAt) : '')}</td></tr>`);
    return rows.join('') + blankRows(Math.max(0, minimumRows - records.length), type === 'DEWORMING' ? 5 : 4);
  };
  const selectedExams = checkedExams().join(', ');
  const noteValue = (text, label) => String(text || '').split('\n').find(line => line.startsWith(`${label}:`))?.slice(label.length + 1).trim() || '';
  const consultation = data => `<table class="consult"><tr><th>FECHA</th><th>PESO</th><th>FC</th><th>FR</th><th>T°</th></tr><tr><td>${escapeHtml(data.date || '')}</td><td>${escapeHtml(data.weight || '')}</td><td>${escapeHtml(data.fc || '')}</td><td>${escapeHtml(data.fr || '')}</td><td>${escapeHtml(data.temperature || '')}</td></tr><tr><th colspan="2">Anamnesis y exploración física</th><td colspan="3" class="text">${escapeHtml(data.anamnesis || '')}</td></tr><tr><th colspan="2">Exámenes complementarios</th><td colspan="3" class="text">${escapeHtml(data.exams || '')}</td></tr><tr><th>Dx. P-P</th><td colspan="2" class="text">${escapeHtml(data.presumptiveDx || '')}</td><th>Dx. P-D</th><td class="text">${escapeHtml(data.definitiveDx || '')}</td></tr><tr><th colspan="2">Tratamiento</th><td colspan="3" class="text">${escapeHtml(data.treatment || '')}</td></tr><tr><th colspan="2">Frecuencia</th><td colspan="3" class="text">${escapeHtml(data.frequency || '')}</td></tr></table>`;
  const hasCurrentDraft = Boolean(form.value.anamnesis || form.value.presumptiveDx || form.value.definitiveDx || form.value.treatment || form.value.fc || form.value.fr || form.value.temperatureC);
  const currentConsultation = {
    date: formatShortDate(), weight: form.value.weightKg || pet.weightKg || '', fc: form.value.fc, fr: form.value.fr,
    temperature: form.value.temperatureC, anamnesis: form.value.anamnesis,
    exams: [selectedExams, form.value.examOther].filter(Boolean).join(', '), presumptiveDx: form.value.presumptiveDx,
    definitiveDx: form.value.definitiveDx, treatment: form.value.treatment, frequency: form.value.frequency,
  };
  const previousConsultations = history.value.map(record => ({
    date: formatShortDate(record.visitDate), weight: record.weightKg || '', temperature: record.temperatureC || '',
    fc: noteValue(record.observations, 'FC'), fr: noteValue(record.observations, 'FR'),
    anamnesis: [record.reason, noteValue(record.observations, 'Anamnesis')].filter(Boolean).join('\n'),
    exams: noteValue(record.observations, 'Exámenes complementarios'),
    presumptiveDx: noteValue(record.diagnosis, 'DX presuntivo'),
    definitiveDx: noteValue(record.diagnosis, 'DX definitivo') || record.diagnosis,
    treatment: record.treatment, frequency: noteValue(record.treatment, 'Frecuencia'),
  }));
  const consultationBlocks = [...(hasCurrentDraft ? [currentConsultation] : []), ...previousConsultations];
  const renderedConsultations = (consultationBlocks.length ? consultationBlocks : [{}]).map(consultation).join('');

  printWindow.document.write(`<!doctype html><html><head><title>Historia clínica Happy Dog - ${escapeHtml(pet.name || 'Paciente')}</title><style>
    @page{size:A4 portrait;margin:10mm 16mm 12mm}*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;color:#111;font-size:8px}.sheet{width:100%}.title{display:grid;grid-template-columns:70px 1fr 145px;align-items:center;margin-bottom:3mm}.title img{width:56px;height:42px;object-fit:cover}.title h1{text-align:center;font-size:13px;margin:0}.title strong{text-align:right;font-size:9px}.line{margin:1.4mm 0;line-height:1.45}.section-title{font-size:9px;font-weight:800;margin:2.2mm 0 1mm}table{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:2mm}th,td{border:1px solid #111;padding:2px 3px;height:4mm;text-align:center;vertical-align:middle}th{font-weight:800}.schedule td{height:3.3mm}.text{text-align:left;white-space:pre-wrap}.consult{break-inside:avoid;page-break-inside:avoid}.consult th{width:auto}.consult tr:nth-child(3) td,.consult tr:nth-child(4) td,.consult tr:nth-child(6) td{height:7mm}.owner-line{display:flex;justify-content:space-between;gap:15px}.owner-line span:first-child{flex:1}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
  </style></head><body><main class="sheet"><header class="title"><img src="${happyDogLogo}" alt="Happy Dog"><h1>HISTORIA CLÍNICA HAPPY DOG</h1><strong>N° Historia: ${escapeHtml(String(pet.id || '').slice(0, 8).toUpperCase())}</strong></header><div class="line"><b>Fecha ingreso:</b> ${escapeHtml(formatShortDate(pet.createdAt || new Date()))}</div><div class="section-title">1. Datos del propietario:</div><div class="line owner-line"><span><b>Nombre:</b> ${escapeHtml(client.fullName || '')}</span><span><b>Teléfono:</b> ${escapeHtml(client.phone || '')}</span></div><div class="line owner-line"><span><b>Dirección:</b> ${escapeHtml(client.address || '')}</span><span><b>DNI:</b> ${escapeHtml(client.documentNumber || client.dni || '')}</span></div><div class="section-title">2. Datos del paciente:</div><div class="line owner-line"><span><b>Nombre:</b> ${escapeHtml(pet.name || '')}</span><span><b>Especie:</b> ${escapeHtml(pet.species || '')}</span><span><b>Edad:</b> ${escapeHtml(pet.age || '')}</span></div><div class="line owner-line"><span><b>Raza:</b> ${escapeHtml(pet.breed || '')}</span><span><b>Sexo:</b> ${escapeHtml(sexLabel(pet.sex))}</span><span><b>Color:</b> ${escapeHtml(pet.color || '')}</span><span><b>Peso:</b> ${escapeHtml(form.value.weightKg || pet.weightKg || '')}</span></div><div class="section-title">3. Desparasitaciones:</div><table class="schedule"><tr><th>FECHA</th><th>DESPARASITANTE</th><th>PESO</th><th>FIRMA Y SELLO</th><th>PRÓXIMA CITA</th></tr>${preventiveRows('DEWORMING',12)}</table><div class="section-title">4. Vacunas:</div><table class="schedule"><tr><th>FECHA</th><th>VACUNA</th><th>FIRMA Y SELLO</th><th>PRÓXIMA CITA</th></tr>${preventiveRows('VACCINE',11)}</table><div class="section-title">5. Consultas (${consultationBlocks.length}):</div>${renderedConsultations}</main><script>window.onload=function(){window.print()}<\/script></body></html>`);
  printWindow.document.close();
}

function generateSurgeryConsentPdf() {
  if (!selectedPet.value) {
    error.value = 'Selecciona un paciente antes de generar la autorización quirúrgica.';
    return;
  }
  if (!surgeryConsent.ownerDni.trim() || !surgeryConsent.ownerAddress.trim() || !surgeryConsent.lastMeal.trim()) {
    error.value = 'Completa el DNI, la dirección del dueño y la última comida antes de generar la autorización.';
    return;
  }
  if (surgeryConsent.medicalCondition && !surgeryConsent.medicalConditionDetail.trim()) {
    error.value = 'Describe el problema médico preexistente antes de generar la autorización.';
    return;
  }

  const pet = selectedPet.value;
  const client = selectedClient.value || {};
  const petSpecies = String(pet.species || '').toLowerCase();
  const petSex = sexLabel(pet.sex).toLowerCase();
  const isCat = petSpecies.includes('gato') || petSpecies.includes('felino');
  const isDog = petSpecies.includes('perro') || petSpecies.includes('canino') || !isCat;
  const isMale = petSex.includes('macho');
  const isFemale = petSex.includes('hembra');
  const checked = value => (value ? '&#9745;' : '&#9744;');
  const date = formatShortDate();

  const printWindow = createPrintDocument();
  if (!printWindow) {
    error.value = 'No se pudo preparar el documento para impresión.';
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Autorizacion quirurgica - ${escapeHtml(pet.name || 'Paciente')}</title>
        <style>
          @page{size:A4;margin:9mm}
          *{box-sizing:border-box}
          body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#111;background:#fff}
          .sheet{position:relative;min-height:277mm;padding:8mm 9mm 7mm;overflow:hidden}
          .watermark{position:absolute;inset:0;display:grid;place-items:center;font-size:132px;font-weight:900;color:rgba(0,0,0,.055);line-height:.78;z-index:0;text-align:center}
          .content{position:relative;z-index:1}
          .top-row{display:grid;grid-template-columns:150px 1fr 150px;align-items:center;margin-bottom:7mm}
          .date-box,.code-box{border:1.5px solid #333;padding:7px 10px;font-weight:800;font-size:13px}
          .date-box{justify-self:start}.code-box{justify-self:end}
          .brand{text-align:center;color:#7aa681;font-weight:900;line-height:1}
          .brand strong{display:block;color:#5a8c66;font-size:22px}
          h1{margin:0 0 8mm;text-align:center;font-size:27px;line-height:1.14;font-weight:900;letter-spacing:.02em}
          h2{margin:0 0 4px;text-align:center;font-size:17px;font-weight:900;letter-spacing:.02em}
          .main-grid{display:grid;grid-template-columns:1fr 1fr;gap:18mm;margin-bottom:9mm}
          .panel{position:relative;background:#b8b8b8;padding:8mm 6mm 6mm;min-height:102mm}
          .panel .panel-logo{position:absolute;inset:auto 8mm 10mm auto;font-size:82px;font-weight:900;color:rgba(255,255,255,.16);line-height:.8}
          .line{border-bottom:1.4px solid rgba(0,0,0,.58);min-height:21px;margin:0 0 7px;padding-top:2px;font-size:13px}
          .line strong{display:block;font-size:12px;text-transform:uppercase}
          .two{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
          .checks{display:flex;flex-wrap:wrap;gap:13px;margin:6px 0 7px;font-size:14px}
          .question{font-size:13px;line-height:1.2;margin:8px 0 5px}
          .note-box{background:#fff;min-height:55mm;padding:8px;border:1px solid transparent}
          .warning{text-align:center;font-size:10px;font-weight:800;line-height:1.15;margin:4px 0 8px}
          .side-date{position:absolute;left:3mm;top:122mm;transform:rotate(-90deg);transform-origin:left top;font-size:28px;letter-spacing:.04em}
          .consent-title{font-weight:900;font-size:17px;margin:0 0 3px}
          .consent-grid{display:grid;grid-template-columns:1fr 1fr;gap:8mm;background:#b8b8b8;padding:7mm 7mm 5mm;margin-top:4mm}
          .consent-grid p{font-size:12.5px;line-height:1.18;margin:0 0 8px;text-align:justify}
          .footer{margin-top:6mm;display:grid;grid-template-columns:1fr 1fr;gap:12mm;align-items:end}
          .owner-sign{font-size:16px;font-weight:900;line-height:1.3}
          .signature{text-align:center;font-size:10px}
          .signature-line{border-top:1.5px solid #222;margin:0 auto 4px;width:210px}
          @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.sheet{padding:7mm 8mm}}
        </style>
      </head>
      <body>
        <main class="sheet">
          <div class="watermark">Happy<br>Dog.</div>
          <div class="side-date">FECHA:</div>
          <section class="content">
            <div class="top-row">
              <div class="date-box">FECHA: ${escapeHtml(date)}</div>
              <div class="brand"><strong>Happy Dog</strong>Clinica Veterinaria</div>
              <div class="code-box">CODIGO: ${escapeHtml(surgeryCode.value)}</div>
            </div>

            <h1>FORMULARIO DE REGISTRO PARA CIRUGIA<br>DE ESTERILIZACION / CASTRACION</h1>

            <div class="main-grid">
              <div>
                <h2>INFORMACION DEL PACIENTE</h2>
                <div class="panel">
                  <div class="line"><strong>Nombre del paciente</strong>${escapeHtml(pet.name || '')}</div>
                  <div class="checks">
                    <span>PERRO ${checked(isDog)}</span>
                    <span>GATO ${checked(isCat)}</span>
                    <span>MACHO ${checked(isMale)}</span>
                    <span>HEMBRA ${checked(isFemale)}</span>
                  </div>
                  <div class="two">
                    <div class="line"><strong>Edad</strong>${escapeHtml(surgeryConsent.petAge || pet.age || '')}</div>
                    <div class="line"><strong>Color</strong>${escapeHtml(surgeryConsent.petColor || pet.color || '')}</div>
                  </div>
                  <div class="line"><strong>Raza</strong>${escapeHtml(pet.breed || '')}</div>
                  <div class="question">A que hora comio su mascota por ultima vez?</div>
                  <div class="line">${escapeHtml(surgeryConsent.lastMeal || '')}</div>
                  <div class="question">Su mascota ha vomitado o tenido diarrea en las ultimas 24 horas?</div>
                  <div class="checks"><span>SI ${checked(surgeryConsent.digestiveIssue)}</span><span>NO ${checked(!surgeryConsent.digestiveIssue)}</span></div>
                  <div class="question">Tiene su mascota algun problema medico preexistente?</div>
                  <div class="checks"><span>SI ${checked(surgeryConsent.medicalCondition)}</span><span>NO ${checked(!surgeryConsent.medicalCondition)}</span></div>
                  <div class="question">En caso afirmativo, por favor explique</div>
                  <div class="line">${escapeHtml(surgeryConsent.medicalConditionDetail || '')}</div>
                  <div class="question">Su mascota toma algun medicamento?</div>
                  <div class="line">${escapeHtml(surgeryConsent.medication || '')}</div>
                  <div class="panel-logo">Happy<br>Dog.</div>
                </div>
              </div>

              <div>
                <h2>INFORMACION DEL DUENO</h2>
                <div class="panel">
                  <div class="line"><strong>Nombres y apellidos</strong>${escapeHtml(client.fullName || '')}</div>
                  <div class="line"><strong>Direccion</strong>${escapeHtml(surgeryConsent.ownerAddress || client.address || '')}</div>
                  <div class="line"><strong>Numero de contacto</strong>${escapeHtml(client.phone || selected.value?.phone || '')}</div>
                  <h2 style="text-align:left;margin:7mm 0 5px">INFORMACION ALTERNATIVA</h2>
                  <div class="line"><strong>Nombre de la persona alternativa para recojo de mascota</strong>${escapeHtml(surgeryConsent.alternativeName || '')}</div>
                  <div class="line"><strong>Numero de contacto de la persona alternativa</strong>${escapeHtml(surgeryConsent.alternativePhone || '')}</div>
                  <p class="warning">** POR FAVOR COMPLETE TODA LA INFORMACION ANTERIOR! **<br>SI NO PODEMOS COMUNICARNOS CON USTED PARA PREGUNTAS O INQUIETUDES, EL VETERINARIO PODRIA DECIDIR NO REALIZAR LA CIRUGIA.</p>
                  <div class="note-box"><strong>Anotaciones u observaciones del personal</strong><br>${escapeHtml(surgeryConsent.staffNotes || '')}</div>
                  <div class="panel-logo">Happy<br>Dog.</div>
                </div>
              </div>
            </div>

            <div class="consent-title">FICHA DE CONSENTIMIENTO</div>
            <div class="consent-grid">
              <div>
                <p>Por la presente, yo, el propietario del animal mencionado anteriormente, doy mi consentimiento para que el personal medico veterinario lleve a cabo el procedimiento de esterilizacion y/o castracion, comprendiendo y aceptando los siguientes terminos y condiciones:</p>
                <p><strong>Riesgos de la cirugia:</strong> Reconozco que la cirugia de esterilizacion o castracion es un procedimiento quirurgico que conlleva ciertos riesgos inherentes, incluyendo infecciones, hemorragias, reacciones adversas a la anestesia y complicaciones imprevistas durante o despues de la operacion.</p>
                <p><strong>Rasurado del area quirurgica:</strong> Entiendo que, para permitir una adecuada realizacion de la incision quirurgica, se procedera al rasurado del pelaje de mi mascota en la zona correspondiente.</p>
                <p><strong>Anestesia:</strong> Autorizo al medico veterinario a utilizar la anestesia local o inhalatoria segun lo considere conveniente para el procedimiento.</p>
              </div>
              <div>
                <p><strong>Celo y embarazo:</strong> En caso de que mi mascota este en celo o embarazada en el momento de la cirugia, entiendo que el procedimiento podria incluir la interrupcion del embarazo y autorizo la realizacion de dicho procedimiento.</p>
                <p><strong>Autorizacion para emergencias:</strong> Autorizo a los medicos veterinarios y al personal del establecimiento a realizar cualquier procedimiento o intervencion que consideren necesario para salvar la vida de mi mascota en caso de emergencia.</p>
                <p><strong>Exoneracion de responsabilidad:</strong> Acepto que no se me brindara compensacion alguna por consecuencias relacionadas con este procedimiento. Asimismo, renuncio a presentar cualquier reclamo relacionado con la cirugia.</p>
                <p><strong>Responsabilidad financiera:</strong> Certifico que he leido y comprendido todos los puntos de este documento y asumo la responsabilidad financiera por los cargos relacionados.</p>
              </div>
            </div>

            <div class="footer">
              <div class="owner-sign">
                NOMBRES Y APELLIDOS: ${escapeHtml(client.fullName || '')}<br>
                DNI: ${escapeHtml(surgeryConsent.ownerDni || '')}
              </div>
              <div class="signature">
                <div class="signature-line"></div>
                FIRMA<br>
                Entiendo que he dado consentimiento para que los veterinarios y veterinarios externos supervisados directamente por HAPPY DOG realicen el procedimiento quirurgico programado.
              </div>
            </div>
          </section>
        </main>
        <script>window.onload=function(){window.print()}<\/script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

async function saveRecord() {
  if (!selectedPet.value) return;
  if (!form.value.reason.trim()) {
    error.value = 'Escribe el motivo de la atención antes de guardarla.';
    return;
  }
  const diagnosis = buildDiagnosisText() || (attentionType.value === 'VACCINE' ? 'Vacunación preventiva' : '');
  if (!diagnosis) {
    error.value = 'Completa al menos un diagnóstico presuntivo o definitivo.';
    return;
  }
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/medical-records', {
      appointmentId: selected.value?.id,
      petId: selectedPet.value.id,
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
    activeWorkspace.value = 'history';
  } catch (e) {
    error.value = e.response?.status === 403
      ? 'Tu sesión no tiene permiso para guardar historias clínicas. Cierra sesión y entra nuevamente con la cuenta del doctor.'
      : e.response?.data?.message || 'No se pudo guardar la atención.';
  } finally {
    saving.value = false;
  }
}

async function savePrescriptionRecord() {
  if (!selectedPet.value) return;
  if (!selectedProduct.value) {
    error.value = 'Selecciona un medicamento antes de guardar la receta.';
    return;
  }
  const quantity = Number(prescription.value.quantity || 0);
  if (!Number.isInteger(quantity) || quantity < 1) {
    error.value = 'La cantidad del medicamento debe ser un número entero mayor que cero.';
    return;
  }
  if (quantity > Number(selectedProduct.value.stock || 0)) {
    error.value = `Stock insuficiente. Solo quedan ${selectedProduct.value.stock} unidades de ${selectedProduct.value.name}.`;
    return;
  }
  if (!prescription.value.dosage.trim() || !prescription.value.instructions.trim()) {
    error.value = 'Completa la dosis y las indicaciones antes de guardar la receta.';
    return;
  }

  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/medical-records', {
      appointmentId: selected.value?.id,
      petId: selectedPet.value.id,
      veterinarianId: auth.user.id,
      reason: form.value.reason || 'Emisión de receta médica',
      weightKg: form.value.weightKg === null || form.value.weightKg === '' ? undefined : Number(form.value.weightKg),
      diagnosis: 'Receta médica',
      treatment: `${selectedProduct.value.name}: ${prescription.value.dosage}. ${prescription.value.instructions}`,
      observations: 'Receta emitida desde el módulo médico.',
      prescriptions: [{
        productId: selectedProduct.value.id,
        quantity,
        dosage: prescription.value.dosage.trim(),
        instructions: prescription.value.instructions.trim(),
      }],
    });
    success.value = 'Receta guardada en el historial y stock actualizado.';
    products.value = products.value.map(product => product.id === selectedProduct.value.id
      ? { ...product, stock: Number(product.stock) - quantity }
      : product);
    history.value = (await api.get(`/medical-records/pet/${selectedPet.value.id}`)).data;
    activeWorkspace.value = 'history';
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo guardar la receta.';
  } finally {
    saving.value = false;
  }
}

watch(selectedPet, (pet) => {
  surgeryConsent.petAge = pet?.age || '';
  surgeryConsent.petColor = pet?.color || '';
});

watch(selectedClient, (client) => {
  surgeryConsent.ownerAddress = client?.address || '';
  surgeryConsent.ownerDni = client?.dni || '';
});

watch(attentionType, (type) => {
  if (type !== 'SURGERY') selectedDocuments.surgeryConsent = false;
});

onMounted(() => {
  loadData();
  automaticRefreshId = window.setInterval(refreshWhenVisible, 10000);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('focus', refreshWhenVisible);
});

onUnmounted(() => {
  if (automaticRefreshId) window.clearInterval(automaticRefreshId);
  document.removeEventListener('visibilitychange', refreshWhenVisible);
  window.removeEventListener('focus', refreshWhenVisible);
});
</script>

<template>
  <VeterinarianLayout title="Doctor Veterinario" subtitle="Tu espacio de atención médica" hide-user-pill hide-sidebar>
    <template #top-actions>
      <button type="button" class="doctor-account-trigger" :aria-expanded="accountOpen" @click="accountOpen = true">
        <span>{{ (auth.user?.fullName || 'D').slice(0, 1).toUpperCase() }}</span>
        <div><strong>{{ auth.user?.fullName || 'Doctor veterinario' }}</strong><small>Mi cuenta</small></div>
      </button>
    </template>

    <div class="doctor-page">

    <div v-if="accountOpen" class="account-overlay" @click.self="accountOpen = false">
      <aside class="account-drawer glass-card" role="dialog" aria-modal="true" aria-labelledby="doctor-account-title">
        <div class="account-drawer-head">
          <div><span class="badge">Mi cuenta</span><h2 id="doctor-account-title">Perfil y seguridad</h2></div>
          <button type="button" class="secondary small" aria-label="Cerrar mi cuenta" @click="accountOpen = false">Cerrar</button>
        </div>
        <div class="account-identity">
          <span>{{ (auth.user?.fullName || 'D').slice(0, 1).toUpperCase() }}</span>
          <div><strong>{{ auth.user?.fullName || 'Doctor veterinario' }}</strong><small>{{ auth.user?.email || '' }}</small><small>{{ auth.role === 'ADMIN' ? 'Administrador con acceso al panel médico' : 'Doctor veterinario' }}</small></div>
        </div>
        <div class="account-divider"></div>
        <h3>Cambiar contraseña</h3>
        <p class="muted-text">Actualiza tu acceso sin salir del panel ni perder la atención actual.</p>
        <form class="stack" @submit.prevent="changeAccountPassword">
          <label>Contraseña actual<input v-model="accountForm.currentPassword" type="password" required minlength="6" autocomplete="current-password"></label>
          <label>Nueva contraseña<input v-model="accountForm.newPassword" type="password" required minlength="8" autocomplete="new-password"></label>
          <label>Confirmar contraseña<input v-model="accountForm.confirmPassword" type="password" required minlength="8" autocomplete="new-password"></label>
          <p v-if="accountError" class="error">{{ accountError }}</p>
          <p v-if="accountSuccess" class="success">{{ accountSuccess }}</p>
          <button :disabled="accountLoading">{{ accountLoading ? 'Guardando...' : 'Guardar nueva contraseña' }}</button>
        </form>
        <div class="account-divider"></div>
        <button type="button" class="danger full" @click="auth.logout(); $router.push('/personal/login')">Cerrar sesión</button>
      </aside>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <header class="workflow-progress" aria-label="Flujo de atención">
      <div :class="{ active: activeWorkspace === 'agenda' }"><span>1</span><strong>Elegir paciente</strong></div>
      <div :class="{ active: activeWorkspace === 'consultation' && !taskChosen }"><span>2</span><strong>Elegir necesidad</strong></div>
      <div :class="{ active: taskChosen || activeWorkspace === 'history' }"><span>3</span><strong>Completar atención</strong></div>
    </header>

    <div v-if="activeWorkspace !== 'agenda'" class="patient-context-bar">
      <button type="button" class="secondary small" @click="goBackOneStep">← Retroceder</button>
      <div><strong>{{ selectedPet?.name }}</strong><span>{{ selectedClient?.fullName || 'Sin propietario registrado' }}</span></div>
    </div>

    <div v-show="activeWorkspace === 'agenda'" class="patient-selection-step">
      <section class="glass-card appointment-list">
        <div class="section-title">
          <span class="badge">Paso 1 de 3</span>
          <h2>¿A qué paciente atenderás?</h2>
        </div>
        <p class="muted-text">Elige una cita de hoy o busca directamente a la mascota.</p>
        <div v-if="groomingAppointments.length" class="grooming-note">
          <strong>{{ groomingAppointments.length }} servicio{{ groomingAppointments.length === 1 ? '' : 's' }} de baño y corte</strong>
          <span>No requieren historia médica y continúan en el flujo de recepción/peluquería.</span>
        </div>
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

    </div>

    <div v-show="activeWorkspace !== 'agenda'" class="clinical-grid main focused-workspace">
      <section v-show="activeWorkspace === 'consultation'" class="glass-card">
        <div class="section-title">
          <div>
            <span class="badge">Nueva atención</span>
            <h2 class="medical-title">{{ selectedPet ? 'Registro médico' : 'Iniciar registro médico' }}</h2>
          </div>
        </div>
        <div v-if="!selectedPet" class="empty-state medical-empty">
          <strong>Elige primero una mascota</strong>
          <span>Selecciona una cita lista o busca un paciente para activar el registro, la receta y el historial.</span>
        </div>
        <section v-else-if="!taskChosen" class="clinical-task-launcher">
          <div class="task-launcher-copy">
            <span class="badge">Paso 2 de 3</span>
            <h2>¿Qué necesitas hacer hoy con {{ selectedPet.name }}?</h2>
            <p>Abre solamente la herramienta que vas a utilizar.</p>
          </div>
          <div class="clinical-task-grid">
            <button type="button" @click="startClinicalTask('consultation')"><span>01</span><div><strong>Consulta médica</strong><small>Evaluación, diagnóstico y tratamiento</small></div></button>
            <button type="button" @click="startClinicalTask('preventive')"><span>02</span><div><strong>Vacuna o desparasitación</strong><small>Registrar aplicación y próxima cita</small></div></button>
            <button type="button" @click="startClinicalTask('prescription')"><span>03</span><div><strong>Emitir receta</strong><small>Medicamento, dosis e indicaciones</small></div></button>
            <button type="button" @click="startClinicalTask('history')"><span>04</span><div><strong>Historia clínica</strong><small>Completar o generar el documento Happy Dog</small></div></button>
            <button type="button" @click="activeWorkspace = 'history'"><span>05</span><div><strong>Consultas anteriores</strong><small>Revisar antecedentes del paciente</small></div></button>
            <button type="button" class="task-secondary" @click="startClinicalTask('surgery')"><span>06</span><div><strong>Cirugía</strong><small>Evaluación y autorización quirúrgica</small></div></button>
          </div>
        </section>
        <form v-else class="medical-form" @submit.prevent="saveRecord">
          <div class="current-task-bar"><span><strong>Paso 3 de 3</strong> · {{ activeTask === 'consultation' ? 'Consulta médica' : activeTask === 'preventive' ? 'Vacuna o desparasitación' : activeTask === 'prescription' ? 'Receta médica' : activeTask === 'history' ? 'Historia clínica' : 'Cirugía' }}</span></div>
          <section v-if="activeTask === 'consultation'" class="attention-type-box">
            <label>Tipo de atención
              <select v-model="attentionType"><option v-for="type in attentionTypes" :key="type.value" :value="type.value">{{ type.label }} — {{ type.help }}</option></select>
            </label>
          </section>
          <label v-if="activeTask === 'consultation'" class="consultation-section-select">Sección
            <select v-model="consultationTab"><option v-for="tab in consultationTabs" :key="tab.value" :value="tab.value">{{ tab.label }} — {{ tab.help }}</option></select>
          </label>
          <section v-show="activeTask === 'consultation'" class="clinical-sheet">
            <div class="sheet-top">
              <div class="sheet-code">FECHA: {{ dateKey() }}</div>
              <div class="sheet-brand">
                <strong>Happy Dog</strong>
                <span>Clínica veterinaria</span>
              </div>
              <div class="sheet-code">CÓDIGO: {{ selectedPet?.id?.slice(0, 8).toUpperCase() }}</div>
            </div>

            <h3 class="sheet-title">Historia clínica</h3>
            <div v-show="consultationTab === 'evaluation'" class="clinical-step-content">
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
            </div>

            <div v-show="consultationTab === 'diagnosis'" class="clinical-step-content">
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
            </div>

            <div v-show="consultationTab === 'plan'" class="clinical-step-content">
            <label class="clinical-line tall">
              <span>Tratamiento</span>
              <textarea v-model="form.treatment" placeholder="Procedimientos, medicación aplicada y evolución durante consulta"></textarea>
            </label>

            <div class="frequency-row">
              <label>Frecuencia<input v-model="form.frequency" placeholder="Cada 12 h, cada 24 h, por 5 días..."></label>
              <label>Recomendaciones<textarea v-model="form.recommendations" placeholder="Cuidados en casa, dieta, reposo, señales de alerta"></textarea></label>
            </div>
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

          <div v-show="activeTask !== 'consultation'" class="document-step">

          <section v-if="activeTask === 'history' || activeTask === 'preventive'" class="clinical-document-editor">
            <template v-if="activeTask === 'history'">
            <div class="document-editor-head">
              <div><span class="badge">Documento editable</span><h3>Historia clínica Happy Dog</h3><p>Los datos del paciente se completan automáticamente. El doctor registra únicamente la información médica.</p></div>
              <div class="document-head-actions">
                <button class="secondary" type="button" @click="generateClinicalHistoryPdf">Generar PDF</button>
                <button type="button" :disabled="saving" @click="saveRecord">{{ saving ? 'Guardando...' : 'Guardar en historial' }}</button>
              </div>
            </div>
            <div class="document-auto-section">
              <div class="document-section-label"><strong>Datos automáticos</strong><small>Tomados de la ficha del paciente</small></div>
              <div class="document-auto-grid">
                <div><span>N.º historia</span><strong>{{ selectedPet.id?.slice(0, 8).toUpperCase() }}</strong></div>
                <div><span>Propietario</span><strong>{{ selectedClient?.fullName || '-' }}</strong></div>
                <div><span>Teléfono</span><strong>{{ selectedClient?.phone || '-' }}</strong></div>
                <div><span>DNI</span><strong>{{ selectedClient?.documentNumber || selectedClient?.dni || '-' }}</strong></div>
                <div><span>Paciente</span><strong>{{ selectedPet.name }}</strong></div>
                <div><span>Especie / raza</span><strong>{{ selectedPet.species || '-' }} · {{ selectedPet.breed || '-' }}</strong></div>
                <div><span>Sexo / edad</span><strong>{{ sexLabel(selectedPet.sex) }} · {{ selectedPet.age || '-' }}</strong></div>
                <div><span>Color</span><strong>{{ selectedPet.color || '-' }}</strong></div>
              </div>
            </div>
            <div class="document-manual-section">
              <div class="document-section-label"><strong>Consulta actual</strong><small>Información que completa el doctor</small></div>
              <label>Motivo de la atención<input v-model="form.reason" placeholder="Ej. control, dolor, falta de apetito"></label>
              <div class="document-vitals-grid">
                <label>Fecha<input :value="formatShortDate()" readonly></label>
                <label>Peso<input v-model.number="form.weightKg" type="number" step="0.01" placeholder="kg"></label>
                <label>FC<input v-model="form.fc" placeholder="lpm"></label>
                <label>FR<input v-model="form.fr" placeholder="rpm"></label>
                <label>Temperatura<input v-model.number="form.temperatureC" type="number" step="0.1" placeholder="°C"></label>
              </div>
              <label>Anamnesis y exploración física<textarea v-model="form.anamnesis" placeholder="Antecedentes, síntomas y hallazgos de la exploración"></textarea></label>
              <div class="document-diagnosis-grid">
                <label>Diagnóstico presuntivo<textarea v-model="form.presumptiveDx"></textarea></label>
                <label>Diagnóstico definitivo<textarea v-model="form.definitiveDx"></textarea></label>
              </div>
              <label>Tratamiento<textarea v-model="form.treatment"></textarea></label>
              <label>Frecuencia<input v-model="form.frequency" placeholder="Cada 12 h, durante 5 días..."></label>
              <div class="document-editor-links">
                <button type="button" class="secondary small" @click="consultationTab = 'diagnosis'">Seleccionar exámenes complementarios</button>
                <span>{{ checkedExams().length ? checkedExams().join(', ') : 'Sin exámenes seleccionados' }}</span>
              </div>
            </div>
            </template>
            <div v-if="activeTask === 'preventive'" class="preventive-editor standalone-preventive">
              <div class="document-section-label"><strong>Vacunas y desparasitaciones</strong><small>Se guardan en la ficha de {{ selectedPet.name }}</small></div>
              <form class="preventive-form" @submit.prevent="savePreventiveRecord">
                <label>Registro<select v-model="preventiveForm.type"><option value="DEWORMING">Desparasitación</option><option value="VACCINE">Vacuna</option></select></label>
                <label>Fecha<input v-model="preventiveForm.appliedAt" type="date" required></label>
                <label>{{ preventiveForm.type === 'VACCINE' ? 'Vacuna' : 'Desparasitante' }}<input v-model="preventiveForm.productName" required placeholder="Nombre del producto"></label>
                <label v-if="preventiveForm.type === 'DEWORMING'">Peso<input v-model.number="preventiveForm.weightKg" type="number" step="0.01" placeholder="kg"></label>
                <label>Costo histórico<input v-model.number="preventiveForm.amountCharged" type="number" min="0" step="0.01" placeholder="S/ 0.00"></label>
                <label v-if="preventiveForm.type === 'VACCINE'">Próxima vacuna<input v-model="preventiveForm.nextProductName" placeholder="Ej. Refuerzo quíntuple"></label>
                <label>Próxima cita<input v-model="preventiveForm.nextAppointmentAt" type="date"></label>
                <label class="preventive-check"><input v-model="preventiveForm.sterilizationRecommended" type="checkbox"> Recomendar llamada para esterilización</label>
                <button :disabled="preventiveSaving">{{ preventiveSaving ? 'Guardando...' : 'Agregar registro' }}</button>
              </form>
              <h4>3. Desparasitaciones</h4>
              <div class="preventive-table-wrap"><table class="preventive-table"><thead><tr><th>Fecha</th><th>Desparasitante</th><th>Peso</th><th>Costo</th><th>Firma y sello</th><th>Próxima cita</th><th></th></tr></thead><tbody><tr v-for="record in preventiveRecords.filter(item => item.type === 'DEWORMING')" :key="record.id"><td>{{ formatShortDate(record.appliedAt) }}</td><td>{{ record.productName }}</td><td>{{ record.weightKg ? record.weightKg + ' kg' : '-' }}</td><td>{{ record.amountCharged != null ? 'S/ ' + formatPrice(record.amountCharged) : '-' }}</td><td>{{ record.veterinarian?.fullName || auth.user?.fullName }}</td><td>{{ record.nextAppointmentAt ? formatShortDate(record.nextAppointmentAt) : '-' }}</td><td><button type="button" class="danger small" @click="removePreventiveRecord(record)">Eliminar</button></td></tr><tr v-if="!preventiveRecords.some(item => item.type === 'DEWORMING')"><td colspan="7" class="muted-text">Sin desparasitaciones registradas.</td></tr></tbody></table></div>
              <h4>4. Vacunas</h4>
              <div class="preventive-table-wrap"><table class="preventive-table"><thead><tr><th>Fecha</th><th>Vacuna</th><th>Costo</th><th>Próxima vacuna</th><th>Próxima cita</th><th>Firma y sello</th><th></th></tr></thead><tbody><tr v-for="record in preventiveRecords.filter(item => item.type === 'VACCINE')" :key="record.id"><td>{{ formatShortDate(record.appliedAt) }}</td><td>{{ record.productName }}</td><td>{{ record.amountCharged != null ? 'S/ ' + formatPrice(record.amountCharged) : '-' }}</td><td>{{ record.nextProductName || '-' }}</td><td>{{ record.nextAppointmentAt ? formatShortDate(record.nextAppointmentAt) : '-' }}</td><td>{{ record.veterinarian?.fullName || auth.user?.fullName }}</td><td><button type="button" class="danger small" @click="removePreventiveRecord(record)">Eliminar</button></td></tr><tr v-if="!preventiveRecords.some(item => item.type === 'VACCINE')"><td colspan="7" class="muted-text">Sin vacunas registradas.</td></tr></tbody></table></div>
            </div>
          </section>

          <section v-if="activeTask === 'prescription'" class="prescription-box">
            <div class="prescription-head">
              <div>
                <h3>Receta / inventario</h3>
                <p class="muted-text">Selecciona medicamento, dosis e indicaciones. Puedes imprimirla y guardarla en el historial.</p>
              </div>
              <button class="secondary small" type="button" @click="generatePrescriptionPdf">Generar receta en PDF</button>
            </div>
            <select v-model="prescription.productId">
              <option value="">Sin medicamento</option>
              <option v-for="product in products" :key="product.id" :value="product.id">
                {{ product.name }} - stock {{ product.stock }}
              </option>
            </select>
            <input v-model.number="prescription.quantity" type="number" min="1" :max="selectedProduct?.stock || undefined" step="1" placeholder="Cantidad">
            <input v-model="prescription.dosage" placeholder="Dosis">
            <input v-model="prescription.instructions" placeholder="Indicaciones">
            <p v-if="selectedProduct" class="prescription-stock-note">Disponible: <strong>{{ selectedProduct.stock }}</strong> unidades. Al guardar, el inventario se actualiza automáticamente.</p>
            <button type="button" :disabled="saving || !selectedProduct" @click="savePrescriptionRecord">{{ saving ? 'Guardando...' : 'Guardar receta en historial' }}</button>
          </section>

          <section v-if="activeTask === 'surgery'" class="surgery-consent-box">
            <div class="prescription-head">
              <div>
                <h3>Autorización de cirugía</h3>
                <p class="muted-text">Para esterilización o castración. Completa los datos y genera el documento para firma.</p>
              </div>
              <button class="secondary small" type="button" @click="generateSurgeryConsentPdf">Generar autorización PDF</button>
            </div>
            <div class="form-grid surgery-grid">
              <input v-model="surgeryConsent.ownerDni" required placeholder="DNI del dueño *">
              <input v-model="surgeryConsent.ownerAddress" required placeholder="Dirección del dueño *">
              <input v-model="surgeryConsent.petAge" placeholder="Edad de la mascota">
              <input v-model="surgeryConsent.petColor" placeholder="Color de la mascota">
              <input v-model="surgeryConsent.lastMeal" required placeholder="Última comida *">
              <input v-model="surgeryConsent.medication" placeholder="Medicamento actual">
              <input v-model="surgeryConsent.alternativeName" placeholder="Persona alternativa para recojo">
              <input v-model="surgeryConsent.alternativePhone" placeholder="Teléfono alternativo">
              <label class="checkbox-row">
                <input v-model="surgeryConsent.digestiveIssue" type="checkbox">
                Vómito o diarrea en las últimas 24 horas
              </label>
              <label class="checkbox-row">
                <input v-model="surgeryConsent.medicalCondition" type="checkbox">
                Problema médico preexistente
              </label>
              <textarea v-model="surgeryConsent.medicalConditionDetail" :required="surgeryConsent.medicalCondition" placeholder="Detalle del problema médico, si aplica"></textarea>
              <textarea v-model="surgeryConsent.staffNotes" placeholder="Anotaciones u observaciones del personal"></textarea>
            </div>
          </section>
          </div>

          <div class="consultation-actions">
            <button v-if="activeTask === 'consultation' && consultationTab !== 'evaluation'" type="button" class="secondary" @click="consultationTab = consultationTabs[Math.max(0, consultationTabs.findIndex(tab => tab.value === consultationTab) - 1)].value">Anterior</button>
            <button v-if="activeTask === 'consultation' && consultationTab !== 'plan'" type="button" class="secondary" @click="consultationTab = consultationTabs[Math.min(consultationTabs.length - 1, consultationTabs.findIndex(tab => tab.value === consultationTab) + 1)].value">Continuar</button>
            <button v-if="activeTask === 'consultation' && consultationTab === 'plan'" :disabled="!selectedPet || saving">{{ saving ? 'Guardando...' : selected ? 'Guardar atención' : 'Guardar atención directa' }}</button>
          </div>
          <p v-if="activeTask === 'consultation' && consultationTab === 'plan' && !selected" class="direct-care-note">Esta atención se guardará directamente en el historial del paciente.</p>
        </form>
      </section>

      <section v-show="activeWorkspace === 'history'" class="glass-card history-panel">
        <div class="section-title">
          <div><span class="badge">Historial</span><h2>Consultas anteriores</h2></div>
          <span v-if="selectedPet" class="history-count">{{ history.length }} registro{{ history.length === 1 ? '' : 's' }}</span>
        </div>
        <p v-if="!selectedPet" class="empty">Selecciona una cita o busca un paciente para ver el historial.</p>
        <p v-else-if="!history.length" class="empty">Esta mascota aún no tiene historial clínico.</p>
        <template v-else>
          <div class="history-summary">
            <div><span>Última atención</span><strong>{{ formatDate(lastVisit) }}</strong></div>
            <div><span>Próximo control</span><strong>{{ nextControl ? formatDate(nextControl) : 'No programado' }}</strong></div>
          </div>
          <input v-model="historySearch" class="history-filter" placeholder="Buscar por motivo, diagnóstico, tratamiento o medicamento">
          <p v-if="!filteredHistory.length" class="empty">No hay consultas que coincidan con la búsqueda.</p>
          <article v-for="record in filteredHistory" :key="record.id" class="history-item" :class="{ expanded: expandedRecordId === record.id }">
            <button type="button" class="history-item-head" :aria-expanded="expandedRecordId === record.id" @click="toggleRecord(record.id)">
              <span class="history-date"><strong>{{ formatDate(record.visitDate) }}</strong><small>{{ record.veterinarian?.fullName || 'Veterinario' }}</small></span>
              <span class="history-reason"><small>Motivo</small><strong>{{ record.reason }}</strong></span>
              <span class="history-toggle">{{ expandedRecordId === record.id ? 'Ocultar' : 'Ver detalle' }}</span>
            </button>
            <div v-if="expandedRecordId === record.id" class="history-detail">
              <div v-if="record.weightKg || record.temperatureC" class="history-vitals">
                <span v-if="record.weightKg"><small>Peso</small><strong>{{ record.weightKg }} kg</strong></span>
                <span v-if="record.temperatureC"><small>Temperatura</small><strong>{{ record.temperatureC }} °C</strong></span>
              </div>
              <section><h4>Diagnóstico</h4><p v-for="line in lines(record.diagnosis)" :key="line">{{ line }}</p></section>
              <section v-if="record.treatment"><h4>Tratamiento y evolución</h4><p v-for="line in lines(record.treatment)" :key="line">{{ line }}</p></section>
              <section v-if="record.observations"><h4>Observaciones clínicas</h4><p v-for="line in lines(record.observations)" :key="line">{{ line }}</p></section>
              <section v-if="record.prescriptions?.length">
                <h4>Receta</h4>
                <div class="history-prescriptions"><span v-for="item in record.prescriptions" :key="item.id"><strong>{{ item.product?.name || 'Producto' }} × {{ item.quantity }}</strong><small>{{ [item.dosage, item.instructions].filter(Boolean).join(' · ') || 'Sin indicaciones adicionales' }}</small></span></div>
              </section>
              <section v-if="record.files?.length"><h4>Archivos clínicos</h4><div class="history-files"><a v-for="file in record.files" :key="file.id" :href="fileUrl(file.url)" target="_blank" rel="noopener">{{ file.originalName }}</a></div></section>
              <p v-if="record.nextControlAt" class="next-control-note"><strong>Próximo control:</strong> {{ formatDate(record.nextControlAt) }}</p>
            </div>
          </article>
        </template>
      </section>
    </div>
    </div>
  </VeterinarianLayout>
</template>
