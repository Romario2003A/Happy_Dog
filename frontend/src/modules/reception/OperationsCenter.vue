<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { api } from '../../services/api';

const emit = defineEmits(['open-appointment', 'go-cash', 'updated']);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const filter = ref('all');
const center = ref({ summary: { total: 0, overdue: 0, today: 0, upcoming: 0, unassigned: 0 }, tasks: [], staff: [], obligations: [] });
const assignment = ref({});
const showObligationForm = ref(false);
const obligationForm = ref({ name: '', payee: '', category: '', amount: '', nextDueAt: '', recurrence: 'MONTHLY', referenceCode: '', notes: '' });
const payingId = ref('');
const paymentMethod = ref('CASH');
let refreshTimer;

const filters = [
  { value: 'all', label: 'Todo' },
  { value: 'urgent', label: 'Requiere acción' },
  { value: 'clinical', label: 'Seguimientos clínicos' },
  { value: 'service', label: 'Servicios y recojos' },
  { value: 'payments', label: 'Cobros y pagos' },
];

const filteredTasks = computed(() => center.value.tasks.filter(task => {
  if (filter.value === 'urgent') return ['overdue', 'today'].includes(task.priority);
  if (filter.value === 'clinical') return ['PREVENTIVE_CALL', 'STERILIZATION_CALL', 'SUTURE'].includes(task.type);
  if (filter.value === 'service') return ['PICKUP', 'UNASSIGNED'].includes(task.type);
  if (filter.value === 'payments') return ['DEBT', 'OBLIGATION'].includes(task.type);
  return true;
}));

const taskLabels = {
  PREVENTIVE_CALL: 'Llamada', STERILIZATION_CALL: 'Llamada', SUTURE: 'Clínico',
  PICKUP: 'Recojo', DEBT: 'Por cobrar', OBLIGATION: 'Pago próximo', UNASSIGNED: 'Coordinación',
};

async function loadCenter(silent = false) {
  if (!silent) loading.value = true;
  error.value = '';
  try { center.value = (await api.get('/operations/center?days=30')).data; }
  catch (e) { error.value = e.response?.data?.message || 'No se pudieron cargar los pendientes.'; }
  finally { if (!silent) loading.value = false; }
}

async function resolveTask(task, action) {
  saving.value = true; error.value = ''; success.value = '';
  try {
    if (task.type === 'PREVENTIVE_CALL') await api.patch(`/operations/preventive/${task.sourceId}/call`, { kind: 'FOLLOW_UP' });
    if (task.type === 'STERILIZATION_CALL') await api.patch(`/operations/preventive/${task.sourceId}/call`, { kind: 'STERILIZATION' });
    if (task.type === 'SUTURE') await api.patch(`/medical-records/${task.sourceId}/suture-removal`, { completed: true });
    if (task.type === 'PICKUP') await api.patch(`/operations/appointments/${task.sourceId}/picked-up`);
    success.value = action;
    await loadCenter(); emit('updated');
  } catch (e) { error.value = e.response?.data?.message || 'No se pudo completar la acción.'; }
  finally { saving.value = false; }
}

async function assignStaff(task) {
  const assignedStaffId = assignment.value[task.appointmentId];
  if (!assignedStaffId) { error.value = 'Selecciona al responsable de la atención.'; return; }
  saving.value = true; error.value = ''; success.value = '';
  try {
    await api.patch(`/appointments/${task.appointmentId}`, { assignedStaffId });
    success.value = 'Responsable asignado.';
    await loadCenter(); emit('updated');
  } catch (e) { error.value = e.response?.data?.message || 'No se pudo asignar al trabajador.'; }
  finally { saving.value = false; }
}

async function saveObligation() {
  saving.value = true; error.value = ''; success.value = '';
  try {
    await api.post('/operations/obligations', {
      ...obligationForm.value,
      amount: Number(obligationForm.value.amount),
      nextDueAt: new Date(`${obligationForm.value.nextDueAt}T12:00:00-05:00`).toISOString(),
    });
    obligationForm.value = { name: '', payee: '', category: '', amount: '', nextDueAt: '', recurrence: 'MONTHLY', referenceCode: '', notes: '' };
    showObligationForm.value = false;
    success.value = 'Pago próximo guardado.';
    await loadCenter();
  } catch (e) { error.value = e.response?.data?.message || 'No se pudo guardar el pago próximo.'; }
  finally { saving.value = false; }
}

async function payObligation(task) {
  saving.value = true; payingId.value = task.sourceId; error.value = ''; success.value = '';
  try {
    await api.post(`/operations/obligations/${task.sourceId}/pay`, { paymentMethod: paymentMethod.value });
    success.value = 'Pago registrado en Caja y próxima fecha actualizada.';
    await loadCenter(); emit('updated');
  } catch (e) { error.value = e.response?.data?.message || 'No se pudo registrar el pago.'; }
  finally { saving.value = false; payingId.value = ''; }
}

