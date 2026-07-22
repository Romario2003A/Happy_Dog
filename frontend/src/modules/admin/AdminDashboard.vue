<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import { api } from '../../services/api';

const route = useRoute();
const router = useRouter();
const summary = ref({});
const inventory = ref([]);
const services = ref([]);
const clients = ref([]);
const appointments = ref([]);
const pets = ref([]);
const adminTabs = ['resumen', 'servicios', 'inventario', 'clientes', 'caja'];
const active = ref(tabFromRoute());
const error = ref('');
const success = ref('');
const saving = ref(false);
const showProductForm = ref(false);
const editingProductId = ref('');
const inventorySearch = ref('');
const productForm = ref({ name: '', category: '', unitPrice: 0, stock: 0, minStock: 0 });
const serviceSearch = ref('');
const showServiceForm = ref(false);
const editingServiceId = ref('');
const serviceForm = ref({ name: '', description: '', price: 0 });
const cashDate = ref(todayInputDate());
const cashMovements = ref([]);
const pendingCharges = ref([]);
const receivables = ref([]);
const cashSummary = ref(defaultCashSummary());
const cashWorkspace = ref('day');
const showCashForm = ref(false);
const showClosingForm = ref(false);
const cashForm = ref(defaultCashForm());
const chargeForm = ref({ appointmentId: '', amount: 0, paymentMethod: 'CASH' });
const showReceivableForm = ref(false);
const receivableForm = ref({ clientId: '', petId: '', description: '', total: 0, initialPayment: 0, paymentMethod: 'CASH', notes: '' });
const payingReceivableId = ref('');
const receivablePayment = ref({ amount: 0, paymentMethod: 'CASH', notes: '' });
const closingForm = ref({ openingAmount: 0, countedAmount: 0, notes: '' });

const cashTypeOptions = [
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
  { value: 'DEBT_PAYMENT', label: 'Pago de deuda' },
  { value: 'ADJUSTMENT', label: 'Ajuste' },
];
const cashCategoryOptions = [
  { value: 'CONSULTATION', label: 'Consulta' },
  { value: 'VACCINE', label: 'Vacuna' },
  { value: 'DEWORMING', label: 'Desparasitación' },
  { value: 'SURGERY', label: 'Cirugia' },
  { value: 'GROOMING', label: 'Bano y corte' },
  { value: 'TREATMENT', label: 'Tratamiento' },
  { value: 'PRODUCT', label: 'Producto' },
  { value: 'PHARMACY', label: 'Farmacia' },
  { value: 'LABORATORY', label: 'Laboratorio' },
  { value: 'IMAGING', label: 'Ecografía o radiografía' },
  { value: 'SEDATION', label: 'Sedación' },
  { value: 'BOARDING', label: 'Hospedaje' },
  { value: 'FOOD', label: 'Comida' },
  { value: 'PET_SHOP', label: 'Pet shop' },
  { value: 'EUTHANASIA', label: 'Eutanasia' },
  { value: 'CAMPAIGN', label: 'Campana' },
  { value: 'DEBT', label: 'Deuda' },
  { value: 'OTHER', label: 'Otro' },
];
const paymentOptions = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'CARD', label: 'Tarjeta' },
  { value: 'TRANSFER', label: 'Transferencia' },
  { value: 'YAPE', label: 'Yape' },
  { value: 'PLIN', label: 'Plin' },
  { value: 'OTHER', label: 'Otro' },
];
const cashTypeLabels = Object.fromEntries(cashTypeOptions.map(option => [option.value, option.label]));
const cashCategoryLabels = Object.fromEntries(cashCategoryOptions.map(option => [option.value, option.label]));
const paymentLabels = Object.fromEntries(paymentOptions.map(option => [option.value, option.label]));

const lowStockProducts = computed(() => inventory.value.filter(p => p.active !== false && Number(p.stock) <= Number(p.minStock)));
const clientPetsCount = computed(() => clients.value.reduce((total, client) => total + (client.pets?.length || 0), 0));
const adminStats = computed(() => ({
  clients: clients.value.length || summary.value.clients || 0,
  pets: pets.value.length || clientPetsCount.value || summary.value.pets || 0,
  appointments: appointments.value.length || summary.value.appointments || 0,
  lowStock: inventory.value.length ? lowStockProducts.value.length : (summary.value.lowStock || 0),
}));
const inventoryStats = computed(() => ({
  total: inventory.value.length,
  active: inventory.value.filter(p => p.active !== false).length,
  low: lowStockProducts.value.length,
  inactive: inventory.value.filter(p => p.active === false).length,
}));
const upcomingAdminAppointments = computed(() => appointments.value
  .filter(item => new Date(item.scheduledAt) >= new Date() && item.status !== 'CANCELLED')
  .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
  .slice(0, 4));
const filteredInventory = computed(() => {
  const query = inventorySearch.value.trim().toLowerCase();
  if (!query) return inventory.value;
  return inventory.value.filter(product => [
    product.name,
    product.category,
    product.sku,
  ].some(value => String(value || '').toLowerCase().includes(query)));
});
const filteredServices = computed(() => {
  const query = serviceSearch.value.trim().toLowerCase();
  if (!query) return services.value;
  return services.value.filter(service => [service.name, service.description]
    .some(value => String(value || '').toLowerCase().includes(query)));
});
const serviceStats = computed(() => ({
  active: services.value.filter(service => service.active !== false).length,
  inactive: services.value.filter(service => service.active === false).length,
}));
const sortedCashMovements = computed(() => cashMovements.value.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)));
const expectedClosingAmount = computed(() => Number(closingForm.value.openingAmount || 0) + Number(cashSummary.value.net || 0));
const closingDifference = computed(() => Number(closingForm.value.countedAmount || 0) - expectedClosingAmount.value);
const closingStatus = computed(() => {
  if (Math.abs(closingDifference.value) < 0.01) return { label: 'Caja cuadrada', tone: 'ok' };
  return closingDifference.value > 0
    ? { label: 'Sobra dinero', tone: 'warn' }
    : { label: 'Falta dinero', tone: 'danger' };
});
const cashActivityLabel = computed(() => {
  if (cashMovements.value.length === 1) return '1 movimiento registrado';
  return `${cashMovements.value.length} movimientos registrados`;
});
const receivableTotal = computed(() => receivables.value.reduce((sum, item) => sum + Number(item.balance || 0), 0));
const receivablePets = computed(() => clients.value.find(client => client.id === receivableForm.value.clientId)?.pets || []);

function openInventory() {
  setActive('inventario');
  showProductForm.value = false;
  editingProductId.value = '';
}

function openProductCreator() {
  setActive('inventario');
  editingProductId.value = '';
  resetProductForm();
  showProductForm.value = true;
}

