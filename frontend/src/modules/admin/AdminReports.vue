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

        <nav class="report-view-tabs" aria-label="Vistas del reporte">
          <button v-for="view in views" :key="view.value" type="button" :class="{ active: reportView === view.value }" @click="reportView = view.value; search = ''">{{ view.label }}</button>
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

        <div v-else-if="reportView === 'preventive'" class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>PACIENTE</th><th>DUEÑO</th><th>VACUNA / DESPARASITACIÓN</th><th>PESO</th><th>COSTO</th><th>PRÓXIMA FECHA</th><th>MÉDICO</th></tr></thead>
          <tbody><tr v-if="!filteredPreventive.length"><td colspan="8" class="report-empty-cell">No hay vacunas o desparasitaciones con este criterio.</td></tr>
          <tr v-for="row in filteredPreventive" :key="row.id"><td>{{ formatDate(row.appliedAt) }}</td><td><strong>{{ row.petName }}</strong><small>{{ row.species }} · {{ row.breed || 'Sin raza' }}</small></td><td>{{ row.clientName }}<small>{{ row.phone }}</small></td><td>{{ row.productName }}<small>{{ row.type === 'DEWORMING' ? 'Desparasitación' : 'Vacuna' }}</small></td><td>{{ row.weightKg == null ? '—' : `${row.weightKg} kg` }}</td><td>S/ {{ money(row.amountCharged) }}</td><td>{{ formatDate(row.nextAppointmentAt) }}</td><td>{{ row.veterinarianName || '—' }}</td></tr></tbody></table>
        </div>

        <div v-else class="report-table-scroll">
          <table><thead><tr><th>FECHA</th><th>DUEÑO</th><th>PACIENTE</th><th>ATENCIÓN</th><th>ESTADO</th><th>PRECIO</th><th>PAGO</th><th>RESPONSABLE</th></tr></thead>
          <tbody>
            <tr v-if="!(reportView === 'grooming' ? filteredGrooming : reportView === 'surgery' ? filteredSurgery : filteredAttentions).length"><td colspan="8" class="report-empty-cell">No hay atenciones con este criterio.</td></tr>
            <tr v-for="row in (reportView === 'grooming' ? filteredGrooming : reportView === 'surgery' ? filteredSurgery : filteredAttentions)" :key="row.id">
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
@media (max-width: 650px) { .reports-heading,.report-table-heading,.workbook-titlebar { display: grid; }.report-print { width: 100%; }.report-controls { grid-template-columns: 1fr; }.report-presets { grid-column: auto; }.report-controls > button { width: 100%; }.workbook-period { min-width: 0; border-top: 1px solid rgba(255,255,255,.6); border-left: 0; }.report-metrics { grid-template-columns: 1fr 1fr; }.report-metrics > div { min-height: 78px; padding: 11px; }.report-metrics strong { font-size: 1.08rem; }.report-view-tabs button { min-width: 112px; }.report-overview-grid,.report-table-card { padding: 10px; }.sheet-section-title { align-items: flex-start; gap: 4px; }.sheet-section-title span { text-align: right; }.report-table-heading input { width: 100%; } }
@media print { .reports-heading,.report-controls,.report-view-tabs,.report-print { display: none !important; }.reports-workspace { gap: 0; }.workbook-frame { border-radius: 0; box-shadow: none; }.report-overview-grid,.report-table-card { padding: 8px 0; }.report-table-scroll { overflow: visible; }.report-table-scroll table { min-width: 0; font-size: 8px; }.report-table-scroll th,.report-table-scroll td { padding: 5px; } }
</style>
