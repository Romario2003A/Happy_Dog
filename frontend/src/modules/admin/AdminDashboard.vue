<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AdminLayout from '../../layouts/AdminLayout.vue';
import { api } from '../../services/api';

const route = useRoute();
const router = useRouter();
const summary = ref({});
const inventory = ref([]);
const clients = ref([]);
const appointments = ref([]);
const pets = ref([]);
const adminTabs = ['resumen', 'inventario', 'clientes', 'caja'];
const active = ref(tabFromRoute());
const error = ref('');
const success = ref('');
const saving = ref(false);
const showProductForm = ref(false);
const editingProductId = ref('');
const inventorySearch = ref('');
const productForm = ref({ name: '', category: '', unitPrice: 0, stock: 0, minStock: 0 });
const cashDate = ref(todayInputDate());
const cashMovements = ref([]);
const cashSummary = ref(defaultCashSummary());
const showCashForm = ref(false);
const cashForm = ref(defaultCashForm());
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
  { value: 'SURGERY', label: 'Cirugia' },
  { value: 'GROOMING', label: 'Bano y corte' },
  { value: 'TREATMENT', label: 'Tratamiento' },
  { value: 'PRODUCT', label: 'Producto' },
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
const filteredInventory = computed(() => {
  const query = inventorySearch.value.trim().toLowerCase();
  if (!query) return inventory.value;
  return inventory.value.filter(product => [
    product.name,
    product.category,
    product.sku,
  ].some(value => String(value || '').toLowerCase().includes(query)));
});
const sortedCashMovements = computed(() => cashMovements.value.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)));
const expectedClosingAmount = computed(() => Number(closingForm.value.openingAmount || 0) + Number(cashSummary.value.net || 0));
const closingDifference = computed(() => Number(closingForm.value.countedAmount || 0) - expectedClosingAmount.value);
const closingStatus = computed(() => {
  if (Math.abs(closingDifference.value) < 0.01) return { label: 'Caja cuadrada', tone: 'ok' };
  return closingDifference.value > 0
    ? { label: 'Sobra dinero', tone: 'warn' }
    : { label: 'Falta dinero', tone: 'danger' };
});

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
  const [summaryRes, movementsRes] = await Promise.allSettled([
    api.get(`/cash/summary?date=${cashDate.value}`),
    api.get(`/cash?from=${cashDate.value}&to=${cashDate.value}`),
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
    }
  }

  if (movementsRes.status === 'fulfilled') {
    cashMovements.value = movementsRes.value.data;
  }

  if (summaryRes.status === 'rejected' || movementsRes.status === 'rejected') {
    const status = rejectedStatus(summaryRes) || rejectedStatus(movementsRes);
    error.value = status === 401 || status === 403
      ? 'Tu sesion no tiene permisos para Caja. Ingresa otra vez con la cuenta de recepcion o administracion.'
      : 'No se pudo cargar caja. Intenta actualizar la pagina en unos segundos.';
  }
}