function formatDue(value) {
  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function phoneHref(phone) { return `tel:${String(phone || '').replace(/\s/g, '')}`; }

function refreshSilently() { loadCenter(true); }

onMounted(() => {
  loadCenter();
  refreshTimer = window.setInterval(refreshSilently, 30000);
  window.addEventListener('focus', refreshSilently);
});
onUnmounted(() => {
  window.clearInterval(refreshTimer);
  window.removeEventListener('focus', refreshSilently);
});
defineExpose({ loadCenter });
</script>

<template>
  <section class="operations-center">
    <header class="operations-hero">
      <div>
        <span class="badge">Centro de pendientes</span>
        <h2>Lo que necesita atención</h2>
        <p>Seguimientos, recojos y pagos reunidos en un solo lugar.</p>
      </div>
      <small class="auto-update">Se actualiza automáticamente</small>
    </header>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div class="operations-summary">
      <button type="button" class="summary-card urgent" @click="filter='urgent'"><span>Vencidos</span><strong>{{ center.summary.overdue }}</strong><small>Primero</small></button>
      <button type="button" class="summary-card today" @click="filter='urgent'"><span>Para hoy</span><strong>{{ center.summary.today }}</strong><small>Durante el día</small></button>
      <button type="button" class="summary-card" @click="filter='all'"><span>Próximos</span><strong>{{ center.summary.upcoming }}</strong><small>30 días</small></button>
      <button type="button" class="summary-card" @click="filter='service'"><span>Sin responsable</span><strong>{{ center.summary.unassigned }}</strong><small>Por coordinar</small></button>
    </div>

    <div class="operations-layout">
      <div class="task-workspace">
        <div class="task-toolbar">
          <div class="task-filters">
            <button v-for="item in filters" :key="item.value" type="button" :class="{active:filter===item.value}" @click="filter=item.value">{{ item.label }}</button>
          </div>
          <span>{{ filteredTasks.length }} pendiente{{ filteredTasks.length === 1 ? '' : 's' }}</span>
        </div>

        <div v-if="loading" class="task-empty">Organizando pendientes…</div>
        <div v-else-if="!filteredTasks.length" class="task-empty"><strong>Todo tranquilo</strong><span>No hay pendientes en esta vista.</span></div>
        <div v-else class="task-list">
          <article v-for="task in filteredTasks" :key="task.id" :class="['task-card',task.priority]">
            <div class="task-date"><span>{{ task.priority === 'overdue' ? 'Vencido' : task.priority === 'today' ? 'Hoy' : 'Próximo' }}</span><small>{{ formatDue(task.dueAt) }}</small></div>
            <div class="task-body"><span class="task-kind">{{ taskLabels[task.type] }}</span><strong>{{ task.title }}</strong><small>{{ task.detail }}</small><a v-if="task.phone" :href="phoneHref(task.phone)">{{ task.phone }}</a></div>
            <div class="task-action">
              <template v-if="task.type==='UNASSIGNED'">
                <select v-model="assignment[task.appointmentId]"><option value="">Elegir responsable</option><option v-for="person in center.staff" :key="person.id" :value="person.id">{{ person.fullName }} · {{ person.jobTitle }}</option></select>
                <button class="small" type="button" :disabled="saving" @click="assignStaff(task)">Asignar</button>
              </template>
              <button v-else-if="task.type==='PREVENTIVE_CALL'" class="small" type="button" :disabled="saving" @click="resolveTask(task,'Llamada registrada.')">Marcar llamada</button>
              <button v-else-if="task.type==='STERILIZATION_CALL'" class="small" type="button" :disabled="saving" @click="resolveTask(task,'Contacto registrado.')">Marcar contacto</button>
              <button v-else-if="task.type==='SUTURE'" class="small" type="button" :disabled="saving" @click="resolveTask(task,'Retiro de puntos completado.')">Retiro realizado</button>
              <button v-else-if="task.type==='PICKUP'" class="small" type="button" :disabled="saving" @click="resolveTask(task,'Mascota entregada.')">Entregado</button>
              <button v-else-if="task.type==='DEBT'" class="small" type="button" @click="emit('go-cash')">Ir a cobrar</button>
              <template v-else-if="task.type==='OBLIGATION'">
                <select v-model="paymentMethod"><option value="CASH">Efectivo</option><option value="YAPE">Yape</option><option value="PLIN">Plin</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option></select>
                <button class="small" type="button" :disabled="saving" @click="payObligation(task)">{{ payingId===task.sourceId ? 'Guardando…' : 'Registrar pago' }}</button>
              </template>
              <button v-if="task.appointmentId" class="secondary small" type="button" @click="emit('open-appointment',task.appointmentId)">Ver cita</button>
            </div>
          </article>
        </div>
      </div>

      <aside class="obligations-panel">
        <div class="obligations-heading"><div><span class="badge">Negocio</span><h3>Pagos próximos</h3></div><button class="secondary small" type="button" @click="showObligationForm=!showObligationForm">{{ showObligationForm ? 'Cerrar' : '+ Programar' }}</button></div>
        <p>Internet, servicios, contador u otros pagos con fecha fija.</p>
        <form v-if="showObligationForm" class="obligation-form" @submit.prevent="saveObligation">
          <label>Concepto<input v-model="obligationForm.name" required placeholder="Ej. Internet"></label>
          <label>Empresa o persona<input v-model="obligationForm.payee" placeholder="Ej. Movistar"></label>
          <div><label>Monto<input v-model.number="obligationForm.amount" required type="number" min="0.01" step="0.01"></label><label>Vence<input v-model="obligationForm.nextDueAt" required type="date"></label></div>
          <label>Repetición<select v-model="obligationForm.recurrence"><option value="MONTHLY">Cada mes</option><option value="ONE_TIME">Una sola vez</option></select></label>
          <label>Código o referencia<input v-model="obligationForm.referenceCode"></label>
          <button :disabled="saving">Guardar recordatorio</button>
        </form>
        <div v-else class="obligation-preview">
          <div v-for="item in center.obligations.slice(0,5)" :key="item.id"><span>{{ item.name }}</span><strong>S/ {{ Number(item.amount).toFixed(2) }}</strong><small>{{ formatDue(item.nextDueAt) }}</small></div>
          <span v-if="!center.obligations.length" class="muted">Todavía no hay pagos programados.</span>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.auto-update{padding:8px 11px;border-radius:999px;background:var(--surface-soft);color:var(--muted);font-weight:800}
.operations-center{display:grid;gap:18px}.operations-hero,.obligations-heading,.task-toolbar,.task-card,.task-action,.operations-summary{display:flex;align-items:center}.operations-hero{justify-content:space-between;padding:22px 24px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(135deg,#fff 0%,#eef8f5 100%);box-shadow:var(--shadow)}.operations-hero h2{margin:8px 0 4px;font-size:1.55rem}.operations-hero p,.obligations-panel>p{margin:0;color:var(--muted)}.operations-summary{gap:12px}.summary-card{flex:1;display:grid;gap:3px;text-align:left;padding:16px;border:1px solid var(--line);border-radius:18px;background:#fff;color:var(--ink)}.summary-card strong{font-size:1.7rem}.summary-card span,.summary-card small{color:var(--muted)}.summary-card.urgent{border-color:#edc8c5;background:#fff8f7}.summary-card.today{border-color:#e7d5a5;background:#fffaf0}.operations-layout{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px}.task-workspace,.obligations-panel{padding:18px;border:1px solid var(--line);border-radius:22px;background:rgba(255,255,255,.82);box-shadow:var(--shadow)}.task-toolbar{justify-content:space-between;gap:12px;margin-bottom:14px}.task-toolbar>span{color:var(--muted);font-size:.85rem}.task-filters{display:flex;gap:6px;overflow:auto;padding:4px;border-radius:14px;background:var(--surface-soft)}.task-filters button{white-space:nowrap;padding:8px 11px;background:transparent;color:var(--muted);box-shadow:none}.task-filters button.active{background:#fff;color:var(--brand-800);box-shadow:0 5px 15px rgba(20,86,88,.09)}.task-list{display:grid;gap:9px}.task-card{gap:14px;padding:13px;border:1px solid var(--line);border-left:4px solid #adc9c5;border-radius:15px;background:#fff}.task-card.overdue{border-left-color:#c75757}.task-card.today{border-left-color:#c79b32}.task-date{display:grid;gap:3px;width:112px}.task-date span{font-weight:900;font-size:.75rem;text-transform:uppercase}.task-date small{color:var(--muted)}.task-body{display:grid;gap:3px;min-width:0;flex:1}.task-body strong{font-size:.95rem}.task-body small{color:var(--muted)}.task-body a{color:var(--brand-800);font-weight:800;font-size:.8rem}.task-kind{width:max-content;padding:3px 7px;border-radius:999px;background:var(--brand-100);color:var(--brand-800);font-size:.68rem;font-weight:900}.task-action{justify-content:flex-end;gap:7px;flex-wrap:wrap}.task-action select{max-width:190px;padding:8px}.task-empty{display:grid;place-items:center;gap:5px;min-height:180px;color:var(--muted)}.obligations-heading{justify-content:space-between;gap:10px}.obligations-heading h3{margin:7px 0}.obligation-form,.obligation-preview{display:grid;gap:10px;margin-top:16px}.obligation-form label{display:grid;gap:5px;font-weight:800;font-size:.78rem}.obligation-form>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.obligation-preview>div{display:grid;grid-template-columns:1fr auto;gap:3px;padding:11px;border-radius:13px;background:var(--surface-soft)}.obligation-preview small{grid-column:1/-1;color:var(--muted)}.muted{color:var(--muted)}
@media(max-width:980px){.operations-layout{grid-template-columns:1fr}.operations-summary{display:grid;grid-template-columns:1fr 1fr}.task-card{align-items:stretch;flex-direction:column}.task-date{width:auto}.task-action{justify-content:flex-start}}
@media(max-width:600px){.operations-summary{grid-template-columns:1fr 1fr}.operations-hero{align-items:flex-start;flex-direction:column;gap:12px}.task-toolbar{align-items:stretch;flex-direction:column}.task-action select{max-width:none;width:100%}}
</style>
