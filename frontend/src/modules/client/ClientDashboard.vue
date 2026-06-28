<script setup>
import { ref,onMounted } from 'vue';
import ClientLayout from '../../layouts/ClientLayout.vue';
import { api } from '../../services/api';

const profile=ref(null);
const appointments=ref([]);
const pets=ref([]);
const error=ref('');
const success=ref('');

async function loadData(){
  try{
    profile.value=(await api.get('/client-portal/me')).data;
    pets.value=(await api.get('/client-portal/pets')).data;
    appointments.value=(await api.get('/client-portal/appointments')).data;
  }catch(e){}
}

async function uploadPetPhoto(petId,event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file) return;
  error.value='';
  success.value='';
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
    error.value='Sube una foto en formato JPG, PNG o WebP.';
    return;
  }
  if(file.size>4*1024*1024){
    error.value='La foto no debe pesar mas de 4 MB.';
    return;
  }
  try{
    const formData=new FormData();
    formData.append('photo',file);
    await api.post(`/client-portal/pets/${petId}/photo`,formData,{headers:{'Content-Type':'multipart/form-data'}});
    success.value='Foto actualizada correctamente.';
    await loadData();
  }catch(e){
    error.value=e.response?.data?.message || 'No se pudo subir la foto.';
  }
}

onMounted(loadData);
</script>
<template>
  <ClientLayout title="Mi portal" subtitle="Tus mascotas, citas y datos registrados">
    <template #nav><button @click="$router.push('/cliente')">Solicitar cita</button></template>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>
    <div class="cards">
      <div class="glass-card metric"><span>Mascotas</span><strong>{{ pets.length }}</strong></div>
      <div class="glass-card metric"><span>Citas</span><strong>{{ appointments.length }}</strong></div>
      <div class="glass-card metric"><span>Estado</span><strong>{{ profile?.active===false?'Inactivo':'Activo' }}</strong></div>
      <div class="glass-card metric"><span>Contacto</span><strong>{{ profile?.phone || '-' }}</strong></div>
    </div>
    <div class="panel-grid">
      <section class="glass-card">
        <h2>Mis citas</h2>
        <table><thead><tr><th>Mascota</th><th>Fecha</th><th>Estado</th></tr></thead><tbody><tr v-if="!appointments.length"><td colspan="3" class="empty">Aun no tienes citas registradas.</td></tr><tr v-for="a in appointments" :key="a.id"><td>{{ a.pet?.name }}</td><td>{{ new Date(a.scheduledAt).toLocaleString() }}</td><td><span class="status">{{ a.status }}</span></td></tr></tbody></table>
      </section>
      <section class="glass-card">
        <h2>Mis mascotas</h2>
        <p class="muted-text">Sube una foto clara de tu mascota. El sistema la ajusta automaticamente al carnet.</p>
        <table><tbody><tr v-if="!pets.length"><td class="empty">Sin mascotas registradas.</td></tr><tr v-for="p in pets" :key="p.id"><td>{{ p.name }}</td><td>{{ p.species }}</td><td><span v-if="p.photoUrl" class="status">Con foto</span><span v-else class="status">Sin foto</span></td><td><label class="small secondary file-button">Subir foto<input type="file" accept="image/jpeg,image/png,image/webp" @change="uploadPetPhoto(p.id,$event)"></label></td></tr></tbody></table>
      </section>
    </div>
  </ClientLayout>
</template>
