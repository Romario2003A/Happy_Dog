<script setup>
import { ref } from 'vue';
import { api } from '../../services/api';
import doctorDog from '../../assets/images/happy-dog-doctor-painting.webp';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';
import happyDogLocation from '../../assets/images/happy-dog-location.jpeg';

const facebookUrl = 'https://www.facebook.com/share/1DARyzQs2j/';
const whatsappUrl = 'https://wa.me/51953280579';
const form = ref({
  fullName: '',
  phone: '',
  email: '',
  petName: '',
  species: '',
  breed: '',
  sex: 'UNKNOWN',
  age: '',
  weightKg: '',
  reason: '',
  scheduledAt: '',
});
const sent = ref(false);
const error = ref('');

async function submit() {
  error.value = '';
  try {
    await api.post('/public/appointment-request', form.value);
    sent.value = true;
  } catch (e) {
    sent.value = true;
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
        <span class="badge">Veterinaria Happy Dog</span>
        <h1>Citas veterinarias sin complicaciones</h1>
        <p>Solicita atenci&oacute;n para tu mascota y recepci&oacute;n confirmar&aacute; el horario por tel&eacute;fono o WhatsApp.</p>
      </div>
      <div class="hero-media">
        <img class="hero-doctor-dog" :src="doctorDog" alt="Perro con bata de doctor representando atencion veterinaria">
      </div>
    </header>

    <main class="public-grid">
      <section id="solicitar-cita" class="glass-card appointment-request-card">
        <div class="section-title">
          <div>
            <span class="badge">Nueva cita</span>
            <h2>Solicitar atenci&oacute;n</h2>
          </div>
        </div>
        <p class="muted-text">No necesitas una cuenta para pedir una cita. Solo deja tus datos y te contactaremos.</p>
        <form class="form-grid" @submit.prevent="submit">
          <input v-model="form.fullName" required placeholder="Nombre del dueño">
          <input v-model="form.phone" required placeholder="Tel&eacute;fono / WhatsApp">
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
          <textarea v-model="form.reason" required placeholder="Cu&eacute;ntanos qu&eacute; le pasa o qu&eacute; servicio necesitas"></textarea>
          <button>Enviar solicitud</button>
        </form>
        <p v-if="sent" class="success">Solicitud recibida. Recepci&oacute;n revisar&aacute; la agenda y te confirmar&aacute; pronto.</p>
      </section>

      <section class="glass-card portal-card">
        <span class="badge">Clientes registrados</span>
        <h2>Ya tengo cuenta</h2>
        <p>Entra a tu portal para revisar tus mascotas, citas, fotos y carnet.</p>
        <button class="secondary" @click="$router.push('/cliente/login')">Abrir portal</button>
      </section>
    </main>

    <section class="service-strip">
      <article class="service-pill glass-card">
        <strong>Confirmaci&oacute;n clara</strong>
        <span>Recepci&oacute;n valida cada cita antes de atender.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Historial organizado</strong>
        <span>El doctor revisa antecedentes y registra la atenci&oacute;n.</span>
      </article>
      <article class="service-pill glass-card">
        <strong>Carnet para mascotas</strong>
        <span>Los datos y fotos ayudan a generar el carnet impreso.</span>
      </article>
    </section>

    <section class="location-card glass-card">
      <div class="section-title">
        <div>
          <span class="badge">Ubicaci&oacute;n y contacto</span>
          <h2>Vis&iacute;tanos o escr&iacute;benos por WhatsApp</h2>
        </div>
      </div>
      <img :src="happyDogLocation" alt="Mapa y datos de contacto de Happy Dog">
      <div class="contact-grid">
        <a class="contact-tile" :href="whatsappUrl" target="_blank" rel="noreferrer">
          <span>WhatsApp directo</span>
          <strong>953 280 579</strong>
        </a>
        <a class="contact-tile" href="tel:901969153">
          <span>Tel&eacute;fono alterno</span>
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
