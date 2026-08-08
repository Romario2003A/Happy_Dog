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
const search = ref('');
const today = dateKey(new Date());
const fromDate = ref(`${today.slice(0, 8)}01`);
const toDate = ref(today);
const report = ref(emptyReport());

const views = [
  { value: 'overview', label: 'Resumen' },
  { value: 'cash', label: 'Caja' },
  { value: 'attentions', label: 'Atenciones' },
  { value: 'preventive', label: 'Vacunas' },
  { value: 'grooming', label: 'Baño y corte' },
  { value: 'surgery', label: 'Cirugías' },
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

const groomingRows = computed(() => report.value.appointments.filter(isGroomingReportAppointment));
const surgeryRows = computed(() => report.value.appointments.filter(item => isSurgeryReportAppointment(item) || isCampaignReportAppointment(item)));
const filteredCash = computed(() => filterReportRows(report.value.cashMovements, search.value));
const filteredAttentions = computed(() => filterReportRows(report.value.appointments, search.value));
const filteredPreventive = computed(() => filterReportRows(report.value.preventiveRecords, search.value));
const filteredGrooming = computed(() => filterReportRows(groomingRows.value, search.value));
const filteredSurgery = computed(() => filterReportRows(surgeryRows.value, search.value));
const sortedCategories = computed(() => report.value.byCategory.slice().sort((a, b) => Math.abs(Number(b.net)) - Math.abs(Number(a.net))));
const periodLabel = computed(() => fromDate.value === toDate.value
  ? formatDate(fromDate.value)
  : `${formatDate(fromDate.value)} — ${formatDate(toDate.value)}`);

function emptyReport() {
  return {
    range: {},
    summary: { income: 0, expenses: 0, adjustments: 0, net: 0, movements: 0, appointments: 0, attended: 0, preventive: 0 },
    byCategory: [], byPaymentMethod: [], cashMovements: [], appointments: [], preventiveRecords: [],
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

function printReport() {
  window.print();
}

onMounted(loadReport);
</script>

<template>
  <section class="reports-workspace">
    <header class="reports-heading glass-card">
      <div>
        <span class="badge">Vista clásica · Solo lectura</span>
        <h2>Reportes del negocio</h2>
        <p>La información se organiza automáticamente desde citas, atenciones y caja. Aquí no se modifica ningún registro.</p>
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
      <div class="report-period-line"><span>Periodo consultado</span><strong>{{ periodLabel }}</strong></div>

      <div class="report-metrics">
        <article><span>Ingresos</span><strong>S/ {{ money(report.summary.income) }}</strong><small>{{ report.summary.movements }} movimientos</small></article>
        <article><span>Gastos</span><strong>S/ {{ money(report.summary.expenses) }}</strong><small>Egresos registrados</small></article>
        <article class="primary"><span>Resultado</span><strong>S/ {{ money(report.summary.net) }}</strong><small>Ingresos menos gastos</small></article>
        <article><span>Atenciones</span><strong>{{ report.summary.attended }} / {{ report.summary.appointments }}</strong><small>Atendidas / registradas</small></article>
      </div>

      <nav class="report-view-tabs" aria-label="Vistas del reporte">
        <button v-for="view in views" :key="view.value" type="button" :class="{ active: reportView === view.value }" @click="reportView = view.value; search = ''">{{ view.label }}</button>
      </nav>

      <section v-if="reportView === 'overview'" class="report-overview-grid">
        <article class="glass-card report-summary-block">
          <div class="report-block-title"><div><span class="badge">Actividad</span><h3>Resultado por categoría</h3></div><small>{{ sortedCategories.length }} categorías con movimiento</small></div>
          <div v-if="sortedCategories.length" class="report-category-list">
            <div v-for="category in sortedCategories" :key="category.key">
              <span>{{ categoryLabels[category.key] || category.key }}</span>
              <strong>S/ {{ money(category.net) }}</strong>
              <small>Ingresos S/ {{ money(category.income) }} · Gastos S/ {{ money(category.expenses) }}</small>
            </div>
          </div>
          <div v-else class="report-empty"><strong>Sin actividad en este periodo</strong><span>Los resultados aparecerán cuando se registren cobros o gastos.</span></div>
        </article>

        <article class="glass-card report-summary-block compact">
          <div class="report-block-title"><div><span class="badge">Cobros</span><h3>Métodos de pago</h3></div></div>
          <div v-if="report.byPaymentMethod.length" class="report-payment-list">
            <div v-for="method in report.byPaymentMethod" :key="method.key"><span>{{ paymentLabels[method.key] || method.key }}</span><strong>S/ {{ money(method.total) }}</strong></div>
          </div>
          <div v-else class="report-empty"><strong>Sin cobros registrados</strong><span>El desglose aparecerá automáticamente.</span></div>
          <div class="report-followup-note"><span>Preventivo registrado</span><strong>{{ report.summary.preventive }}</strong><small>Vacunas o desparasitaciones aplicadas</small></div>
        </article>
      </section>

      <section v-else class="glass-card report-table-card">
        <div class="report-table-heading">
          <div><span class="badge">Consulta visual</span><h3>{{ views.find(view => view.value === reportView)?.label }}</h3></div>
          <input v-model="search" placeholder="Buscar dueño, mascota, servicio o responsable">
        </div>

        <div v-if="reportView === 'cash'" class="report-table-scroll">
          <table><thead><tr><th>Fecha</th><th>Cliente / paciente</th><th>Concepto</th><th>Categoría</th><th>Método</th><th>Ingreso</th><th>Gasto</th></tr></thead>
          <tbody><tr v-if="!filteredCash.length"><td colspan="7" class="report-empty-cell">No hay movimientos con este criterio.</td></tr>
          <tr v-for="row in filteredCash" :key="row.id"><td>{{ formatDateTime(row.occurredAt) }}</td><td><strong>{{ row.petName || row.counterparty || '—' }}</strong><small>{{ row.clientName }}</small></td><td>{{ row.description }}</td><td>{{ categoryLabels[row.category] || row.category }}</td><td>{{ paymentLabels[row.paymentMethod] || '—' }}</td><td class="money-positive">{{ row.type === 'EXPENSE' ? '—' : `S/ ${money(row.amount)}` }}</td><td class="money-negative">{{ row.type === 'EXPENSE' ? `S/ ${money(row.amount)}` : '—' }}</td></tr></tbody></table>
        </div>

        <div v-else-if="reportView === 'preventive'" class="report-table-scroll">
          <table><thead><tr><th>Fecha</th><th>Paciente</th><th>Dueño</th><th>Aplicación</th><th>Peso</th><th>Costo</th><th>Próxima fecha</th><th>Médico</th></tr></thead>
          <tbody><tr v-if="!filteredPreventive.length"><td colspan="8" class="report-empty-cell">No hay vacunas o desparasitaciones con este criterio.</td></tr>
          <tr v-for="row in filteredPreventive" :key="row.id"><td>{{ formatDate(row.appliedAt) }}</td><td><strong>{{ row.petName }}</strong><small>{{ row.species }} · {{ row.breed || 'Sin raza' }}</small></td><td>{{ row.clientName }}<small>{{ row.phone }}</small></td><td>{{ row.productName }}<small>{{ row.type === 'DEWORMING' ? 'Desparasitación' : 'Vacuna' }}</small></td><td>{{ row.weightKg == null ? '—' : `${row.weightKg} kg` }}</td><td>S/ {{ money(row.amountCharged) }}</td><td>{{ formatDate(row.nextAppointmentAt) }}</td><td>{{ row.veterinarianName || '—' }}</td></tr></tbody></table>
        </div>

        <div v-else class="report-table-scroll">
          <table><thead><tr><th>Fecha</th><th>Dueño</th><th>Paciente</th><th>Atención</th><th>Estado</th><th>Precio</th><th>Pago</th><th>Responsable</th></tr></thead>
          <tbody>
            <tr v-if="!(reportView === 'grooming' ? filteredGrooming : reportView === 'surgery' ? filteredSurgery : filteredAttentions).length"><td colspan="8" class="report-empty-cell">No hay atenciones con este criterio.</td></tr>
            <tr v-for="row in (reportView === 'grooming' ? filteredGrooming : reportView === 'surgery' ? filteredSurgery : filteredAttentions)" :key="row.id">
              <td>{{ formatDateTime(row.scheduledAt) }}<small v-if="row.pickupAt">Recojo {{ formatDateTime(row.pickupAt) }}</small></td><td><strong>{{ row.clientName }}</strong><small>{{ row.phone }}</small></td><td><strong>{{ row.petName }}</strong><small>{{ row.species }} · {{ row.breed || 'Sin raza' }}</small></td><td>{{ serviceLabel(row) }}<small>{{ row.reason }}</small></td><td><span class="report-status" :data-status="row.status">{{ statusLabels[row.status] || row.status }}</span></td><td>S/ {{ money(row.quotedPrice) }}</td><td>{{ paymentStatus(row) }}<small v-if="row.paidAmount">S/ {{ money(row.paidAmount) }}</small></td><td>{{ row.veterinarianName || 'Recepción' }}</td>
            </tr>
          </tbody></table>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.reports-workspace { display: grid; gap: 17px; }
.reports-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; padding: 24px; }
.reports-heading h2,.report-block-title h3,.report-table-heading h3 { margin: 7px 0 4px; }
.reports-heading p { max-width: 720px; margin: 0; color: #687a75; line-height: 1.5; }
.report-controls { display: grid; grid-template-columns: 1fr 155px 155px auto; align-items: end; gap: 10px; padding: 14px; }
.report-controls label { display: grid; gap: 5px; color: #435b56; font-size: .78rem; font-weight: 900; }
.report-controls input { padding: 9px 10px; }
.report-presets { display: flex; gap: 6px; flex-wrap: wrap; }
.report-period-line { display: flex; align-items: center; justify-content: center; gap: 9px; color: #60736e; font-size: .86rem; }
.report-period-line strong { color: #173c38; }
.report-loading { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 150px; color: #42625d; }
.report-loading > span { width: 15px; height: 15px; border: 3px solid #cce5df; border-top-color: #147a72; border-radius: 50%; animation: report-spin .8s linear infinite; }
.report-loading div { display: grid; gap: 3px; }.report-loading small { color: #71837f; } @keyframes report-spin { to { transform: rotate(360deg); } }
.report-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 11px; }
.report-metrics article { padding: 17px; border: 1px solid rgba(13,95,96,.13); border-radius: 20px; background: linear-gradient(145deg,rgba(255,255,255,.94),rgba(231,248,243,.66)); box-shadow: 0 14px 35px rgba(17,78,77,.07); }
.report-metrics span,.report-metrics small { display: block; color: #687a75; }.report-metrics span { font-size: .76rem; font-weight: 900; text-transform: uppercase; }.report-metrics strong { display: block; margin: 7px 0 3px; color: #15312c; font-size: 1.55rem; }
.report-metrics .primary { background: linear-gradient(135deg,#176c72,#149882); }.report-metrics .primary span,.report-metrics .primary strong,.report-metrics .primary small { color: #fff; }
.report-view-tabs { display: grid; grid-template-columns: repeat(6,minmax(0,1fr)); gap: 5px; padding: 5px; border: 1px solid rgba(13,95,96,.12); border-radius: 17px; background: rgba(225,241,238,.72); }
.report-view-tabs button { border: 0; background: transparent; color: #5e7470; box-shadow: none; }.report-view-tabs button.active { background: #fff; color: #155f66; box-shadow: 0 8px 20px rgba(15,74,76,.1); }
.report-overview-grid { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(280px,.75fr); gap: 13px; }.report-summary-block { padding: 20px; }.report-summary-block.compact { align-self: start; }
.report-block-title,.report-table-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 15px; }.report-block-title small { color: #71817d; }
.report-category-list { display: grid; grid-template-columns: repeat(auto-fit,minmax(185px,1fr)); gap: 8px; margin-top: 15px; }.report-category-list > div,.report-payment-list > div { padding: 12px; border-radius: 15px; background: #edf7f4; }.report-category-list span,.report-category-list small,.report-payment-list span { display: block; color: #657873; }.report-category-list strong { display: block; margin: 4px 0; color: #155f5f; }
.report-payment-list { display: grid; gap: 8px; margin-top: 15px; }.report-payment-list > div { display: flex; justify-content: space-between; gap: 12px; }.report-followup-note { display: grid; gap: 3px; margin-top: 12px; padding: 14px; border: 1px solid rgba(13,95,96,.12); border-radius: 16px; }.report-followup-note span,.report-followup-note small { color: #667873; }.report-followup-note strong { color: #155f66; font-size: 1.45rem; }
.report-empty { display: grid; gap: 4px; margin-top: 14px; padding: 23px; border: 1px dashed rgba(13,95,96,.2); border-radius: 17px; text-align: center; color: #657873; }
.report-table-card { padding: 20px; overflow: hidden; }.report-table-heading { align-items: end; margin-bottom: 14px; }.report-table-heading input { width: min(390px,100%); }.report-table-scroll { overflow-x: auto; border: 1px solid rgba(13,95,96,.1); border-radius: 16px; }.report-table-scroll table { width: 100%; min-width: 920px; border-collapse: collapse; }.report-table-scroll th { background: #edf6f4; color: #496660; font-size: .72rem; text-transform: uppercase; }.report-table-scroll th,.report-table-scroll td { padding: 12px; border-bottom: 1px solid rgba(13,95,96,.1); text-align: left; vertical-align: top; }.report-table-scroll td { color: #243d38; font-size: .84rem; }.report-table-scroll td small { display: block; margin-top: 3px; color: #75847f; }.report-table-scroll tbody tr:last-child td { border-bottom: 0; }
.report-empty-cell { padding: 28px !important; text-align: center !important; color: #74837f !important; }.money-positive { color: #087f5b !important; font-weight: 900; }.money-negative { color: #b42318 !important; font-weight: 900; }.report-status { display: inline-flex; padding: 5px 8px; border-radius: 999px; background: #e7f2ef; color: #42615b; font-size: .72rem; font-weight: 900; }.report-status[data-status="ATTENDED"],.report-status[data-status="COMPLETED"] { background: #dcf4e9; color: #087255; }.report-status[data-status="CANCELLED"],.report-status[data-status="NO_SHOW"] { background: #f5eceb; color: #9f3e37; }
@media (max-width: 1050px) { .report-controls { grid-template-columns: 1fr 1fr; }.report-presets { grid-column: 1 / -1; }.report-metrics { grid-template-columns: repeat(2,1fr); }.report-view-tabs { grid-template-columns: repeat(3,1fr); }.report-overview-grid { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .reports-heading,.report-table-heading { display: grid; }.report-print { width: 100%; }.report-controls,.report-metrics { grid-template-columns: 1fr; }.report-presets { grid-column: auto; }.report-controls > button { width: 100%; }.report-view-tabs { grid-template-columns: repeat(2,1fr); }.report-metrics strong { font-size: 1.3rem; }.report-table-heading input { width: 100%; } }
@media print { .report-controls,.report-view-tabs,.report-print { display: none !important; }.reports-workspace { gap: 10px; }.glass-card { box-shadow: none !important; }.report-table-card { overflow: visible; }.report-table-scroll { overflow: visible; }.report-table-scroll table { min-width: 0; font-size: 9px; } }
</style>
