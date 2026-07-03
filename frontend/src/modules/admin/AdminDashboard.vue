<script setup>
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../../layouts/AdminLayout.vue';
import { api } from '../../services/api';

const summary = ref({});
const users = ref([]);
const inventory = ref([]);
const clients = ref([]);
const appointments = ref([]);
const pets = ref([]);
const active = ref('resumen');
const error = ref('');
const success = ref('');
const saving = ref(false);
const showUserForm = ref(false);
const showProductForm = ref(false);
const editingProductId = ref('');
const inventorySearch = ref('');
const userForm = ref({ fullName: '', email: '', password: '', role: 'VETERINARIAN' });
const productForm = ref({ name: '', category: '', unitPrice: 0, stock: 0, minStock: 0 });

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

function openUsers() {
  active.value = 'usuarios';
  showUserForm.value = false;
}

function openUserCreator() {
  active.value = 'usuarios';
  showUserForm.value = true;
}

function openInventory() {
  active.value = 'inventario';
  showProductForm.value = false;
  editingProductId.value = '';
}

function openProductCreator() {
  active.value = 'inventario';
  editingProductId.value = '';
  resetProductForm();
  showProductForm.value = true;
}

async function loadData() {
  error.value = '';
  const [summaryRes, usersRes, inventoryRes, clientsRes, appointmentsRes, petsRes] = await Promise.allSettled([
    api.get('/reports/summary'),
    api.get('/users'),
    api.get('/inventory'),
    api.get('/clients'),
    api.get('/appointments'),
    api.get('/pets'),
  ]);

  if (usersRes.status === 'fulfilled') users.value = usersRes.value.data;
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

  const failed = [summaryRes, usersRes, inventoryRes, clientsRes].some(result => result.status === 'rejected');
  if (failed) {
    error.value = 'Algunos datos administrativos no se pudieron cargar. Actualiza la página o vuelve a iniciar sesión si falta información.';
  }
}

async function createUser() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/users', userForm.value);
    userForm.value = { fullName: '', email: '', password: '', role: 'VETERINARIAN' };
    showUserForm.value = false;
    success.value = 'Usuario creado correctamente.';
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo crear el usuario.';
  } finally {
    saving.value = false;
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
  active.value = 'inventario';
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

function formatPrice(value) {
  return Number(value || 0).toFixed(2);
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

onMounted(loadData);
</script>

<template>
  <AdminLayout title="Administración" subtitle="Control del negocio, usuarios, inventario, caja y reportes" hide-user-pill>
    <template #nav>
      <button @click="active='resumen'">Resumen</button>
      <button @click="openUsers">Usuarios</button>
      <button @click="openInventory">Inventario</button>
      <button @click="active='clientes'">Clientes</button>
      <button @click="active='caja'">Caja</button>
      <button @click="$router.push('/admin/cuenta')">Mi cuenta</button>
    </template>

    <template #top-actions>
      <button class="secondary top-action-button" type="button" @click="$router.push('/recepcion')">Recepción</button>
    </template>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div class="admin-hero glass-card">
      <div>
        <span class="badge">Panel administrativo</span>
        <h2>Control general de Happy Dog</h2>
        <p class="muted-text">Administra usuarios, inventario, clientes y reportes sin mezclarlo con la agenda diaria.</p>
      </div>
      <div class="admin-actions">
        <button @click="openUserCreator">Crear usuario</button>
        <button class="secondary" @click="openProductCreator">Agregar producto</button>
      </div>
    </div>

    <div v-if="active==='resumen'" class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ adminStats.clients }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ adminStats.pets }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ adminStats.appointments }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ adminStats.lowStock }}</strong></div>
    </div>

    <div v-if="active==='usuarios'" class="panel-grid" :class="{ single: !showUserForm }">
      <section class="glass-card">
        <div class="section-title">
          <div>
            <h2>Usuarios del sistema</h2>
            <p class="muted-text">Gestiona las cuentas internas que entran a recepción, veterinario y administración.</p>
          </div>
          <button class="secondary small" @click="showUserForm = true">Crear usuario</button>
        </div>
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id"><td>{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td><td>{{ u.active ? 'Activo' : 'Inactivo' }}</td></tr>
          </tbody>
        </table>
      </section>
      <section v-if="showUserForm" class="glass-card">
        <div class="section-title">
          <div>
            <h2>Crear usuario interno</h2>
            <p class="muted-text">Crea una cuenta temporal para el personal y luego podrá cambiar su contraseña.</p>
          </div>
          <button class="ghost small" type="button" @click="showUserForm = false">Cerrar</button>
        </div>
        <form class="stack" @submit.prevent="createUser">
          <label>Nombre<input v-model="userForm.fullName" required placeholder="Nombre completo"></label>
          <label>Correo<input v-model="userForm.email" type="email" required placeholder="usuario@happydog.com"></label>
          <label>Contraseña temporal<input v-model="userForm.password" type="password" required minlength="6" placeholder="Temporal2026!"></label>
          <label>Rol
            <select v-model="userForm.role">
              <option value="VETERINARIAN">Veterinario</option>
              <option value="RECEPTIONIST">Recepción</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <button :disabled="saving">{{ saving ? 'Guardando...' : 'Crear usuario' }}</button>
          <button class="secondary" type="button" @click="showUserForm = false">Cancelar</button>
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

    <section v-else-if="active==='caja'" class="glass-card">
      <h2>Caja / ventas</h2>
      <p class="empty">Modulo preparado para conectar pagos, ventas de productos y reportes de caja.</p>
    </section>

    <section v-else class="glass-card">
      <h2>Resumen administrativo</h2>
      <p class="muted-text">Usa las pestañas para gestionar usuarios, inventario, clientes y caja. La agenda diaria vive en Recepción.</p>
    </section>
  </AdminLayout>
</template>

