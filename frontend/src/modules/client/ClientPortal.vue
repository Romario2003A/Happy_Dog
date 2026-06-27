<script setup>
import { ref } from 'vue';
import { api } from '../../services/api';
import doctorDog from '../../assets/images/doctor-dog.webp';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';
import happyDogLocation from '../../assets/images/happy-dog-location.jpeg';

const facebookUrl = 'https://www.facebook.com/share/1DARyzQs2j/';
const whatsappUrl = 'https://wa.me/51953280579';
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
        <h1>Agenda la atención de tu mascota sin complicaciones</h1>
        <p>Completa la solicitud y recepción te confirmará la disponibilidad por teléfono o WhatsApp.</p>
        <div class="hero-actions">
          <a class="button-link" href="#solicitar-cita">Agendar cita</a>
          <a class="button-link secondary-link" :href="whatsappUrl" target="_blank" rel="noreferrer">WhatsApp</a>
          <a class="button-link secondary-link" :href="facebookUrl" target="_blank" rel="noreferrer">Facebook</a>
        </div>
        <div class="trust-strip" aria-label="Servicios principales">
          <span>Consultas</span>
          <span>Vacunas</span>
          <span>Controles</span>
          <span>Atención en Cayma</span>
        </div>
      </div>
      <img class="hero-doctor-dog" :src="doctorDog" alt="Perro con bata de doctor representando atención veterinaria">
    </header>
    <main class="public-grid">
      <section id="solicitar-cita" class="glass-card appointment-request-card">
        <div class="section-title">
          <div>
            <span class="badge">Nueva cita</span>
            <h2>Solicitar atención</h2>
          </div>
        </div>
        <p class="muted-text">No necesitas una cuenta para pedir una cita. Te contactaremos para confirmar el horario.</p>
        <form class="form-grid" @submit.prevent="submit">
          <input v-model="form.fullName" required placeholder="Nombre del dueño">
          <input v-model="form.phone" required placeholder="Teléfono / WhatsApp">
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
          <textarea v-model="form.reason" required placeholder="Cuéntanos qué le pasa o qué servicio necesitas"></textarea>
          <button>Quiero agendar a mi mascota</button>
        </form>
        <p v-if="sent" class="success">Solicitud recibida. Recepción revisará la agenda y te confirmará pronto.</p>
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
        <strong>Atención cercana</strong>
        <span>Recepción confirma cada cita para evitar esperas innecesarias.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Historial organizado</strong>
        <span>El doctor puede revisar antecedentes, peso, temperatura y recetas.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Contacto rápido</strong>
        <span>WhatsApp y teléfono visibles para resolver dudas sin perder tiempo.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Novedades reales</strong>
        <span>Facebook queda conectado para revisar publicaciones y referencias de la veterinaria.</span>
      </article>
    </section>
    <section class="location-card glass-card">
      <div class="section-title">
        <div>
          <span class="badge">Ubicación y contacto</span>
          <h2>Visítanos o escríbenos por WhatsApp</h2>
        </div>
      </div>
      <img :src="happyDogLocation" alt="Mapa y datos de contacto de Happy Dog">
      <div class="contact-grid">
        <a class="contact-tile" :href="whatsappUrl" target="_blank" rel="noreferrer">
          <span>WhatsApp directo</span>
          <strong>953 280 579</strong>
        </a>
        <a class="contact-tile" href="tel:901969153">
          <span>Teléfono alterno</span>
          <strong>901 969 153</strong>
        </a>
        <a class="contact-tile" :href="facebookUrl" target="_blank" rel="noreferrer">
          <span>Red social</span>
          <strong>Facebook Happy Dog</strong>
        </a>
      </div>
    </section>
    <a class="whatsapp-float" :href="whatsappUrl" target="_blank" rel="noreferrer" aria-label="Escribir por WhatsApp">WhatsApp</a>
  </div>
</template>
