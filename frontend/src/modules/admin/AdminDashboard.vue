<script setup>
import { computed, onMounted, ref } from 'vue';
import AdminLayout from '../../layouts/AdminLayout.vue';
import { api } from '../../services/api';

const summary = ref({});
const users = ref([]);
const inventory = ref([]);
const clients = ref([]);
const active = ref('resumen');
const error = ref('');
const success = ref('');
const saving = ref(false);
const userForm = ref({ fullName: '', email: '', password: '', role: 'VETERINARIAN' });
const productForm = ref({ name: '', category: '', unitPrice: 0, stock: 0, minStock: 0 });

const lowStockProducts = computed(() => inventory.value.filter(p => Number(p.stock) <= Number(p.minStock)));

async function loadData() {
  error.value = '';
  try {
    const [summaryRes, usersRes, inventoryRes, clientsRes] = await Promise.all([
      api.get('/reports/summary'),
      api.get('/users'),
      api.get('/inventory'),
      api.get('/clients'),
    ]);
    summary.value = summaryRes.data;
    users.value = usersRes.data;
    inventory.value = inventoryRes.data;
    clients.value = clientsRes.data;
  } catch (e) {
    error.value = 'No se pudo cargar administracion.';
  }
}

async function createUser() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/users', userForm.value);
    userForm.value = { fullName: '', email: '', password: '', role: 'VETERINARIAN' };
    success.value = 'Usuario creado correctamente.';
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo crear el usuario.';
  } finally {
    saving.value = false;
  }
}

async function createProduct() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    await api.post('/inventory', {
      ...productForm.value,
      unitPrice: Number(productForm.value.unitPrice),
      stock: Number(productForm.value.stock),
      minStock: Number(productForm.value.minStock),
    });
    productForm.value = { name: '', category: '', unitPrice: 0, stock: 0, minStock: 0 };
    success.value = 'Producto agregado al inventario.';
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo agregar el producto.';
  } finally {
    saving.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <AdminLayout title="Administracion" subtitle="Control del negocio, usuarios, inventario, caja y reportes">
    <template #nav>
      <button @click="active='resumen'">Resumen</button>
      <button @click="active='usuarios'">Usuarios</button>
      <button @click="active='inventario'">Inventario</button>
      <button @click="active='clientes'">Clientes</button>
      <button @click="active='caja'">Caja</button>
      <button @click="$router.push('/recepcion')">Recepcion</button>
      <button @click="$router.push('/admin/cuenta')">Mi cuenta</button>
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
        <button @click="active='usuarios'">Crear usuario</button>
        <button class="secondary" @click="active='inventario'">Agregar producto</button>
      </div>
    </div>

    <div class="cards">
      <div class="glass-card metric"><span>Clientes</span><strong>{{ summary.clients ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Pacientes</span><strong>{{ summary.pets ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ summary.appointments ?? 0 }}</strong></div>
      <div class="glass-card metric"><span>Stock bajo</span><strong>{{ summary.lowStock ?? lowStockProducts.length }}</strong></div>
    </div>

    <div v-if="active==='usuarios'" class="panel-grid">
      <section class="glass-card">
        <h2>Usuarios del sistema</h2>
        <table>
          <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th></tr></thead>
          <tbody>
            <tr v-for="u in users" :key="u.id"><td>{{ u.fullName }}</td><td>{{ u.email }}</td><td>{{ u.role }}</td><td>{{ u.active ? 'Activo' : 'Inactivo' }}</td></tr>
          </tbody>
        </table>
      </section>
      <section class="glass-card">
        <h2>Crear usuario interno</h2>
        <form class="stack" @submit.prevent="createUser">
          <label>Nombre<input v-model="userForm.fullName" required placeholder="Nombre completo"></label>
          <label>Correo<input v-model="userForm.email" type="email" required placeholder="usuario@happydog.com"></label>
          <label>Contrasena temporal<input v-model="userForm.password" type="password" required minlength="6" placeholder="Temporal2026!"></label>
          <label>Rol
            <select v-model="userForm.role">
              <option value="VETERINARIAN">Veterinario</option>
              <option value="RECEPTIONIST">Recepcion</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>
          <button :disabled="saving">{{ saving ? 'Guardando...' : 'Crear usuario' }}</button>
        </form>
      </section>
    </div>

    <div v-else-if="active==='inventario'" class="panel-grid">
      <section class="glass-card">
        <h2>Inventario</h2>
        <table>
          <thead><tr><th>Producto</th><th>Categoria</th><th>Precio</th><th>Stock</th></tr></thead>
          <tbody>
            <tr v-if="!inventory.length"><td colspan="4" class="empty">No hay productos registrados.</td></tr>
            <tr v-for="p in inventory" :key="p.id"><td>{{ p.name }}</td><td>{{ p.category || '-' }}</td><td>S/ {{ p.unitPrice }}</td><td>{{ p.stock }}</td></tr>
          </tbody>
        </table>
      </section>
      <section class="glass-card">
        <h2>Agregar producto</h2>
        <form class="stack" @submit.prevent="createProduct">
          <label>Producto<input v-model="productForm.name" required placeholder="Vacuna, medicamento, alimento"></label>
          <label>Categoria<input v-model="productForm.category" placeholder="Medicamento"></label>
          <label>Precio<input v-model.number="productForm.unitPrice" type="number" min="0" step="0.01" required></label>
          <label>Stock<input v-model.number="productForm.stock" type="number" min="0" required></label>
          <label>Stock minimo<input v-model.number="productForm.minStock" type="number" min="0"></label>
          <button :disabled="saving">{{ saving ? 'Guardando...' : 'Agregar producto' }}</button>
        </form>
      </section>
    </div>

    <section v-else-if="active==='clientes'" class="glass-card">
      <h2>Clientes registrados</h2>
      <table>
        <thead><tr><th>Cliente</th><th>Contacto</th><th>Mascotas</th></tr></thead>
        <tbody>
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
      <p class="muted-text">Usa las pestañas para gestionar usuarios, inventario, clientes y caja. La agenda diaria vive en Recepcion.</p>
    </section>
  </AdminLayout>
</template>
