<script setup>
import { ref } from 'vue';
import { api } from '../../services/api';
import doctorDog from '../../assets/images/happy-dog-doctor-teal.webp';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';
import happyDogLocation from '../../assets/images/happy-dog-location.jpeg';

const facebookUrl = 'https://www.facebook.com/share/1DARyzQs2j/';
const whatsappUrl = 'https://wa.me/51953280579';
const form = ref({
  fullName: '',
  phone: '',
  email: '',
  petName: '',
  species: 'No especificada',
  breed: '',
  sex: 'UNKNOWN',
  age: '',
  weightKg: '',
  reason: '',
  scheduledAt: '',
});
const sent = ref(false);
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  sent.value = false;
  const phone = String(form.value.phone || '').replace(/\D+/g, '');

  if (phone.length < 7) {
    error.value = 'Ingresa un WhatsApp valido para poder confirmarte la cita.';
    return;
  }

  if (!form.value.scheduledAt) {
    error.value = 'Selecciona fecha y hora para la cita.';
    return;
  }

  loading.value = true;
  try {
    await api.post('/public/appointment-request', {
      ...form.value,
      fullName: form.value.fullName.trim(),
      phone,
      petName: form.value.petName.trim(),
      reason: form.value.reason.trim(),
      species: form.value.species || 'No especificada',
      sex: form.value.sex || 'UNKNOWN',
    });
    sent.value = true;
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo enviar la solicitud. Revisa los datos e intenta nuevamente.';
  } finally {
    loading.value = false;
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
        <p class="muted-text">D&eacute;janos tus datos y te confirmamos la cita por WhatsApp.</p>
        <form class="form-grid quick-request-form" @submit.prevent="submit">
          <input v-model="form.fullName" required placeholder="Nombre del due&ntilde;o">
          <input v-model="form.phone" required inputmode="tel" autocomplete="tel" placeholder="WhatsApp" @input="form.phone = form.phone.replace(/\s+/g, '')">
          <input v-model="form.petName" required placeholder="Nombre de la mascota">
          <input v-model="form.scheduledAt" type="datetime-local" required>
          <textarea v-model="form.reason" required placeholder="Motivo de la visita"></textarea>
          <button :disabled="loading">{{ loading ? 'Enviando...' : 'Enviar y esperar confirmaci&oacute;n' }}</button>
        </form>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="sent" class="success">Solicitud recibida. Recepci&oacute;n revisar&aacute; la agenda y te confirmar&aacute; pronto.</p>
      </section>

      <section class="glass-card portal-card pet-benefit-card">
        <span class="badge">Beneficio Happy Dog</span>
        <h2>Tu mascota con ficha y carnet</h2>
        <p>Reg&iacute;strate para acceder a sus datos, fotos, citas e historial. Adem&aacute;s, te entregamos su carnet personalizado.</p>
        <button class="secondary" @click="$router.push('/cliente/login')">Entrar o registrarme</button>
      </section>
    </main>

    <section class="location-card glass-card">
      <div class="section-title">
        <div>
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