function tabFromRoute() {
  const tab = String(route.query.tab || '');
  return adminTabs.includes(tab) ? tab : 'resumen';
}

function setActive(tab, syncUrl = true) {
  active.value = adminTabs.includes(tab) ? tab : 'resumen';
  if (active.value === 'caja') loadCash();
  if (!syncUrl) return;

  const nextQuery = { ...route.query };
  if (active.value === 'resumen') delete nextQuery.tab;
  else nextQuery.tab = active.value;
  router.replace({ query: nextQuery });
}

function defaultCashSummary() {
  return {
    income: 0,
    expenses: 0,
    debtPayments: 0,
    adjustments: 0,
    net: 0,
    movementCount: 0,
    byPaymentMethod: [],
    byCategory: [],
    closing: null,
  };
}

function defaultCashForm() {
  return {
    type: 'INCOME',
    category: 'CONSULTATION',
    description: '',
    amount: 0,
    paymentMethod: 'CASH',
    occurredAt: toDateTimeInput(new Date()),
    clientName: '',
    petName: '',
    notes: '',
  };
}

function todayInputDate() {
  return toDateTimeInput(new Date()).slice(0, 10);
}

function toDateTimeInput(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function rejectedStatus(result) {
  return result.status === 'rejected' ? result.reason?.response?.status : null;
}

async function loadCash() {
  error.value = '';
  const [summaryRes, movementsRes, pendingRes, receivablesRes] = await Promise.allSettled([
    api.get(`/cash/summary?date=${cashDate.value}`),
    api.get(`/cash?from=${cashDate.value}&to=${cashDate.value}`),
    api.get(`/cash/pending?date=${cashDate.value}`),
    api.get('/cash/receivables'),
  ]);

  if (summaryRes.status === 'fulfilled') {
    cashSummary.value = { ...defaultCashSummary(), ...summaryRes.value.data };
    const closing = summaryRes.value.data?.closing;
    if (closing) {
      closingForm.value = {
        openingAmount: Number(closing.openingAmount || 0),
        countedAmount: Number(closing.countedAmount || 0),
        notes: closing.notes || '',
      };
    } else {
      closingForm.value = { openingAmount: 0, countedAmount: 0, notes: '' };
    }
  }

  if (movementsRes.status === 'fulfilled') {
    cashMovements.value = movementsRes.value.data;
  }

  if (pendingRes.status === 'fulfilled') pendingCharges.value = pendingRes.value.data;
  else pendingCharges.value = [];
  if (receivablesRes.status === 'fulfilled') receivables.value = receivablesRes.value.data;

  // La bandeja de cobros es complementaria. Si el backend nuevo todavía está
  // desplegándose, el saldo y los movimientos deben continuar disponibles.
  if (summaryRes.status === 'rejected' || movementsRes.status === 'rejected') {
    const status = rejectedStatus(summaryRes) || rejectedStatus(movementsRes);
    error.value = status === 401 || status === 403
      ? 'Tu sesion no tiene permisos para Caja. Ingresa otra vez con la cuenta de recepcion o administracion.'
      : 'No se pudo cargar caja. Intenta actualizar la pagina en unos segundos.';
  }
}

function resetReceivableForm() {
  receivableForm.value = { clientId: '', petId: '', description: '', total: 0, initialPayment: 0, paymentMethod: 'CASH', notes: '' };
}

async function saveReceivable() {
  if (!receivableForm.value.clientId || Number(receivableForm.value.total) <= 0) {
    error.value = 'Selecciona un cliente e ingresa el total de la cuenta.';
    return;
  }
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/cash/receivables', {
      ...receivableForm.value,
      total: Number(receivableForm.value.total),
      initialPayment: Number(receivableForm.value.initialPayment || 0),
    });
    success.value = 'Cuenta por cobrar registrada.';
    resetReceivableForm();
    showReceivableForm.value = false;
    await loadCash();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo registrar la cuenta.';
  } finally {
    saving.value = false;
  }
}

function startReceivablePayment(receivable) {
  payingReceivableId.value = receivable.id;
  receivablePayment.value = { amount: Number(receivable.balance || 0), paymentMethod: 'CASH', notes: '' };
}

async function payReceivable(receivable) {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post(`/cash/receivables/${receivable.id}/payments`, {
      ...receivablePayment.value,
      amount: Number(receivablePayment.value.amount),
    });
    success.value = 'Abono registrado en Caja.';
    payingReceivableId.value = '';
    await loadCash();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo registrar el abono.';
  } finally {
    saving.value = false;
  }
}

async function loadData() {
  error.value = '';
  const [summaryRes, inventoryRes, clientsRes, appointmentsRes, petsRes, servicesRes] = await Promise.allSettled([
    api.get('/reports/summary'),
    api.get('/inventory'),
    api.get('/clients'),
    api.get('/appointments'),
    api.get('/pets'),
    api.get('/services'),
  ]);

  if (inventoryRes.status === 'fulfilled') inventory.value = inventoryRes.value.data;
  if (clientsRes.status === 'fulfilled') clients.value = clientsRes.value.data;
  if (appointmentsRes.status === 'fulfilled') appointments.value = appointmentsRes.value.data;
  if (petsRes.status === 'fulfilled') pets.value = petsRes.value.data;
  if (servicesRes.status === 'fulfilled') services.value = servicesRes.value.data;

  if (summaryRes.status === 'fulfilled') {
    summary.value = summaryRes.value.data;
  } else {
    summary.value = {
      clients: clientsRes.status === 'fulfilled' ? clientsRes.value.data.length : 0,
      pets: petsRes.status === 'fulfilled' ? petsRes.value.data.length : 0,
      appointments: appointmentsRes.status === 'fulfilled' ? appointmentsRes.value.data.length : 0,
      lowStock: inventoryRes.status === 'fulfilled'
        ? inventoryRes.value.data.filter(p => Number(p.stock) <= Number(p.minStock)).length
        : 0,
    };
  }

  const failed = [summaryRes, inventoryRes, clientsRes].some(result => result.status === 'rejected');
  if (failed) {
    const status = rejectedStatus(summaryRes) || rejectedStatus(inventoryRes) || rejectedStatus(clientsRes);
    error.value = status === 401 || status === 403
      ? 'Tu sesion no tiene permisos de administracion. Ingresa otra vez con la cuenta de recepcion o administracion.'
      : 'Algunos datos administrativos no se pudieron cargar. Actualiza la pagina o vuelve a iniciar sesion si falta informacion.';
  }
}

function resetProductForm() {
  productForm.value = { name: '', category: '', unitPrice: 0, stock: 0, minStock: 0 };
}

function productPayload() {
  return {
    ...productForm.value,
    unitPrice: Number(productForm.value.unitPrice),
    stock: Number(productForm.value.stock),
    minStock: Number(productForm.value.minStock),
  };
}

