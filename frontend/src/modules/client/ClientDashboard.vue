<script setup>
import { computed, ref,onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ClientLayout from '../../layouts/ClientLayout.vue';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/auth';

const router=useRouter();
const auth=useAuthStore();
const profile=ref(null);
const appointments=ref([]);
const pets=ref([]);
const error=ref('');
const success=ref('');
const photoInputs=ref({});
const brokenPhotos=ref({});
const newPetPhotoInput=ref(null);
const showPetForm=ref(false);
const savingPet=ref(false);
const newPet=ref({
  name:'',
  species:'Perro',
  breed:'',
  sex:'UNKNOWN',
  color:'',
  age:'',
  weightKg:'',
  sterilized:false,
  photo:null,
});

const activeAppointments=computed(()=>appointments.value
  .filter(a=>!['CANCELLED','ATTENDED'].includes(a.status))
  .sort((a,b)=>new Date(a.scheduledAt)-new Date(b.scheduledAt)));
const nextAppointment=computed(()=>activeAppointments.value.find(a=>new Date(a.scheduledAt)>=new Date()) || activeAppointments.value[0]);
const recentAppointments=computed(()=>[...appointments.value]
  .sort((a,b)=>new Date(b.scheduledAt)-new Date(a.scheduledAt))
  .slice(0,4));
const petsPendingPhoto=computed(()=>pets.value.filter(p=>!p.photoUrl).length);
const petsWithPrintableCard=computed(()=>pets.value.filter(p=>displayPetPhoto(p) && p.cardStatus!=='PRINTED').length);
const clientName=computed(()=>profile.value?.fullName?.split(' ')[0] || 'Hola');

async function loadData(){
  try{
    const [profileResponse,petsResponse,appointmentsResponse]=await Promise.all([
      api.get('/client-portal/me'),
      api.get('/client-portal/pets'),
      api.get('/client-portal/appointments'),
    ]);
    if(!profileResponse.data) throw new Error('CLIENT_PROFILE_NOT_FOUND');
    profile.value=profileResponse.data;
    pets.value=petsResponse.data;
    appointments.value=appointmentsResponse.data;
  }catch(e){
    auth.logout();
    router.replace('/cliente/login');
  }
}

async function uploadPetPhoto(petId,event){
  const file=event.target.files?.[0];
  event.target.value='';
  if(!file) return;
  error.value='';
  success.value='';
  const validation=validatePhoto(file);
  if(validation){
    error.value=validation;
    return;
  }
  try{
    const formData=new FormData();
    formData.append('photo',file);
    await api.post(`/client-portal/pets/${petId}/photo`,formData,{headers:{'Content-Type':'multipart/form-data'}});
    brokenPhotos.value[petId]=false;
    success.value='Foto actualizada correctamente.';
    await loadData();
  }catch(e){
    error.value=e.response?.data?.message || 'No se pudo subir la foto.';
  }
}

function validatePhoto(file){
  if(!file) return '';
  if(!['image/jpeg','image/png'].includes(file.type)) return 'Sube una foto en formato JPG o PNG para que salga en el carnet.';
  if(file.size>4*1024*1024) return 'La foto no debe pesar mas de 4 MB.';
  return '';
}

function handleNewPetPhoto(event){
  const file=event.target.files?.[0] || null;
  const validation=validatePhoto(file);
  error.value='';
  if(validation){
    newPet.value.photo=null;
    event.target.value='';
    error.value=validation;
    return;
  }
  newPet.value.photo=file;
}

function resetPetForm(){
  newPet.value={
    name:'',
    species:'Perro',
    breed:'',
    sex:'UNKNOWN',
    color:'',
    age:'',
    weightKg:'',
    sterilized:false,
    photo:null,
  };
  if(newPetPhotoInput.value) newPetPhotoInput.value.value='';
}

async function createPet(){
  error.value='';
  success.value='';
  if(!newPet.value.name.trim() || !newPet.value.species.trim()){
    error.value='Completa nombre y especie de la mascota.';
    return;
  }
  savingPet.value=true;
  try{
    const { data: pet } = await api.post('/client-portal/pets',{
      name:newPet.value.name.trim(),
      species:newPet.value.species.trim(),
      breed:newPet.value.breed.trim() || undefined,
      sex:newPet.value.sex,
      color:newPet.value.color.trim() || undefined,
      age:newPet.value.age.trim() || undefined,
      weightKg:newPet.value.weightKg === '' ? undefined : Number(newPet.value.weightKg),
      sterilized:newPet.value.sterilized,
    });

    if(newPet.value.photo){
      const formData=new FormData();
      formData.append('photo',newPet.value.photo);
      await api.post(`/client-portal/pets/${pet.id}/photo`,formData,{headers:{'Content-Type':'multipart/form-data'}});
    }

    success.value='Mascota registrada correctamente.';
    resetPetForm();
    showPetForm.value=false;
    await loadData();
  }catch(e){
    error.value=e.response?.data?.message || 'No se pudo registrar la mascota.';
  }finally{
    savingPet.value=false;
  }
}

function formatDate(value){
  if(!value) return '-';
  return new Date(value).toLocaleString('es-PE',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function statusLabel(status){
  const labels={PENDING:'Pendiente',CONFIRMED:'Confirmada',IN_PROGRESS:'En consulta',ATTENDED:'Atendida',CANCELLED:'Cancelada'};
  return labels[status] || status || '-';
}

function cardStatusLabel(pet){
  if(!pet.photoUrl) return 'Falta foto';
  if(brokenPhotos.value[pet.id]) return 'Vuelve a subir foto';
  if(pet.cardStatus==='PRINTED') return 'Carnet entregado';
  if(pet.cardStatus==='REPRINT_REQUESTED') return 'Reimpresion solicitada';
  return 'Listo para carnet';
}

function displayPetPhoto(pet){
  return Boolean(pet.photoUrl && !brokenPhotos.value[pet.id]);
}

function markPhotoBroken(petId){
  brokenPhotos.value[petId]=true;
}

function triggerPhotoInput(petId){
  photoInputs.value[petId]?.click();
}

onMounted(loadData);
</script>
<template>
  <ClientLayout title="Portal cliente" subtitle="Mascotas, citas y carnet en un solo lugar">
    <template #nav><button class="secondary" @click="$router.push('/cliente')">Nueva cita</button></template>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <section class="client-dashboard-hero glass-card">
      <div>
        <span class="badge">Happy Dog</span>
        <h2>{{ clientName }}, aqui esta todo listo para tu mascota</h2>
        <p class="muted-text">Revisa tus citas, actualiza fotos para el carnet y ten la informacion de tus mascotas ordenada.</p>
      </div>
      <div class="client-summary-strip">
        <article>
          <strong>{{ pets.length }}</strong>
          <span>Mascotas</span>
        </article>
        <article>
          <strong>{{ activeAppointments.length }}</strong>
          <span>Citas activas</span>
        </article>
        <article>
          <strong>{{ petsPendingPhoto }}</strong>
          <span>Fotos pendientes</span>
        </article>
      </div>
    </section>

    <div class="client-dashboard-grid">
      <section class="glass-card next-appointment-card">
        <div class="section-title compact">
          <div>
            <span class="badge">Proxima cita</span>
            <h2>Agenda</h2>
          </div>
          <button class="small secondary" @click="$router.push('/cliente')">Agendar</button>
        </div>
        <div v-if="nextAppointment" class="next-appointment">
          <strong>{{ nextAppointment.pet?.name || 'Mascota' }}</strong>
          <span>{{ formatDate(nextAppointment.scheduledAt) }}</span>
          <p>{{ nextAppointment.reason || 'Consulta veterinaria' }}</p>
          <span class="status">{{ statusLabel(nextAppointment.status) }}</span>
        </div>
        <div v-else class="friendly-empty">
          <strong>No tienes citas activas</strong>
          <span>Cuando recepcion confirme una cita, aparecera aqui.</span>
        </div>
      </section>

      <section class="glass-card pet-overview-card">
        <div class="section-title compact">
          <div>
            <span class="badge">Mascotas</span>
            <h2>Ficha y carnet</h2>
          </div>
          <button class="small secondary" type="button" @click="showPetForm=!showPetForm">
            {{ showPetForm ? 'Cerrar' : 'Agregar mascota' }}
          </button>
        </div>
        <form v-if="showPetForm" class="client-pet-form" @submit.prevent="createPet">
          <input v-model="newPet.name" required placeholder="Nombre de la mascota">
          <input v-model="newPet.species" required placeholder="Especie">
          <input v-model="newPet.breed" placeholder="Raza">
          <select v-model="newPet.sex">
            <option value="UNKNOWN">Sexo no especificado</option>
            <option value="MALE">Macho</option>
            <option value="FEMALE">Hembra</option>
          </select>
          <input v-model="newPet.age" placeholder="Edad aproximada">
          <input v-model="newPet.color" placeholder="Color">
          <input v-model="newPet.weightKg" type="number" step="0.01" min="0" placeholder="Peso kg opcional">
          <label class="check-row">
            <input v-model="newPet.sterilized" type="checkbox">
            <span>Esterilizado</span>
          </label>
          <label class="pet-photo-uploader">
            <input ref="newPetPhotoInput" type="file" accept="image/jpeg,image/png" @change="handleNewPetPhoto">
            <strong>{{ newPet.photo ? 'Foto seleccionada' : 'Subir foto para carnet' }}</strong>
            <span>JPG o PNG, maximo 4 MB. La imagen se ajusta automaticamente.</span>
          </label>
          <button :disabled="savingPet">{{ savingPet ? 'Guardando...' : 'Guardar mascota' }}</button>
        </form>
        <div v-if="!pets.length" class="friendly-empty">
          <strong>Aun no hay mascotas registradas</strong>
          <span>Agrega tu mascota y sube su foto para preparar el carnet.</span>
        </div>
        <div v-else class="client-pet-list">
          <article v-for="p in pets" :key="p.id" class="client-pet-card">
            <div class="pet-photo">
              <img v-if="displayPetPhoto(p)" :src="p.photoUrl" :alt="p.name" @error="markPhotoBroken(p.id)">
              <span v-else>{{ p.name?.charAt(0) || 'M' }}</span>
            </div>
            <div class="pet-info">
              <strong>{{ p.name }}</strong>
              <span>{{ p.species || 'Mascota' }}<template v-if="p.breed"> - {{ p.breed }}</template></span>
              <small>{{ cardStatusLabel(p) }}</small>
            </div>
            <input
              :ref="el=>{ if(el) photoInputs[p.id]=el }"
              class="sr-only"
              type="file"
              accept="image/jpeg,image/png"
              @change="uploadPetPhoto(p.id,$event)"
            >
            <button class="small secondary" @click="triggerPhotoInput(p.id)">
              {{ p.photoUrl ? 'Cambiar foto' : 'Subir foto' }}
            </button>
          </article>
        </div>
      </section>

      <section class="glass-card client-history-card">
        <div class="section-title compact">
          <div>
            <span class="badge">Historial</span>
            <h2>Ultimas citas</h2>
          </div>
        </div>
        <div v-if="!recentAppointments.length" class="friendly-empty">
          <strong>Sin historial todavia</strong>
          <span>Tus visitas atendidas y solicitudes apareceran en esta lista.</span>
        </div>
        <div v-else class="client-appointment-list">
          <article v-for="a in recentAppointments" :key="a.id">
            <div>
              <strong>{{ a.pet?.name || 'Mascota' }}</strong>
              <span>{{ formatDate(a.scheduledAt) }}</span>
            </div>
            <span class="status">{{ statusLabel(a.status) }}</span>
          </article>
        </div>
      </section>
    </div>
  </ClientLayout>
</template>

