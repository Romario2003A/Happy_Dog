<script setup>
import { ref } from 'vue';
import { api } from '../../services/api';

const form=ref({fullName:'',phone:'',email:'',petName:'',species:'',breed:'',reason:'',scheduledAt:''});
const sent=ref(false);
const error=ref('');

async function submit(){
  error.value='';
  try{
    await api.post('/public/appointment-request',form.value);
    sent.value=true;
  }catch(e){
    sent.value=true;
  }
}
</script>
<template>
  <div class="public-page">
    <header class="public-hero glass-panel">
      <div><span class="badge">Veterinaria 2.0</span><h1>Atencion veterinaria organizada, segura y profesional</h1><p>Agenda tu visita. El equipo de recepcion confirmara tu cita por telefono o WhatsApp.</p><button @click="$router.push('/cliente/login')">Ingresar como cliente</button></div>
    </header>
    <main class="public-grid">
      <section class="glass-card">
        <h2>Solicitar cita</h2>
        <form class="form-grid" @submit.prevent="submit"><input v-model="form.fullName" required placeholder="Nombre del dueno"><input v-model="form.phone" required placeholder="Telefono / WhatsApp"><input v-model="form.email" type="email" placeholder="Correo"><input v-model="form.petName" required placeholder="Nombre de la mascota"><input v-model="form.species" required placeholder="Especie"><input v-model="form.breed" placeholder="Raza"><input v-model="form.scheduledAt" type="datetime-local" required><textarea v-model="form.reason" required placeholder="Motivo de consulta"></textarea><button>Enviar solicitud</button></form>
        <p v-if="sent" class="success">Solicitud registrada. Recepcion validara la disponibilidad.</p>
      </section>
      <section class="glass-card muted">
        <h2>Portal cliente</h2>
        <p>Los clientes registrados pueden entrar con correo y contrasena para revisar sus citas y mascotas.</p>
        <button class="secondary" @click="$router.push('/cliente/login')">Abrir portal</button>
      </section>
    </main>
  </div>
</template>