async function loadData() {
  error.value = '';
  const [summaryRes, inventoryRes, clientsRes, appointmentsRes, petsRes] = await Promise.allSettled([
    api.get('/reports/summary'),
    api.get('/inventory'),
    api.get('/clients'),
    api.get('/appointments'),
    api.get('/pets'),
  ]);

  if (inventoryRes.status === 'fulfilled') inventory.value = inventoryRes.value.data;
  if (clientsRes.status === 'fulfilled') clients.value = clientsRes.value.data;
  if (appointmentsRes.status === 'fulfilled') appointments.value = appointmentsRes.value.data;
  if (petsRes.status === 'fulfilled') pets.value = petsRes.value.data;

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
      <button @click="setActive('resumen')">Resumen</button>
      <button @click="openInventory">Inventario</button>
      <button @click="setActive('clientes')">Clientes</button>
      <button @click="setActive('caja')">Caja</button>
      <button @click="$router.push('/admin/cuenta')">Mi cuenta</button>
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

    <div class="admin-hero glass-card">
      <div>
        <span class="badge">Panel administrativo</span>
        <h2>Control general de Happy Dog</h2>
        <p class="muted-text">Administra inventario, clientes y reportes sin mezclarlo con la agenda diaria.</p>
      </div>
    </div>

    <div v-if="active==='resumen'" class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ adminStats.clients }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ adminStats.pets }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ adminStats.appointments }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ adminStats.lowStock }}</strong></div>
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
          <span class="badge">Caja diaria</span>
          <h2>Movimientos de caja</h2>
          <p class="muted-text">Registra consultas, vacunas, cirugias, bano y corte, productos, deudas y gastos.</p>
        </div>
        <div class="cash-actions">
          <input v-model="cashDate" class="cash-date" type="date">
          <button class="secondary small" type="button" @click="showCashForm = !showCashForm">
            {{ showCashForm ? 'Ocultar' : 'Nuevo movimiento' }}
          </button>
        </div>
      </div>

      <div class="cash-cards">
        <div class="cash-metric"><span>Ingresos</span><strong>S/ {{ formatMoney(cashSummary.income) }}</strong></div>
        <div class="cash-metric"><span>Gastos</span><strong>S/ {{ formatMoney(cashSummary.expenses) }}</strong></div>
        <div class="cash-metric"><span>Deudas cobradas</span><strong>S/ {{ formatMoney(cashSummary.debtPayments) }}</strong></div>
        <div class="cash-metric emphasis"><span>Neto del dia</span><strong>S/ {{ formatMoney(cashSummary.net) }}</strong></div>
      </div>

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

      <div class="cash-split">
        <section class="cash-box">
          <h3>Metodo de pago</h3>
          <div v-if="cashSummary.byPaymentMethod?.length" class="cash-methods">
            <span v-for="item in cashSummary.byPaymentMethod" :key="item.key" class="cash-chip">
              {{ paymentLabels[item.key] || item.key }} <strong>S/ {{ formatMoney(item.total) }}</strong>
            </span>
          </div>
          <p v-else class="empty compact">Aun no hay pagos registrados para este dia.</p>
        </section>
        <section class="cash-box">
          <div class="cash-close-header">
            <div>
              <h3>Cierre de caja</h3>
              <p class="muted-text">Al terminar el turno, cuenta el dinero real y compáralo con lo registrado.</p>
            </div>
            <span :class="['closing-status', closingStatus.tone]">{{ closingStatus.label }}</span>
          </div>

          <div class="cash-guide">
            <span>1. Dinero inicial</span>
            <span>2. Movimiento del día</span>
            <span>3. Conteo final</span>
          </div>

          <form class="cash-closing-form improved" @submit.prevent="closeCashDay">
            <label>Dinero inicial
              <input v-model.number="closingForm.openingAmount" type="number" min="0" step="0.01" placeholder="Ej. 50.00">
            </label>
            <div class="cash-total">
              <span>Movimiento del día</span>
              <strong>S/ {{ formatMoney(cashSummary.net) }}</strong>
            </div>
            <div class="cash-total strong">
              <span>Caja esperada</span>
              <strong>S/ {{ formatMoney(expectedClosingAmount) }}</strong>
            </div>
            <label>Dinero contado al cerrar
              <input v-model.number="closingForm.countedAmount" type="number" min="0" step="0.01" placeholder="Ej. 230.00">
            </label>
            <div :class="['cash-total', closingStatus.tone]">
              <span>Diferencia</span>
              <strong>S/ {{ formatMoney(closingDifference) }}</strong>
            </div>
            <label>Notas del cierre
              <input v-model="closingForm.notes" placeholder="Ej. falta vuelto, pago pendiente o caja conforme">
            </label>
            <button class="secondary small" :disabled="saving">Guardar cierre de caja</button>
          </form>
        </section>
      </div>

      <table>
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

.cash-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cash-date {
  max-width: 180px;
}

.cash-cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.cash-metric.emphasis {
  background: linear-gradient(135deg, #0f766e, #12a28d);
}

.cash-metric.emphasis span,
.cash-metric.emphasis strong {
  color: #fff;
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
  .cash-cards,
  .cash-form,
  .cash-split,
  .cash-closing-form {
    grid-template-columns: 1fr;
  }

  .cash-form .wide {
    grid-column: 1 / -1;
  }
}
</style>