function startEditProduct(product) {
  setActive('inventario');
  editingProductId.value = product.id;
  productForm.value = {
    name: product.name || '',
    category: product.category || '',
    unitPrice: Number(product.unitPrice || 0),
    stock: Number(product.stock || 0),
    minStock: Number(product.minStock || 0),
  };
  showProductForm.value = true;
}

async function saveProduct() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    if (editingProductId.value) {
      await api.patch(`/inventory/${editingProductId.value}`, productPayload());
      success.value = 'Producto actualizado correctamente.';
    } else {
      await api.post('/inventory', productPayload());
      success.value = 'Producto agregado al inventario.';
    }
    resetProductForm();
    editingProductId.value = '';
    showProductForm.value = false;
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo guardar el producto.';
  } finally {
    saving.value = false;
  }
}

async function toggleProductActive(product) {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.patch(`/inventory/${product.id}`, { active: product.active === false });
    success.value = product.active === false ? 'Producto activado.' : 'Producto retirado del inventario.';
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo actualizar el producto.';
  } finally {
    saving.value = false;
  }
}

async function deleteProduct(product) {
  const ok = window.confirm(`Eliminar "${product.name}" del inventario? Si tiene historial, se retirara sin borrar sus registros.`);
  if (!ok) return;
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.delete(`/inventory/${product.id}`);
    success.value = 'Producto eliminado del inventario.';
    await loadData();
  } catch (e) {
    try {
      await api.patch(`/inventory/${product.id}`, { active: false });
      success.value = 'Producto retirado del inventario porque tiene historial asociado.';
      await loadData();
    } catch (fallbackError) {
      error.value = fallbackError.response?.data?.message || e.response?.data?.message || 'No se pudo eliminar el producto.';
    }
  } finally {
    saving.value = false;
  }
}

function resetCashForm() {
  cashForm.value = defaultCashForm();
}

function cashPayload() {
  return {
    ...cashForm.value,
    amount: Number(cashForm.value.amount),
    paymentMethod: cashForm.value.type === 'EXPENSE' ? null : cashForm.value.paymentMethod,
  };
}

async function saveCashMovement() {
  if (Number(cashForm.value.amount) <= 0) {
    error.value = 'Ingresa un monto mayor a cero.';
    return;
  }

  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/cash/movements', cashPayload());
    success.value = 'Movimiento de caja registrado.';
    resetCashForm();
    showCashForm.value = false;
    await loadCash();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo registrar el movimiento.';
  } finally {
    saving.value = false;
  }
}

async function deleteCashMovement(movement) {
  const ok = window.confirm(`Eliminar el movimiento "${movement.description}"?`);
  if (!ok) return;

  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.delete(`/cash/movements/${movement.id}`);
    success.value = 'Movimiento eliminado.';
    await loadCash();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo eliminar el movimiento.';
  } finally {
    saving.value = false;
  }
}

async function closeCashDay() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/cash/closing', {
      businessDate: cashDate.value,
      openingAmount: Number(closingForm.value.openingAmount || 0),
      countedAmount: Number(closingForm.value.countedAmount || 0),
      notes: closingForm.value.notes || '',
    });
    success.value = 'Cierre de caja guardado.';
    await loadCash();
    showClosingForm.value = false;
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo cerrar caja.';
  } finally {
    saving.value = false;
  }
}

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatCashDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function resetServiceForm() {
  serviceForm.value = { name: '', description: '', price: 0 };
}

function openServiceCreator() {
  setActive('servicios');
  editingServiceId.value = '';
  resetServiceForm();
  showServiceForm.value = true;
}

function editService(service) {
  editingServiceId.value = service.id;
  serviceForm.value = {
    name: service.name || '',
    description: service.description || '',
    price: Number(service.price || 0),
  };
  showServiceForm.value = true;
}

async function saveService() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    const payload = { ...serviceForm.value, price: Number(serviceForm.value.price) };
    if (editingServiceId.value) {
      await api.patch(`/services/${editingServiceId.value}`, payload);
      success.value = 'Servicio actualizado.';
    } else {
      await api.post('/services', payload);
      success.value = 'Servicio agregado al tarifario.';
    }
    showServiceForm.value = false;
    editingServiceId.value = '';
    resetServiceForm();
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo guardar el servicio.';
  } finally {
    saving.value = false;
  }
}

async function toggleService(service) {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.patch(`/services/${service.id}`, { active: service.active === false });
    success.value = service.active === false ? 'Servicio habilitado.' : 'Servicio retirado del tarifario.';
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo actualizar el servicio.';
  } finally {
    saving.value = false;
  }
}

function appointmentServiceLabel(appointment) {
  if (appointment.service?.name) return appointment.service.name;
  const type = String(appointment.notes || '').match(/SERVICE_TYPE:([A-Z_]+)/)?.[1];
  return ({ GROOMING: 'Baño y corte', VACCINE: 'Vacuna o desparasitación', SURGERY: 'Cirugía', MEDICAL: 'Consulta médica' })[type] || appointment.reason || 'Atención';
}

function appointmentCashCategory(appointment) {
  const text = `${appointment.service?.name || ''} ${appointment.notes || ''} ${appointment.reason || ''}`.toUpperCase();
  if (text.includes('GROOM') || text.includes('BAÑO') || text.includes('BANO') || text.includes('CORTE')) return 'GROOMING';
  if (text.includes('VACUN') || text.includes('DESPARASIT')) return 'VACCINE';
  if (text.includes('CIRUG')) return 'SURGERY';
  return 'CONSULTATION';
}

function selectPendingCharge(appointment) {
  chargeForm.value = {
    appointmentId: appointment.id,
    amount: Number(appointment.suggestedAmount || 0),
    paymentMethod: 'CASH',
  };
}

async function collectAppointment(appointment) {
  if (Number(chargeForm.value.amount) <= 0) {
    error.value = 'Ingresa el importe que se cobrará por esta atención.';
    return;
  }
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/cash/movements', {
      type: 'INCOME',
      category: appointmentCashCategory(appointment),
      description: appointmentServiceLabel(appointment),
      amount: Number(chargeForm.value.amount),
      paymentMethod: chargeForm.value.paymentMethod,
      clientId: appointment.clientId,
      petId: appointment.petId,
      clientName: appointment.client?.fullName || '',
      petName: appointment.pet?.name || '',
      appointmentId: appointment.id,
    });
    success.value = `Cobro de ${appointment.pet?.name || 'la atención'} registrado.`;
    chargeForm.value = { appointmentId: '', amount: 0, paymentMethod: 'CASH' };
    await loadCash();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo registrar el cobro.';
  } finally {
    saving.value = false;
  }
}

