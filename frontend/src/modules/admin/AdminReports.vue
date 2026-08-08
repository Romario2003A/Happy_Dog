<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../../services/api';
import {
  filterReportRows,
  isCampaignReportAppointment,
  isGroomingReportAppointment,
  isSurgeryReportAppointment,
} from '../../utils/adminReports';

const loading = ref(false);
const error = ref('');
const reportView = ref('overview');
const reportGroup = ref('overview');
const search = ref('');
const today = dateKey(new Date());
const fromDate = ref(`${today.slice(0, 8)}01`);
const toDate = ref(today);
const report = ref(emptyReport());

const groups = [
  { value: 'overview', label: 'Resumen' },
  { value: 'finance', label: 'Finanzas' },
  { value: 'services', label: 'Servicios' },
  { value: 'clinical', label: 'Clínica' },
  { value: 'team', label: 'Equipo' },
];
const views = [
  { value: 'overview', label: 'Resumen', group: 'overview' },
  { value: 'cash', label: 'Caja', group: 'finance' },
  { value: 'payments', label: 'Pagos realizados', group: 'finance' },
  { value: 'attentions', label: 'Atenciones', group: 'services' },
  { value: 'grooming', label: 'Baño y corte', group: 'services' },
  { value: 'surgery', label: 'Cirugías', group: 'services' },
  { value: 'campaigns', label: 'Campañas', group: 'services' },
  { value: 'tariff', label: 'Tarifario', group: 'services' },
  { value: 'preventive', label: 'Vacunas', group: 'clinical' },
  { value: 'clinical', label: 'Fichas clínicas', group: 'clinical' },
  { value: 'followups', label: 'Seguimientos', group: 'clinical' },
  { value: 'staff', label: 'Personal', group: 'team' },
];

const paymentLabels = {
  CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', YAPE: 'Yape', PLIN: 'Plin', OTHER: 'Otro',
};
const categoryLabels = {
  CONSULTATION: 'Consultas', VACCINE: 'Vacunas', DEWORMING: 'Desparasitación', SURGERY: 'Cirugías',
  GROOMING: 'Baño y corte', TREATMENT: 'Tratamientos', PRODUCT: 'Productos', PHARMACY: 'Farmacia',
  LABORATORY: 'Laboratorio', IMAGING: 'Imágenes', SEDATION: 'Sedación', BOARDING: 'Hospedaje', FOOD: 'Comida',
  PET_SHOP: 'Pet shop', EUTHANASIA: 'Eutanasia', CAMPAIGN: 'Campañas', DEBT: 'Deudas', OTHER: 'Otros',
};
const statusLabels = {
  PENDING: 'Pendiente', CONFIRMED: 'Confirmada', WAITING: 'En espera', IN_CONSULTATION: 'En atención',
  ATTENDED: 'Atendida', NO_SHOW: 'No asistió', CANCELLED: 'Cancelada', COMPLETED: 'Completada',
};
const roleLabels = { ADMIN: 'Administración', RECEPTIONIST: 'Recepción', VETERINARIAN: 'Veterinaria/o' };
const sexLabels = { MALE: 'Macho', FEMALE: 'Hembra', UNKNOWN: 'No indicado' };

