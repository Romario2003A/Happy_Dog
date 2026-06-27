<script setup>
import { ref } from 'vue';
import { api } from '../../services/api';
import doctorDog from '../../assets/images/doctor-dog.webp';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';
import happyDogLocation from '../../assets/images/happy-dog-location.jpeg';

const form=ref({fullName:'',phone:'',email:'',petName:'',species:'',breed:'',sex:'UNKNOWN',age:'',weightKg:'',reason:'',scheduledAt:''});
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
        <div class="hero-actions">
          <a class="button-link" href="#solicitar-cita">Agendar cita</a>
          <a class="button-link secondary-link" href="https://wa.me/51953280579" target="_blank" rel="noreferrer">WhatsApp</a>
        </div>
        <div class="trust-strip" aria-label="Servicios principales">
          <span>Consultas</span>
          <span>Vacunas</span>
          <span>Controles</span>
        </div>
      </div>
      <img class="hero-doctor-dog" :src="doctorDog" alt="Perro con bata de doctor representando atencion veterinaria">
    </header>
    <main class="public-grid">
      <section id="solicitar-cita" class="glass-card appointment-request-card">
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
          <select v-model="form.sex">
            <option value="UNKNOWN">Sexo no especificado</option>
            <option value="MALE">Macho</option>
            <option value="FEMALE">Hembra</option>
          </select>
          <input v-model="form.age" placeholder="Edad aproximada">
          <input v-model.number="form.weightKg" type="number" min="0" step="0.01" placeholder="Peso kg opcional">
          <input v-model="form.scheduledAt" type="datetime-local" required>
          <textarea v-model="form.reason" required placeholder="Cuentanos que le pasa o que servicio necesitas"></textarea>
          <button>Quiero agendar a mi mascota</button>
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
    <section class="service-strip">
      <article class="service-pill glass-card">
        <strong>Atencion cercana</strong>
        <span>Recepcion confirma cada cita para evitar esperas innecesarias.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Historial organizado</strong>
        <span>El doctor puede revisar antecedentes, peso, temperatura y recetas.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Contacto rapido</strong>
        <span>WhatsApp y telefono visibles para resolver dudas sin perder tiempo.</span>
      </article>
    </section>
    <section class="location-card glass-card">
      <div class="section-title">
        <div>
          <span class="badge">Ubicacion y contacto</span>
          <h2>Visitanos o escribenos por WhatsApp</h2>
        </div>
      </div>
      <img :src="happyDogLocation" alt="Mapa y datos de contacto de Happy Dog">
    </section>
    <a class="whatsapp-float" href="https://wa.me/51953280579" target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp">WhatsApp</a>
  </div>
</template>