function formatAdminAppointment(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-PE', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function movementAmountClass(movement) {
  return movement.type === 'EXPENSE' ? 'amount-negative' : 'amount-positive';
}

function movementSignedAmount(movement) {
  const prefix = movement.type === 'EXPENSE' ? '-' : '+';
  return `${prefix} S/ ${formatMoney(movement.amount)}`;
}

function stockLabel(product) {
  if (product.active === false) return 'Retirado';
  if (Number(product.stock) <= 0) return 'Agotado';
  if (Number(product.stock) <= Number(product.minStock)) return 'Stock bajo';
  return 'Disponible';
}

function stockClass(product) {
  if (product.active === false) return 'inactive';
  if (Number(product.stock) <= 0) return 'out';
  if (Number(product.stock) <= Number(product.minStock)) return 'low';
  return 'ok';
}

watch(() => route.query.tab, () => {
  setActive(tabFromRoute(), false);
});

watch(cashDate, loadCash);

onMounted(async () => {
  await loadData();
  if (active.value === 'caja') await loadCash();
});
</script>

<template>
  <AdminLayout title="Administración" subtitle="Control del negocio, inventario, caja y reportes" hide-user-pill>
    <template #nav>
      <button :class="{ active: active === 'resumen' }" @click="setActive('resumen')">Resumen</button>
      <button :class="{ active: active === 'servicios' }" @click="setActive('servicios')">Servicios</button>
      <button :class="{ active: active === 'inventario' }" @click="openInventory">Inventario</button>
      <button :class="{ active: active === 'clientes' }" @click="setActive('clientes')">Clientes</button>
      <button :class="{ active: active === 'caja' }" @click="setActive('caja')">Caja</button>
    </template>

    <template #top-actions>
      <button
        class="secondary top-action-button"
        type="button"
        aria-label="Volver a la agenda diaria de recepción"
        @click="$router.push('/recepcion')"
      >
        Volver a agenda diaria
      </button>
    </template>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div v-if="active==='resumen'" class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ adminStats.clients }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ adminStats.pets }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ adminStats.appointments }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ adminStats.lowStock }}</strong></div>
    </div>

    <div v-if="active==='resumen'" class="admin-overview-grid">
      <section class="glass-card admin-today-card">
        <div class="section-title compact">
          <div><span class="badge">Información útil</span><h3>Agenda cercana y alertas</h3></div>
          <button type="button" class="secondary small" @click="$router.push('/recepcion')">Ver agenda</button>
        </div>
        <div class="admin-information-columns">
          <div>
            <div v-if="upcomingAdminAppointments.length" class="admin-agenda-list">
              <article v-for="item in upcomingAdminAppointments" :key="item.id">
                <span>{{ formatAdminAppointment(item.scheduledAt) }}</span>
                <div><strong>{{ item.pet?.name || 'Mascota' }}</strong><small>{{ item.client?.fullName || 'Cliente' }}</small></div>
              </article>
            </div>
            <div v-else class="calm-empty"><strong>Agenda despejada</strong><span>No hay citas próximas pendientes.</span></div>
          </div>
          <div class="admin-stock-note" :class="{ ok: !lowStockProducts.length }">
            <strong>{{ lowStockProducts.length ? `${lowStockProducts.length} producto${lowStockProducts.length === 1 ? '' : 's'} requiere atención` : 'Inventario en orden' }}</strong>
            <span>{{ lowStockProducts.length ? 'Revisa las existencias antes de la siguiente atención.' : 'No hay productos con stock bajo.' }}</span>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="active==='servicios'" class="panel-grid" :class="{ single: !showServiceForm }">
      <section class="glass-card">
        <div class="section-title">
          <div>
            <span class="badge">Tarifario</span>
            <h2>Servicios y precios</h2>
            <p class="muted-text">La lista central que usará Recepción al agendar y Caja al cobrar.</p>
          </div>
          <button class="secondary small" type="button" @click="openServiceCreator">Agregar servicio</button>
        </div>
        <div class="inventory-toolbar">
          <input v-model="serviceSearch" placeholder="Buscar consulta, vacuna, cirugía o baño">
          <div class="inventory-mini-stats">
            <span><strong>{{ serviceStats.active }}</strong> disponibles</span>
            <span><strong>{{ serviceStats.inactive }}</strong> retirados</span>
          </div>
        </div>
        <table>
          <thead><tr><th>Servicio</th><th>Descripción</th><th>Precio sugerido</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            <tr v-if="!filteredServices.length"><td colspan="5" class="empty">Agrega aquí los servicios del tarifario de Happy Dog.</td></tr>
            <tr v-for="service in filteredServices" :key="service.id" :class="{ 'muted-row': service.active === false }">
              <td><strong>{{ service.name }}</strong></td>
              <td>{{ service.description || 'Sin descripción' }}</td>
              <td><strong>S/ {{ formatPrice(service.price) }}</strong></td>
              <td><span class="stock-pill" :class="service.active === false ? 'inactive' : 'ok'">{{ service.active === false ? 'Retirado' : 'Disponible' }}</span></td>
              <td><div class="table-actions"><button class="ghost small" type="button" @click="editService(service)">Editar</button><button class="secondary small" type="button" @click="toggleService(service)">{{ service.active === false ? 'Habilitar' : 'Retirar' }}</button></div></td>
            </tr>
          </tbody>
        </table>
      </section>
      <section v-if="showServiceForm" class="glass-card service-editor">
        <div class="section-title">
          <div><span class="badge">{{ editingServiceId ? 'Edición' : 'Nuevo' }}</span><h2>{{ editingServiceId ? 'Editar servicio' : 'Nuevo servicio' }}</h2></div>
          <button class="ghost small" type="button" @click="showServiceForm=false; editingServiceId=''; resetServiceForm()">Cerrar</button>
        </div>
        <form class="stack" @submit.prevent="saveService">
          <label>Nombre<input v-model="serviceForm.name" required placeholder="Ej. Consulta general"></label>
          <label>Descripción<textarea v-model="serviceForm.description" rows="3" placeholder="Qué incluye o cuándo se utiliza"></textarea></label>
          <label>Precio sugerido<input v-model.number="serviceForm.price" type="number" min="0" step="0.01" required></label>
          <p class="service-price-note">El importe podrá ajustarse al cobrar si la atención requiere algo adicional.</p>
          <button :disabled="saving">{{ saving ? 'Guardando...' : editingServiceId ? 'Guardar cambios' : 'Agregar al tarifario' }}</button>
          <button class="secondary" type="button" @click="showServiceForm=false; editingServiceId=''; resetServiceForm()">Cancelar</button>
        </form>
      </section>
    </div>

    <div v-else-if="active==='inventario'" class="panel-grid" :class="{ single: !showProductForm }">
      <section class="glass-card">
        <div class="section-title">
          <div>
            <h2>Inventario</h2>
            <p class="muted-text">Revisa productos, stock y medicamentos disponibles para atenciones.</p>
          </div>
          <button class="secondary small" @click="openProductCreator">Agregar producto</button>
        </div>
        <div class="inventory-toolbar">
          <input v-model="inventorySearch" placeholder="Buscar producto, categoria o SKU">
          <div class="inventory-mini-stats">
            <span><strong>{{ inventoryStats.active }}</strong> activos</span>
            <span><strong>{{ inventoryStats.low }}</strong> stock bajo</span>
            <span><strong>{{ inventoryStats.inactive }}</strong> retirados</span>
          </div>
        </div>
        <table>
          <thead><tr><th>Producto</th><th>Categoria</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            <tr v-if="!filteredInventory.length"><td colspan="6" class="empty">No hay productos con ese criterio.</td></tr>
            <tr v-for="p in filteredInventory" :key="p.id" :class="{ 'muted-row': p.active === false }">
              <td class="product-cell">
                <strong>{{ p.name }}</strong>
                <small v-if="p.sku">SKU: {{ p.sku }}</small>
              </td>
              <td>{{ p.category || '-' }}</td>
              <td>S/ {{ formatPrice(p.unitPrice) }}</td>
              <td>{{ p.stock }} <small>min. {{ p.minStock }}</small></td>
              <td><span class="stock-pill" :class="stockClass(p)">{{ stockLabel(p) }}</span></td>
              <td>
                <div class="table-actions">
                  <button class="ghost small" type="button" @click="startEditProduct(p)">Editar</button>
                  <button class="secondary small" type="button" @click="toggleProductActive(p)">{{ p.active === false ? 'Activar' : 'Retirar' }}</button>
                  <button class="danger small" type="button" @click="deleteProduct(p)">Eliminar</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <section v-if="showProductForm" class="glass-card">
        <div class="section-title">
          <div>
            <h2>{{ editingProductId ? 'Editar producto' : 'Agregar producto' }}</h2>
            <p class="muted-text">{{ editingProductId ? 'Actualiza precio, stock o categoria sin perder historial.' : 'Registra medicamentos, vacunas, alimento o insumos.' }}</p>
          </div>
          <button class="ghost small" type="button" @click="showProductForm = false; editingProductId = ''; resetProductForm()">Cerrar</button>
        </div>
        <form class="stack" @submit.prevent="saveProduct">
          <label>Producto<input v-model="productForm.name" required placeholder="Vacuna, medicamento, alimento"></label>
          <label>Categoria<input v-model="productForm.category" placeholder="Medicamento"></label>
          <label>Precio<input v-model.number="productForm.unitPrice" type="number" min="0" step="0.01" required></label>
          <label>Stock<input v-model.number="productForm.stock" type="number" min="0" required></label>
          <label>Stock minimo<input v-model.number="productForm.minStock" type="number" min="0"></label>
          <button :disabled="saving">{{ saving ? 'Guardando...' : (editingProductId ? 'Guardar cambios' : 'Agregar producto') }}</button>
          <button class="secondary" type="button" @click="showProductForm = false; editingProductId = ''; resetProductForm()">Cancelar</button>
        </form>
      </section>
    </div>

    <section v-else-if="active==='clientes'" class="glass-card">
      <h2>Clientes registrados</h2>
      <table>
        <thead><tr><th>Cliente</th><th>Contacto</th><th>Mascotas</th></tr></thead>
        <tbody>
          <tr v-if="!clients.length"><td colspan="3" class="empty">No hay clientes cargados en esta vista.</td></tr>
          <tr v-for="client in clients" :key="client.id"><td>{{ client.fullName }}</td><td>{{ client.phone || client.email || '-' }}</td><td>{{ client.pets?.map(p => p.name).join(', ') || '-' }}</td></tr>
        </tbody>
      </table>
    </section>

    <section v-else-if="active==='caja'" class="glass-card cash-panel">
      <div class="section-title">
        <div>
          <span class="badge">Control financiero</span>
          <h2>{{ cashWorkspace === 'day' ? 'Caja del día' : 'Cuentas por cobrar' }}</h2>
          <p class="muted-text">{{ cashWorkspace === 'day' ? 'Tus ingresos, gastos y saldo en un solo lugar.' : 'Adelantos, abonos y saldos pendientes sin cálculos manuales.' }}</p>
        </div>
        <div v-if="cashWorkspace === 'day'" class="cash-actions">
          <input v-model="cashDate" class="cash-date" type="date">
          <button class="secondary small" type="button" @click="showCashForm = !showCashForm">
            {{ showCashForm ? 'Cancelar registro' : '+ Registrar movimiento' }}
          </button>
          <button class="small" type="button" @click="showClosingForm = !showClosingForm">
            {{ showClosingForm ? 'Ocultar cierre' : cashSummary.closing ? 'Ver cierre' : 'Cerrar caja' }}
          </button>
        </div>
        <button v-else class="small" type="button" @click="showReceivableForm = !showReceivableForm">{{ showReceivableForm ? 'Cancelar' : '+ Nueva cuenta' }}</button>
      </div>

      <nav class="cash-subnav" aria-label="Secciones de caja">
        <button type="button" :class="{ active: cashWorkspace === 'day' }" @click="cashWorkspace = 'day'">Movimientos del día</button>
        <button type="button" :class="{ active: cashWorkspace === 'receivables' }" @click="cashWorkspace = 'receivables'">Por cobrar <span v-if="receivables.length">{{ receivables.length }}</span></button>
      </nav>

      <div v-if="cashWorkspace === 'day'" class="cash-day-view">
      <div class="cash-cards">
        <div class="cash-metric income"><span>Ingresos</span><strong>S/ {{ formatMoney(cashSummary.income + cashSummary.debtPayments) }}</strong><small>Ventas y cobros</small></div>
        <div class="cash-metric expense"><span>Gastos</span><strong>S/ {{ formatMoney(cashSummary.expenses) }}</strong></div>
        <div class="cash-metric emphasis"><span>Saldo del día</span><strong>S/ {{ formatMoney(cashSummary.net) }}</strong><small>{{ cashActivityLabel }}</small></div>
      </div>

      <div v-if="cashSummary.byPaymentMethod?.length" class="cash-payment-summary">
        <span class="cash-payment-label">Cobros por método</span>
        <div class="cash-methods">
          <span v-for="item in cashSummary.byPaymentMethod" :key="item.key" class="cash-chip">
            {{ paymentLabels[item.key] || item.key }} <strong>S/ {{ formatMoney(item.total) }}</strong>
          </span>
        </div>
      </div>

      <div v-if="cashSummary.closing && !showClosingForm" class="cash-closed-summary">
        <div>
          <span :class="['closing-status', closingStatus.tone]">Día cerrado</span>
          <strong>{{ closingStatus.label }}</strong>
          <small>Contado: S/ {{ formatMoney(cashSummary.closing.countedAmount) }}</small>
        </div>
        <button class="secondary small" type="button" @click="showClosingForm = true">Revisar cierre</button>
      </div>

      <section class="pending-charges">
        <div class="pending-charges-heading">
          <div>
            <span class="badge">Por cobrar</span>
            <h3>Atenciones terminadas</h3>
            <p class="muted-text">Solo aparecen servicios ya completados que todavía no tienen un cobro.</p>
          </div>
          <strong class="pending-count">{{ pendingCharges.length }}</strong>
        </div>

        <div v-if="pendingCharges.length" class="pending-charge-list">
          <article v-for="appointment in pendingCharges" :key="appointment.id" class="pending-charge-card">
            <div class="pending-charge-main">
              <div class="pet-initial">{{ appointment.pet?.name?.charAt(0) || 'M' }}</div>
              <div>
                <strong>{{ appointment.pet?.name || 'Mascota' }}</strong>
                <span>{{ appointmentServiceLabel(appointment) }}</span>
                <small>{{ appointment.client?.fullName || 'Cliente' }}</small>
              </div>
            </div>
            <div v-if="chargeForm.appointmentId !== appointment.id" class="pending-charge-action">
              <strong>{{ appointment.suggestedAmount ? `S/ ${formatMoney(appointment.suggestedAmount)}` : 'Importe pendiente' }}</strong>
              <button class="small" type="button" @click="selectPendingCharge(appointment)">Cobrar</button>
            </div>
            <form v-else class="quick-charge-form" @submit.prevent="collectAppointment(appointment)">
              <label>Importe<input v-model.number="chargeForm.amount" type="number" min="0.01" step="0.01" required></label>
              <label>Método<select v-model="chargeForm.paymentMethod"><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
              <button class="small" :disabled="saving">{{ saving ? 'Guardando...' : 'Confirmar cobro' }}</button>
              <button class="secondary small" type="button" @click="chargeForm.appointmentId = ''">Cancelar</button>
            </form>
          </article>
        </div>
        <div v-else class="pending-empty">
          <strong>Todo está al día</strong>
          <span>No hay atenciones terminadas pendientes de cobro.</span>
        </div>
      </section>

      <form v-if="showCashForm" class="cash-form" @submit.prevent="saveCashMovement">
        <label>Tipo
          <select v-model="cashForm.type">
            <option v-for="option in cashTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label>Categoria
          <select v-model="cashForm.category">
            <option v-for="option in cashCategoryOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label>Monto
          <input v-model.number="cashForm.amount" type="number" min="0" step="0.01" required placeholder="0.00">
        </label>
        <label>Metodo
          <select v-model="cashForm.paymentMethod" :disabled="cashForm.type === 'EXPENSE'">
            <option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
        <label>Cliente
          <input v-model="cashForm.clientName" placeholder="Nombre del cliente">
        </label>
        <label>Mascota
          <input v-model="cashForm.petName" placeholder="Paciente">
        </label>
        <label>Fecha y hora
          <input v-model="cashForm.occurredAt" type="datetime-local">
        </label>
        <label class="wide">Detalle
          <input v-model="cashForm.description" required placeholder="Consulta, vacuna, compra, pago pendiente">
        </label>
        <label class="full">Notas
          <textarea v-model="cashForm.notes" rows="2" placeholder="Observacion opcional"></textarea>
        </label>
        <div class="cash-form-actions">
          <button :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar movimiento' }}</button>
          <button class="secondary" type="button" @click="resetCashForm(); showCashForm = false">Cancelar</button>
        </div>
      </form>

      <section v-if="showClosingForm" class="cash-box cash-close-box cash-close-focus">
          <div class="cash-close-header">
            <div>
              <h3>Cierre de caja</h3>
              <p class="muted-text">Al terminar el turno, cuenta el dinero fisico y confirma si cuadra con el sistema.</p>
            </div>
            <span :class="['closing-status', closingStatus.tone]">{{ closingStatus.label }}</span>
          </div>

          <form class="cash-closing-form improved" @submit.prevent="closeCashDay">
            <label>Dinero inicial del turno
              <small>Lo que habia en caja antes de atender.</small>
              <input v-model.number="closingForm.openingAmount" type="number" min="0" step="0.01" placeholder="Ej. 50.00">
            </label>
            <div class="cash-total">
              <span>Resultado del dia</span>
              <small>Ventas y cobros menos gastos.</small>
              <strong>S/ {{ formatMoney(cashSummary.net) }}</strong>
            </div>
            <div class="cash-total strong">
              <span>Caja esperada</span>
              <small>Inicial + resultado del dia.</small>
              <strong>S/ {{ formatMoney(expectedClosingAmount) }}</strong>
            </div>
            <label>Dinero contado fisicamente
              <small>Lo que tienes en efectivo al cerrar.</small>
              <input v-model.number="closingForm.countedAmount" type="number" min="0" step="0.01" placeholder="Ej. 230.00">
            </label>
            <div :class="['cash-total', closingStatus.tone]">
              <span>Resultado automatico</span>
              <small>Debe quedar en S/ 0.00.</small>
              <strong>S/ {{ formatMoney(closingDifference) }}</strong>
            </div>
            <label>Notas
              <small>Opcional, solo si hubo diferencia.</small>
              <input v-model="closingForm.notes" placeholder="Ej. falta vuelto, pago pendiente o caja conforme">
            </label>
            <button :disabled="saving">{{ saving ? 'Guardando...' : cashSummary.closing ? 'Actualizar cierre' : 'Guardar cierre del día' }}</button>
          </form>
      </section>

      <div class="cash-activity-heading">
        <div><h3>Actividad del día</h3><p class="muted-text">{{ cashActivityLabel }}</p></div>
      </div>
      <table class="cash-table">
        <thead><tr><th>Hora</th><th>Concepto</th><th>Categoria</th><th>Metodo</th><th>Monto</th><th>Acciones</th></tr></thead>
        <tbody>
          <tr v-if="!sortedCashMovements.length"><td colspan="6" class="empty">Caja limpia para este dia. Agrega el primer movimiento cuando haya una venta, pago o gasto.</td></tr>
          <tr v-for="movement in sortedCashMovements" :key="movement.id">
            <td>{{ formatCashDateTime(movement.occurredAt) }}</td>
            <td>
              <strong>{{ movement.description }}</strong>
              <small v-if="movement.clientName || movement.petName">{{ movement.clientName || '-' }} · {{ movement.petName || '-' }}</small>
            </td>
            <td>{{ cashCategoryLabels[movement.category] || movement.category }}</td>
            <td>{{ paymentLabels[movement.paymentMethod] || '-' }}</td>
            <td :class="movementAmountClass(movement)">{{ movementSignedAmount(movement) }}</td>
            <td><button class="danger small" type="button" @click="deleteCashMovement(movement)">Eliminar</button></td>
          </tr>
        </tbody>
      </table>
      </div>

      <section v-else class="receivables-workspace">
        <div class="receivable-metrics">
          <article><span>Saldo pendiente</span><strong>S/ {{ formatMoney(receivableTotal) }}</strong></article>
          <article><span>Cuentas abiertas</span><strong>{{ receivables.length }}</strong></article>
        </div>

        <form v-if="showReceivableForm" class="receivable-editor" @submit.prevent="saveReceivable">
          <div class="receivable-editor-heading"><div><span class="badge">Nueva cuenta</span><h3>Registrar deuda o adelanto</h3></div><button class="ghost small" type="button" @click="showReceivableForm=false; resetReceivableForm()">Cerrar</button></div>
          <div class="receivable-form-grid">
            <label>Cliente<select v-model="receivableForm.clientId" required @change="receivableForm.petId=''">
              <option value="" disabled>Selecciona un cliente</option><option v-for="client in clients" :key="client.id" :value="client.id">{{ client.fullName }}</option>
            </select></label>
            <label>Mascota<select v-model="receivableForm.petId" :disabled="!receivableForm.clientId"><option value="">Sin mascota</option><option v-for="pet in receivablePets" :key="pet.id" :value="pet.id">{{ pet.name }}</option></select></label>
            <label class="wide">Servicio o concepto<input v-model="receivableForm.description" required placeholder="Ej. Cirugía, tratamiento u hospedaje"></label>
            <label>Total de la cuenta<input v-model.number="receivableForm.total" type="number" min="0.01" step="0.01" required></label>
            <label>Adelanto recibido<input v-model.number="receivableForm.initialPayment" type="number" min="0" step="0.01"></label>
            <label>Método del adelanto<select v-model="receivableForm.paymentMethod" :disabled="!receivableForm.initialPayment"><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
            <label class="wide">Nota opcional<input v-model="receivableForm.notes" placeholder="Fecha prometida, responsable o detalle"></label>
          </div>
          <div class="receivable-preview"><span>Quedará pendiente</span><strong>S/ {{ formatMoney(Math.max(0, Number(receivableForm.total || 0) - Number(receivableForm.initialPayment || 0))) }}</strong></div>
          <button :disabled="saving">{{ saving ? 'Guardando...' : 'Guardar cuenta por cobrar' }}</button>
        </form>

        <div v-if="receivables.length" class="receivable-list">
          <article v-for="receivable in receivables" :key="receivable.id" class="receivable-card">
            <div class="receivable-person"><div class="pet-initial">{{ (receivable.pet?.name || receivable.client?.fullName || 'C').charAt(0) }}</div><div><strong>{{ receivable.pet?.name || receivable.client?.fullName }}</strong><span v-if="receivable.pet">{{ receivable.client?.fullName }}</span><small>{{ receivable.description }}</small></div></div>
            <div class="receivable-progress"><div><span>Pagado S/ {{ formatMoney(receivable.paid) }}</span><strong>Pendiente S/ {{ formatMoney(receivable.balance) }}</strong></div><progress :value="receivable.paid" :max="receivable.total"></progress><small>Total S/ {{ formatMoney(receivable.total) }}</small></div>
            <button v-if="payingReceivableId !== receivable.id" class="small" type="button" @click="startReceivablePayment(receivable)">Registrar abono</button>
            <form v-else class="receivable-payment" @submit.prevent="payReceivable(receivable)">
              <label>Importe<input v-model.number="receivablePayment.amount" type="number" min="0.01" :max="receivable.balance" step="0.01" required></label>
              <label>Método<select v-model="receivablePayment.paymentMethod"><option v-for="option in paymentOptions" :key="option.value" :value="option.value">{{ option.label }}</option></select></label>
              <button class="small" :disabled="saving">Confirmar</button><button class="ghost small" type="button" @click="payingReceivableId=''">Cancelar</button>
            </form>
          </article>
        </div>
        <div v-else class="receivable-empty"><strong>No hay cuentas pendientes</strong><span>Cuando un cliente deje un saldo o pague un adelanto aparecerá aquí.</span></div>
      </section>
    </section>

    <section v-else class="glass-card">
      <h2>Resumen administrativo</h2>
      <p class="muted-text">Usa las pestañas para gestionar inventario, clientes y caja. La agenda diaria vive en Recepción.</p>
    </section>
  </AdminLayout>