const activeViews = computed(() => views.filter(view => view.group === reportGroup.value));
const groomingRows = computed(() => report.value.appointments.filter(isGroomingReportAppointment));
const campaignRows = computed(() => report.value.appointments.filter(isCampaignReportAppointment));
const surgeryRows = computed(() => report.value.appointments.filter(item => isSurgeryReportAppointment(item) && !isCampaignReportAppointment(item)));
const clinicalRows = computed(() => report.value.appointments.filter(item => item.diagnosis || item.treatment || item.medicalVisitDate));
const paymentRows = computed(() => report.value.cashMovements.filter(item => item.type === 'INCOME' || item.type === 'DEBT_PAYMENT'));
const followupRows = computed(() => [
  ...report.value.preventiveRecords.filter(item => item.nextAppointmentAt || item.sterilizationRecommended).map(item => ({
    id: `preventive-${item.id}`, nextAt: item.nextAppointmentAt, petName: item.petName, clientName: item.clientName,
    phone: item.phone, origin: item.type === 'DEWORMING' ? 'Desparasitación' : 'Vacuna',
    detail: item.nextProductName || (item.sterilizationRecommended ? 'Evaluar esterilización' : 'Control preventivo'),
    callStatus: item.sterilizationRecommended ? (item.sterilizationCallDone ? 'Llamada realizada' : 'Llamada pendiente') : (item.followUpCalled ? 'Seguimiento realizado' : 'Seguimiento pendiente'),
  })),
  ...report.value.appointments.filter(item => item.nextControlAt).map(item => ({
    id: `clinical-${item.id}`, nextAt: item.nextControlAt, petName: item.petName, clientName: item.clientName,
    phone: item.phone, origin: 'Ficha clínica', detail: item.diagnosis || item.reason || 'Próximo control', callStatus: 'Control programado',
  })),
].sort((a, b) => new Date(a.nextAt || 0) - new Date(b.nextAt || 0)));
const filteredCash = computed(() => filterReportRows(report.value.cashMovements, search.value));
const filteredPayments = computed(() => filterReportRows(paymentRows.value, search.value));
const filteredAttentions = computed(() => filterReportRows(report.value.appointments, search.value));
const filteredPreventive = computed(() => filterReportRows(report.value.preventiveRecords, search.value));
const filteredGrooming = computed(() => filterReportRows(groomingRows.value, search.value));
const filteredSurgery = computed(() => filterReportRows(surgeryRows.value, search.value));
const filteredCampaigns = computed(() => filterReportRows(campaignRows.value, search.value));
const filteredClinical = computed(() => filterReportRows(clinicalRows.value, search.value));
const filteredFollowups = computed(() => filterReportRows(followupRows.value, search.value));
const filteredTariff = computed(() => filterReportRows(report.value.services, search.value));
const filteredStaff = computed(() => filterReportRows(report.value.staff, search.value));
const sortedCategories = computed(() => report.value.byCategory.slice().sort((a, b) => Math.abs(Number(b.net)) - Math.abs(Number(a.net))));
const periodLabel = computed(() => fromDate.value === toDate.value
  ? formatDate(fromDate.value)
  : `${formatDate(fromDate.value)} — ${formatDate(toDate.value)}`);

function emptyReport() {
  return {
    range: {},
    summary: { income: 0, expenses: 0, adjustments: 0, net: 0, movements: 0, appointments: 0, attended: 0, preventive: 0, services: 0, staff: 0 },
    byCategory: [], byPaymentMethod: [], cashMovements: [], appointments: [], preventiveRecords: [], services: [], staff: [],
  };
}

function dateKey(value) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function usePreset(preset) {
  const base = new Date(`${today}T12:00:00`);
  if (preset === 'today') {
    fromDate.value = today;
    toDate.value = today;
  } else if (preset === 'week') {
    const day = base.getDay() || 7;
    const start = new Date(base);
    start.setDate(base.getDate() - day + 1);
    fromDate.value = dateKey(start);
    toDate.value = today;
  } else if (preset === 'year') {
    fromDate.value = `${today.slice(0, 4)}-01-01`;
    toDate.value = today;
  } else {
    fromDate.value = `${today.slice(0, 8)}01`;
    toDate.value = today;
  }
  loadReport();
}

function selectGroup(group) {
  reportGroup.value = group.value;
  reportView.value = views.find(view => view.group === group.value)?.value || 'overview';
  search.value = '';
}

