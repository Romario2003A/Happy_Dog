<script setup>
import { ref } from 'vue';
import { api } from '../../services/api';
import clinicHero from '../../assets/images/clinic-hero.png';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';

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
      <div class="hero-copy">
        <div class="public-brand">
          <img :src="happyDogLogo" alt="Happy Dog">
        </div>
        <h1>Agenda la atencion de tu mascota sin complicaciones</h1>
        <p>Completa la solicitud y recepcion te confirmara la disponibilidad por telefono o WhatsApp.</p>
      </div>
      <img :src="clinicHero" alt="Veterinaria atendiendo mascotas en una clinica moderna">
    </header>
    <main class="public-grid">
      <section class="glass-card">
        <div class="section-title">
          <div>
            <span class="badge">Nueva cita</span>
            <h2>Solicitar atencion</h2>
          </div>
        </div>
        <p class="muted-text">No necesitas una cuenta para pedir una cita. Te contactaremos para confirmar el horario.</p>
        <form class="form-grid" @submit.prevent="submit">
          <input v-model="form.fullName" required placeholder="Nombre del dueno">
          <input v-model="form.phone" required placeholder="Telefono / WhatsApp">
          <input v-model="form.email" type="email" placeholder="Correo opcional">
          <input v-model="form.petName" required placeholder="Nombre de la mascota">
          <input v-model="form.species" required placeholder="Especie">
          <input v-model="form.breed" placeholder="Raza">
          <input v-model="form.scheduledAt" type="datetime-local" required>
          <textarea v-model="form.reason" required placeholder="Cuentanos que le pasa o que servicio necesitas"></textarea>
          <button>Enviar solicitud de cita</button>
        </form>
        <p v-if="sent" class="success">Solicitud recibida. Recepcion revisara la agenda y te confirmara pronto.</p>
      </section>
      <section class="glass-card portal-card">
        <span class="badge">Clientes registrados</span>
        <h2>Ya tengo cuenta</h2>
        <p>Ingresa a tu portal para revisar tus mascotas, citas e historial disponible.</p>
        <button class="secondary" @click="$router.push('/cliente/login')">Ingresar al portal</button>
        <div class="portal-list">
          <span>Ver mis citas</span>
          <span>Revisar mis mascotas</span>
          <span>Crear o acceder a mi cuenta</span>
        </div>
      </section>
    </main>
  </div>
</template>
