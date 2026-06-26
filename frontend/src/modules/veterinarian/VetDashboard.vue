<script setup>
import { ref,onMounted } from 'vue';
import VeterinarianLayout from '../../layouts/VeterinarianLayout.vue';
import { api } from '../../services/api';

const records=ref([]);
const products=ref([]);
const prescriptions=ref([]);

onMounted(async()=>{
  try{
    records.value=(await api.get('/medical-records')).data;
    products.value=(await api.get('/inventory')).data;
  }catch(e){}
});
</script>
<template>
  <VeterinarianLayout title="Doctor Veterinario" subtitle="Consultorio, historia clinica y recetas">
    <template #nav><button>Consultas</button><button>Historial</button><button>Recetas</button></template>
    <div class="panel-grid wide">
      <section class="glass-card">
        <h2>Evolucion medica</h2>
        <form class="form-grid"><input placeholder="Peso kg" type="number"><input placeholder="Temperatura C" type="number"><textarea placeholder="Motivo de consulta"></textarea><textarea placeholder="Diagnostico"></textarea><textarea placeholder="Tratamiento / observaciones"></textarea><button>Guardar atencion</button></form>
      </section>
      <section class="glass-card">
        <h2>Receta e inventario</h2>
        <p class="muted-text">Al guardar una receta, el backend descuenta automaticamente el stock.</p>
        <select><option>Seleccionar medicamento</option><option v-for="p in products" :key="p.id">{{ p.name }} - Stock {{ p.stock }}</option></select>
        <button class="secondary">Generar receta PDF</button>
      </section>
    </div>
  </VeterinarianLayout>
</template>