async function loadReport() {
  if (!fromDate.value || !toDate.value || fromDate.value > toDate.value) {
    error.value = 'Selecciona un rango de fechas válido.';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/reports/classic?from=${fromDate.value}&to=${toDate.value}`);
    report.value = { ...emptyReport(), ...data, summary: { ...emptyReport().summary, ...(data.summary || {}) } };
  } catch (requestError) {
    error.value = requestError.response?.data?.message || 'No se pudo preparar el reporte. Intenta nuevamente.';
  } finally {
    loading.value = false;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Lima' }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima',
  }).format(date);
}

function money(value) {
  return Number(value || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function serviceLabel(row) {
  return [row.serviceName, row.serviceCondition].filter(Boolean).join(' · ') || row.reason || 'Atención';
}

function paymentStatus(row) {
  if (row.status === 'CANCELLED' || row.status === 'NO_SHOW') return 'No corresponde';
  if (Number(row.paidAmount || 0) >= Number(row.quotedPrice || 0) && Number(row.quotedPrice || 0) > 0) return 'Pagado';
  if (Number(row.paidAmount || 0) > 0) return 'Parcial';
  return row.status === 'ATTENDED' ? 'Pendiente' : 'Sin cobro';
}

function servicePriceLabel(service) {
  if (service.priceLabel) return service.priceLabel;
  if (service.requiresQuote) return `Desde S/ ${money(service.price)}`;
  if (service.maxPrice != null && Number(service.maxPrice) !== Number(service.price)) return `S/ ${money(service.price)} — ${money(service.maxPrice)}`;
  return `S/ ${money(service.price)}`;
}

function printReport() {
  window.print();
}

onMounted(loadReport);
</script>

<template>
  <section class="reports-workspace">
    <header class="reports-heading glass-card">
      <div>
        <span class="badge">Libro de control · Solo lectura</span>
        <h2>Registro general de Happy Dog</h2>
        <p>La misma lectura ordenada del archivo anterior, ahora completada automáticamente por el sistema.</p>
      </div>
      <button type="button" class="secondary report-print" @click="printReport">Imprimir reporte</button>
    </header>

    <section class="report-controls glass-card" aria-label="Filtros del reporte">
      <div class="report-presets">
        <button type="button" class="ghost small" @click="usePreset('today')">Hoy</button>
        <button type="button" class="ghost small" @click="usePreset('week')">Esta semana</button>
        <button type="button" class="ghost small" @click="usePreset('month')">Este mes</button>
        <button type="button" class="ghost small" @click="usePreset('year')">Este año</button>
      </div>
      <label>Desde<input v-model="fromDate" type="date" :max="toDate"></label>
      <label>Hasta<input v-model="toDate" type="date" :min="fromDate" :max="today"></label>
      <button type="button" :disabled="loading" @click="loadReport">{{ loading ? 'Consultando...' : 'Ver periodo' }}</button>
    </section>

    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div v-if="loading && !report.summary.movements && !report.summary.appointments" class="report-loading glass-card" role="status">
      <span></span><div><strong>Preparando reporte</strong><small>Ordenando caja, atenciones y seguimientos.</small></div>
    </div>

    <template v-else>
      <section class="workbook-frame">
        <div class="workbook-titlebar">
          <div>
            <span>HAPPY DOG</span>
            <strong>{{ views.find(view => view.value === reportView)?.label }}</strong>
          </div>
          <div class="workbook-period"><small>PERIODO CONSULTADO</small><strong>{{ periodLabel }}</strong></div>
        </div>

        <div class="report-metrics" aria-label="Resumen del periodo">
          <div><span>INGRESOS</span><strong>S/ {{ money(report.summary.income) }}</strong><small>{{ report.summary.movements }} movimientos</small></div>
          <div><span>EGRESOS</span><strong>S/ {{ money(report.summary.expenses) }}</strong><small>Gastos registrados</small></div>
          <div class="primary"><span>RESULTADO</span><strong>S/ {{ money(report.summary.net) }}</strong><small>Ingresos menos gastos</small></div>
          <div><span>ATENCIONES</span><strong>{{ report.summary.attended }} / {{ report.summary.appointments }}</strong><small>Atendidas / registradas</small></div>
        </div>

        <nav class="report-group-tabs" aria-label="Áreas del reporte">
          <button v-for="group in groups" :key="group.value" type="button" :class="{ active: reportGroup === group.value }" @click="selectGroup(group)">{{ group.label }}</button>
        </nav>

        <nav class="report-view-tabs" aria-label="Hojas del reporte">
          <button v-for="view in activeViews" :key="view.value" type="button" :class="{ active: reportView === view.value }" @click="reportView = view.value; search = ''">{{ view.label }}</button>
        </nav>

        <section v-if="reportView === 'overview'" class="report-overview-grid">
          <article class="report-summary-block">
            <div class="sheet-section-title"><strong>RESUMEN POR CATEGORÍA</strong><span>{{ sortedCategories.length }} categorías con movimiento</span></div>
            <div class="report-table-scroll overview-table">
              <table>
                <thead><tr><th>CATEGORÍA</th><th>INGRESOS</th><th>EGRESOS</th><th>RESULTADO</th></tr></thead>
                <tbody>
                  <tr v-if="!sortedCategories.length"><td colspan="4" class="report-empty-cell">Sin actividad en este periodo.</td></tr>
                  <tr v-for="category in sortedCategories" :key="category.key"><td><strong>{{ categoryLabels[category.key] || category.key }}</strong></td><td>S/ {{ money(category.income) }}</td><td>S/ {{ money(category.expenses) }}</td><td class="total-cell">S/ {{ money(category.net) }}</td></tr>
                </tbody>
                <tfoot><tr><th>TOTAL DEL PERIODO</th><td>S/ {{ money(report.summary.income) }}</td><td>S/ {{ money(report.summary.expenses) }}</td><td>S/ {{ money(report.summary.net) }}</td></tr></tfoot>
              </table>
            </div>
          </article>

          <article class="report-summary-block compact">
            <div class="sheet-section-title"><strong>MÉTODOS DE PAGO</strong><span>Distribución de cobros</span></div>
            <div class="report-table-scroll payment-table">
              <table><thead><tr><th>MÉTODO</th><th>TOTAL</th></tr></thead><tbody>
                <tr v-if="!report.byPaymentMethod.length"><td colspan="2" class="report-empty-cell">Sin cobros registrados.</td></tr>
                <tr v-for="method in report.byPaymentMethod" :key="method.key"><td>{{ paymentLabels[method.key] || method.key }}</td><td class="total-cell">S/ {{ money(method.total) }}</td></tr>
              </tbody><tfoot><tr><th>PREVENTIVOS</th><td>{{ report.summary.preventive }} registros</td></tr></tfoot></table>
            </div>
          </article>
        </section>

        <section v-else class="report-table-card">
        <div class="report-table-heading">
          <div><span>HOJA ACTIVA</span><h3>{{ views.find(view => view.value === reportView)?.label }}</h3></div>
          <input v-model="search" placeholder="Buscar dueño, mascota, servicio o responsable">
        </div>

        <div v-if="reportView === 'cash'" class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>CLIENTE / PACIENTE</th><th>CONCEPTO</th><th>CATEGORÍA</th><th>MÉTODO</th><th>INGRESO</th><th>EGRESO</th></tr></thead>
          <tbody><tr v-if="!filteredCash.length"><td colspan="7" class="report-empty-cell">No hay movimientos con este criterio.</td></tr>
          <tr v-for="row in filteredCash" :key="row.id"><td>{{ formatDateTime(row.occurredAt) }}</td><td><strong>{{ row.petName || row.counterparty || '—' }}</strong><small>{{ row.clientName }}</small></td><td>{{ row.description }}</td><td>{{ categoryLabels[row.category] || row.category }}</td><td>{{ paymentLabels[row.paymentMethod] || '—' }}</td><td class="money-positive">{{ row.type === 'EXPENSE' ? '—' : `S/ ${money(row.amount)}` }}</td><td class="money-negative">{{ row.type === 'EXPENSE' ? `S/ ${money(row.amount)}` : '—' }}</td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'payments'" class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>CLIENTE</th><th>PACIENTE</th><th>CONCEPTO</th><th>REFERENCIA</th><th>MÉTODO</th><th>MONTO</th><th>REGISTRADO POR</th></tr></thead>
          <tbody><tr v-if="!filteredPayments.length"><td colspan="8" class="report-empty-cell">No hay pagos realizados con este criterio.</td></tr>
          <tr v-for="row in filteredPayments" :key="row.id"><td>{{ formatDateTime(row.occurredAt) }}</td><td>{{ row.clientName || row.counterparty || '—' }}</td><td>{{ row.petName || '—' }}</td><td>{{ row.description }}</td><td>{{ row.referenceCode || '—' }}</td><td>{{ paymentLabels[row.paymentMethod] || '—' }}</td><td class="money-positive">S/ {{ money(row.amount) }}</td><td>{{ row.responsible || '—' }}</td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'tariff'" class="report-table-scroll">
          <table><thead><tr><th>CATEGORÍA</th><th>SERVICIO</th><th>ESPECIE</th><th>CONDICIÓN</th><th>PRECIO</th><th>PRECIO SOCIAL</th><th>DURACIÓN</th><th>ESTADO</th></tr></thead>
          <tbody><tr v-if="!filteredTariff.length"><td colspan="8" class="report-empty-cell">No hay servicios con este criterio.</td></tr>
          <tr v-for="row in filteredTariff" :key="row.id"><td>{{ row.category || 'OTROS' }}</td><td><strong>{{ row.name }}</strong><small>{{ row.description }}</small></td><td>{{ row.species || 'Todas' }}</td><td>{{ row.condition || 'General' }}</td><td class="total-cell">{{ servicePriceLabel(row) }}</td><td>{{ row.socialPrice == null ? '—' : `S/ ${money(row.socialPrice)}` }}</td><td>{{ row.durationMinutes }} min</td><td><span class="report-status" :data-status="row.active ? 'ATTENDED' : 'CANCELLED'">{{ row.active ? 'Activo' : 'Retirado' }}</span></td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'staff'" class="report-table-scroll">
          <table><thead><tr><th>NOMBRE</th><th>CORREO</th><th>ROL</th><th>HORARIO DE TRABAJO</th><th>ESTADO</th></tr></thead>
          <tbody><tr v-if="!filteredStaff.length"><td colspan="5" class="report-empty-cell">No hay personal registrado con este criterio.</td></tr>
          <tr v-for="row in filteredStaff" :key="row.id"><td><strong>{{ row.fullName }}</strong></td><td>{{ row.email }}</td><td>{{ roleLabels[row.role] || row.role }}</td><td>{{ row.workSchedule || 'No especificado' }}</td><td><span class="report-status" :data-status="row.active ? 'ATTENDED' : 'CANCELLED'">{{ row.active ? 'Activo' : 'Inactivo' }}</span></td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'preventive'" class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>PACIENTE</th><th>DUEÑO</th><th>RAZA / SEXO</th><th>VACUNA / DESPARASITACIÓN</th><th>PESO</th><th>COSTO</th><th>PRÓXIMA FECHA</th><th>MÉDICO</th></tr></thead>
          <tbody><tr v-if="!filteredPreventive.length"><td colspan="9" class="report-empty-cell">No hay vacunas o desparasitaciones con este criterio.</td></tr>
          <tr v-for="row in filteredPreventive" :key="row.id"><td>{{ formatDate(row.appliedAt) }}</td><td><strong>{{ row.petName }}</strong><small>{{ row.species }} · {{ row.age || 'Edad no indicada' }}</small></td><td>{{ row.clientName }}<small>{{ row.phone }}</small></td><td>{{ row.breed || 'Sin raza' }}<small>{{ sexLabels[row.sex] || row.sex }}</small></td><td>{{ row.productName }}<small>{{ row.type === 'DEWORMING' ? 'Desparasitación' : 'Vacuna' }}</small></td><td>{{ row.weightKg == null ? '—' : `${row.weightKg} kg` }}</td><td>S/ {{ money(row.amountCharged) }}</td><td>{{ formatDate(row.nextAppointmentAt) }}</td><td>{{ row.veterinarianName || '—' }}</td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'clinical'" class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>PACIENTE</th><th>DUEÑO</th><th>PESO / T°</th><th>MOTIVO</th><th>DIAGNÓSTICO</th><th>TRATAMIENTO</th><th>PRÓXIMO CONTROL</th><th>MÉDICO</th></tr></thead>
          <tbody><tr v-if="!filteredClinical.length"><td colspan="9" class="report-empty-cell">No hay fichas clínicas en este periodo.</td></tr>
          <tr v-for="row in filteredClinical" :key="row.id"><td>{{ formatDateTime(row.medicalVisitDate || row.scheduledAt) }}</td><td><strong>{{ row.petName }}</strong><small>{{ row.species }} · {{ row.breed || 'Sin raza' }}</small></td><td>{{ row.clientName }}<small>{{ row.phone }}</small></td><td>{{ row.medicalWeightKg == null ? (row.weightKg == null ? '—' : `${row.weightKg} kg`) : `${row.medicalWeightKg} kg` }}<small>{{ row.temperatureC == null ? 'Temperatura —' : `${row.temperatureC} °C` }}</small></td><td>{{ row.medicalReason || row.reason }}</td><td>{{ row.diagnosis || '—' }}<small>{{ row.observations }}</small></td><td>{{ row.treatment || '—' }}</td><td>{{ formatDate(row.nextControlAt) }}</td><td>{{ row.veterinarianName || '—' }}</td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'followups'" class="report-table-scroll">
          <table><thead><tr><th>PRÓXIMA FECHA</th><th>PACIENTE</th><th>DUEÑO</th><th>TELÉFONO</th><th>ORIGEN</th><th>SEGUIMIENTO</th><th>ESTADO</th></tr></thead>
          <tbody><tr v-if="!filteredFollowups.length"><td colspan="7" class="report-empty-cell">No hay seguimientos pendientes o programados.</td></tr>
          <tr v-for="row in filteredFollowups" :key="row.id"><td>{{ formatDate(row.nextAt) }}</td><td><strong>{{ row.petName }}</strong></td><td>{{ row.clientName }}</td><td>{{ row.phone || '—' }}</td><td>{{ row.origin }}</td><td>{{ row.detail }}</td><td><span class="report-status" :data-status="/realizada|programado/.test(row.callStatus.toLowerCase()) ? 'ATTENDED' : 'PENDING'">{{ row.callStatus }}</span></td></tr></tbody></table>
        </div>

        <div v-else class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>DUEÑO</th><th>PACIENTE</th><th>ATENCIÓN</th><th>ESTADO</th><th>PRECIO</th><th>PAGO</th><th>RESPONSABLE</th></tr></thead>
          <tbody>
            <tr v-if="!(reportView === 'grooming' ? filteredGrooming : reportView === 'surgery' ? filteredSurgery : reportView === 'campaigns' ? filteredCampaigns : filteredAttentions).length"><td colspan="8" class="report-empty-cell">No hay atenciones con este criterio.</td></tr>
            <tr v-for="row in (reportView === 'grooming' ? filteredGrooming : reportView === 'surgery' ? filteredSurgery : reportView === 'campaigns' ? filteredCampaigns : filteredAttentions)" :key="row.id">
              <td>{{ formatDateTime(row.scheduledAt) }}<small v-if="row.pickupAt">Recojo {{ formatDateTime(row.pickupAt) }}</small></td><td><strong>{{ row.clientName }}</strong><small>{{ row.phone }}</small></td><td><strong>{{ row.petName }}</strong><small>{{ row.species }} · {{ row.breed || 'Sin raza' }}</small></td><td>{{ serviceLabel(row) }}<small>{{ row.reason }}</small></td><td><span class="report-status" :data-status="row.status">{{ statusLabels[row.status] || row.status }}</span></td><td>S/ {{ money(row.quotedPrice) }}</td><td>{{ paymentStatus(row) }}<small v-if="row.paidAmount">S/ {{ money(row.paidAmount) }}</small></td><td>{{ row.veterinarianName || 'Recepción' }}</td>
            </tr>
          </tbody></table>
        </div>
      </section>
      </section>
    </template>
  </section>
</template>

<style scoped>
.reports-workspace { display: grid; gap: 14px; }
.reports-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 21px 23px; }
.reports-heading h2,.report-table-heading h3 { margin: 7px 0 4px; }
.reports-heading p { max-width: 760px; margin: 0; color: #687a75; line-height: 1.5; }
.report-controls { display: grid; grid-template-columns: 1fr 155px 155px auto; align-items: end; gap: 10px; padding: 12px 14px; }
.report-controls label { display: grid; gap: 5px; color: #435b56; font-size: .78rem; font-weight: 900; }
.report-controls input { padding: 9px 10px; }
.report-presets { display: flex; gap: 6px; flex-wrap: wrap; }
.report-loading { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 150px; color: #42625d; }
.report-loading > span { width: 15px; height: 15px; border: 3px solid #cce5df; border-top-color: #147a72; border-radius: 50%; animation: report-spin .8s linear infinite; }
.report-loading div { display: grid; gap: 3px; }.report-loading small { color: #71837f; } @keyframes report-spin { to { transform: rotate(360deg); } }
.workbook-frame { overflow: hidden; border: 1px solid #9cafb0; border-radius: 15px; background: #fff; box-shadow: 0 18px 42px rgba(28,67,68,.1); }
.workbook-titlebar { display: flex; align-items: stretch; justify-content: space-between; min-height: 68px; color: #fff; background: #073763; border-bottom: 4px solid #da9694; }
.workbook-titlebar > div:first-child { display: grid; align-content: center; gap: 2px; padding: 12px 20px; }.workbook-titlebar span,.workbook-titlebar small { font-size: .69rem; font-weight: 900; letter-spacing: .08em; }.workbook-titlebar > div:first-child strong { font-size: 1.25rem; }
.workbook-period { display: grid; align-content: center; gap: 4px; min-width: 290px; padding: 11px 20px; color: #183a3b; background: #f1e6dc; border-left: 1px solid #fff; }.workbook-period strong { font-size: .9rem; }
.report-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); border-bottom: 1px solid #8fa2a3; }
.report-metrics > div { min-height: 86px; padding: 13px 16px; background: #fff; border-right: 1px solid #aab7b8; }.report-metrics > div:nth-child(odd) { background: #d5e2fb; }.report-metrics > div:last-child { border-right: 0; }
.report-metrics span,.report-metrics small { display: block; color: #3f5556; }.report-metrics span { font-size: .7rem; font-weight: 900; }.report-metrics strong { display: block; margin: 5px 0 2px; color: #102f31; font-size: 1.35rem; }.report-metrics .primary { background: #fff2cc; }.report-metrics .primary strong { color: #073763; }
.report-group-tabs { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 1px; padding: 8px; background: #073763; }
.report-group-tabs button { min-height: 38px; border: 1px solid rgba(255,255,255,.28); border-radius: 5px; color: #dce8ec; background: rgba(255,255,255,.08); box-shadow: none; }.report-group-tabs button.active { color: #17393a; background: #f1e6dc; border-color: #f1e6dc; }
.report-view-tabs { display: flex; gap: 2px; padding: 7px 10px 0; overflow-x: auto; background: #e8eeee; border-bottom: 1px solid #8fa2a3; }
.report-view-tabs button { min-width: 126px; padding: 9px 14px; border: 1px solid #a8b5b6; border-bottom: 0; border-radius: 8px 8px 0 0; background: #f7f9f9; color: #486062; box-shadow: none; }.report-view-tabs button.active { position: relative; color: #fff; background: #0d5f60; border-color: #0d5f60; }.report-view-tabs button.active::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 3px; background: #da9694; content: ''; }
.report-overview-grid { display: grid; grid-template-columns: minmax(0,1.55fr) minmax(290px,.65fr); gap: 18px; padding: 18px; background: #f7f9f9; }.report-summary-block { min-width: 0; }.report-summary-block.compact { align-self: start; }
.sheet-section-title { display: flex; align-items: center; justify-content: space-between; min-height: 39px; padding: 8px 12px; color: #fff; background: #073763; border: 1px solid #073763; }.sheet-section-title span { font-size: .75rem; color: #d9e5ef; }
.report-table-card { padding: 18px; overflow: hidden; background: #f7f9f9; }.report-table-heading { display: flex; align-items: end; justify-content: space-between; gap: 15px; margin-bottom: 10px; }.report-table-heading span { color: #6c7c7c; font-size: .68rem; font-weight: 900; letter-spacing: .08em; }.report-table-heading input { width: min(390px,100%); background: #fff; }
.report-table-scroll { overflow-x: auto; border: 1px solid #8fa2a3; background: #fff; }.report-table-scroll table { width: 100%; min-width: 920px; border-collapse: collapse; }.overview-table table,.payment-table table { min-width: 0; }
.report-table-scroll th { padding: 10px 11px; color: #fff; background: #073763; border-right: 1px solid rgba(255,255,255,.35); font-size: .7rem; text-align: center; vertical-align: middle; }.report-table-scroll th:last-child { border-right: 0; }
.report-table-scroll td { height: 42px; padding: 9px 11px; color: #263d3e; border-right: 1px solid #b8c3c4; border-bottom: 1px solid #b8c3c4; font-size: .82rem; text-align: left; vertical-align: top; }.report-table-scroll td:last-child { border-right: 0; }.report-table-scroll tbody tr:nth-child(even) td { background: #f1e6dc; }.report-table-scroll tbody tr:hover td { background: #fff2cc; }.report-table-scroll td small { display: block; margin-top: 3px; color: #6f7d7e; }.report-table-scroll tbody tr:last-child td { border-bottom: 0; }
.report-table-scroll tfoot th,.report-table-scroll tfoot td { height: 42px; padding: 9px 11px; color: #173738; background: #d5e2fb; border-top: 2px solid #073763; font-weight: 900; }.report-table-scroll tfoot th { text-align: left; }.total-cell { color: #073763 !important; background: #d5e2fb !important; font-weight: 900; }
.report-empty-cell { height: 92px !important; padding: 26px !important; text-align: center !important; color: #687879 !important; background: repeating-linear-gradient(0deg,#fff 0,#fff 40px,#edf1f1 41px) !important; }.money-positive { color: #08745b !important; font-weight: 900; }.money-negative { color: #a43f3a !important; font-weight: 900; }.report-status { display: inline-flex; padding: 4px 7px; border-radius: 4px; background: #d5e2fb; color: #314d50; font-size: .69rem; font-weight: 900; }.report-status[data-status="ATTENDED"],.report-status[data-status="COMPLETED"] { background: #d9ead3; color: #286342; }.report-status[data-status="CANCELLED"],.report-status[data-status="NO_SHOW"] { background: #f4cccc; color: #8c3530; }
@media (max-width: 1050px) { .report-controls { grid-template-columns: 1fr 1fr; }.report-presets { grid-column: 1 / -1; }.report-metrics { grid-template-columns: repeat(2,1fr); }.report-metrics > div:nth-child(2) { border-right: 0; }.report-overview-grid { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .reports-heading,.report-table-heading,.workbook-titlebar { display: grid; }.report-print { width: 100%; }.report-controls { grid-template-columns: 1fr; }.report-presets { grid-column: auto; }.report-controls > button { width: 100%; }.workbook-period { min-width: 0; border-top: 1px solid rgba(255,255,255,.6); border-left: 0; }.report-metrics { grid-template-columns: 1fr 1fr; }.report-metrics > div { min-height: 78px; padding: 11px; }.report-metrics strong { font-size: 1.08rem; }.report-group-tabs { grid-template-columns: repeat(2,1fr); }.report-group-tabs button:first-child { grid-column: 1 / -1; }.report-view-tabs button { min-width: 130px; }.report-overview-grid,.report-table-card { padding: 10px; }.sheet-section-title { align-items: flex-start; gap: 4px; }.sheet-section-title span { text-align: right; }.report-table-heading input { width: 100%; } }
@media print { .reports-heading,.report-controls,.report-group-tabs,.report-view-tabs,.report-print { display: none !important; }.reports-workspace { gap: 0; }.workbook-frame { border-radius: 0; box-shadow: none; }.report-overview-grid,.report-table-card { padding: 8px 0; }.report-table-scroll { overflow: visible; }.report-table-scroll table { min-width: 0; font-size: 8px; }.report-table-scroll th,.report-table-scroll td { padding: 5px; } }
</style>