</template>

<style scoped>
.cash-panel {
  display: grid;
  gap: 18px;
}

.cash-day-view { display: grid; gap: 18px; }
.cash-subnav { display: flex; gap: 6px; width: fit-content; padding: 5px; border: 1px solid rgba(13,95,96,.12); border-radius: 16px; background: rgba(229,242,239,.72); }
.cash-subnav button { display: flex; align-items: center; gap: 7px; padding: 9px 14px; border: 0; background: transparent; color: #5d716d; box-shadow: none; }
.cash-subnav button.active { background: #fff; color: #155f66; box-shadow: 0 8px 20px rgba(15,74,76,.1); }
.cash-subnav span { min-width: 20px; padding: 2px 6px; border-radius: 999px; background: #dff2ed; font-size: .75rem; }
.receivables-workspace { display: grid; gap: 16px; }
.receivable-metrics { display: grid; grid-template-columns: 1.4fr 1fr; gap: 12px; }
.receivable-metrics article { padding: 18px; border: 1px solid rgba(13,95,96,.13); border-radius: 20px; background: linear-gradient(145deg,rgba(255,255,255,.94),rgba(231,248,243,.7)); }
.receivable-metrics span { display: block; color: #657671; font-size: .8rem; font-weight: 800; text-transform: uppercase; }
.receivable-metrics strong { display: block; margin-top: 6px; color: #12302b; font-size: 1.65rem; }
.receivable-editor { display: grid; gap: 15px; padding: 18px; border: 1px solid rgba(13,95,96,.14); border-radius: 22px; background: rgba(247,252,250,.92); }
.receivable-editor-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.receivable-editor-heading h3 { margin: 6px 0 0; }
.receivable-form-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.receivable-form-grid label,.receivable-payment label { display: grid; gap: 5px; font-weight: 800; }
.receivable-form-grid .wide { grid-column: span 2; }
.receivable-preview { display: flex; justify-content: space-between; align-items: center; padding: 13px 15px; border-radius: 15px; background: #e4f4f0; color: #155f5d; }
.receivable-list { display: grid; gap: 10px; }
.receivable-card { display: grid; grid-template-columns: minmax(220px,1.2fr) minmax(230px,1fr) auto; align-items: center; gap: 18px; padding: 16px; border: 1px solid rgba(13,95,96,.13); border-radius: 20px; background: rgba(255,255,255,.8); }
.receivable-person { display: flex; align-items: center; gap: 11px; }
.receivable-person > div:last-child { display: grid; gap: 2px; }
.receivable-person span,.receivable-person small,.receivable-progress small { color: #687a75; }
.receivable-progress { display: grid; gap: 7px; }
.receivable-progress > div { display: flex; justify-content: space-between; gap: 10px; font-size: .84rem; }
.receivable-progress progress { width: 100%; height: 8px; accent-color: #159482; }
.receivable-payment { display: grid; grid-template-columns: 110px 130px auto auto; align-items: end; gap: 7px; grid-column: 1 / -1; padding-top: 12px; border-top: 1px solid rgba(13,95,96,.1); }
.receivable-payment input,.receivable-payment select { padding: 8px 9px; }
.receivable-empty { display: grid; gap: 4px; padding: 24px; border: 1px dashed rgba(13,95,96,.2); border-radius: 20px; text-align: center; color: #60736e; }

.cash-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: nowrap;
}

.service-editor { align-self: start; }
.service-price-note {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(225, 244, 239, 0.72);
  color: #536b66;
  font-size: 0.86rem;
  line-height: 1.45;
}

.cash-actions button { white-space: nowrap; }

.cash-date {
  max-width: 180px;
}

.cash-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.cash-metric {
  border: 1px solid rgba(13, 95, 96, 0.14);
  border-radius: 20px;
  padding: 18px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(232, 250, 244, 0.64));
  box-shadow: 0 18px 40px rgba(13, 79, 80, 0.08);
}

.cash-metric span {
  display: block;
  color: #60716d;
  font-size: 0.85rem;
  font-weight: 800;
  text-transform: uppercase;
}

.cash-metric strong {
  display: block;
  margin-top: 8px;
  color: #10231f;
  font-size: 1.6rem;
}

.cash-metric small {
  display: block;
  margin-top: 5px;
  color: #6b7b77;
}

.cash-metric.emphasis {
  background: linear-gradient(135deg, #0f766e, #12a28d);
}

.cash-metric.emphasis span,
.cash-metric.emphasis strong,
.cash-metric.emphasis small {
  color: #fff;
}

.cash-payment-summary,
.cash-closed-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 16px;
  border: 1px solid rgba(13, 95, 96, 0.12);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.68);
}

.cash-payment-label {
  color: #60716d;
  font-size: 0.82rem;
  font-weight: 800;
  white-space: nowrap;
}

.cash-closed-summary > div {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cash-closed-summary small {
  color: #60716d;
}

.cash-close-focus {
  max-width: 920px;
  margin: 0 auto;
  width: 100%;
  box-shadow: 0 24px 55px rgba(13, 79, 80, 0.11);
}

.pending-charges {
  padding: 18px;
  border: 1px solid rgba(13, 95, 96, 0.13);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
}

.pending-charges-heading,
.pending-charge-card,
.pending-charge-main,
.pending-charge-action,
.quick-charge-form {
  display: flex;
  align-items: center;
}

.pending-charges-heading,
.pending-charge-card {
  justify-content: space-between;
  gap: 16px;
}

.pending-charges-heading h3,
.pending-charges-heading p {
  margin: 5px 0 0;
}

.pending-count {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: #e5f5f1;
  color: #0d6765;
  font-size: 1.15rem;
}

.pending-charge-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.pending-charge-card {
  padding: 13px;
  border: 1px solid rgba(13, 95, 96, 0.12);
  border-radius: 17px;
  background: rgba(246, 252, 250, 0.9);
}

.pending-charge-main,
.pending-charge-action,
.quick-charge-form {
  gap: 10px;
}

.pending-charge-main > div:last-child {
  display: grid;
  gap: 2px;
}

.pending-charge-main span,
.pending-charge-main small,
.pending-empty span {
  color: #667773;
}

.pet-initial {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: #176b70;
  color: #fff;
  font-weight: 900;
}

.quick-charge-form label {
  display: grid;
  gap: 3px;
  font-size: 0.75rem;
  font-weight: 800;
}

.quick-charge-form input,
.quick-charge-form select {
  min-width: 120px;
  padding: 8px 10px;
}

.pending-empty {
  display: grid;
  gap: 4px;
  margin-top: 14px;
  padding: 15px;
  border-radius: 16px;
  background: rgba(229, 245, 241, 0.72);
}

.cash-activity-heading h3,
.cash-activity-heading p {
  margin: 0;
}

.cash-activity-heading p {
  margin-top: 3px;
  font-size: 0.84rem;
}

.cash-form {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(13, 95, 96, 0.14);
  border-radius: 22px;
  background: rgba(240, 250, 247, 0.75);
}

.cash-form label,
.cash-closing-form label {
  display: grid;
  gap: 6px;
  color: #142522;
  font-weight: 800;
}

.cash-form .wide {
  grid-column: span 2;
}

.cash-form .full {
  grid-column: 1 / -1;
}

.cash-form-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.cash-split {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 14px;
}

.cash-box {
  padding: 16px;
  border: 1px solid rgba(13, 95, 96, 0.14);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
}

.cash-box h3 {
  margin: 0 0 12px;
}

.cash-methods {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cash-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #e7f7f2;
  color: #0b5d58;
  font-weight: 800;
}

.cash-closing-form {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  align-items: end;
}

.cash-panel td small {
  display: block;
  margin-top: 4px;
  color: #6b7b77;
}

.amount-positive {
  color: #087f5b;
  font-weight: 900;
}

.amount-negative {
  color: #b42318;
  font-weight: 900;
}

.empty.compact {
  padding: 10px 0;
}

@media (max-width: 980px) {
  .receivable-metrics,.receivable-form-grid,.receivable-card,.receivable-payment { grid-template-columns: 1fr; }
  .receivable-form-grid .wide { grid-column: auto; }
  .cash-subnav { width: 100%; }
  .cash-subnav button { flex: 1; justify-content: center; }
  .cash-actions {
    align-items: stretch;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .cash-cards,
  .cash-form,
  .cash-split,
  .cash-closing-form {
    grid-template-columns: 1fr;
  }

  .cash-payment-summary,
  .cash-closed-summary,
  .cash-closed-summary > div {
    align-items: flex-start;
    flex-direction: column;
  }

  .pending-charge-card,
  .quick-charge-form,
  .pending-charge-action {
    align-items: stretch;
    flex-direction: column;
  }

  .cash-form .wide {
    grid-column: 1 / -1;
  }
}
</style>

