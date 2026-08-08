<script setup>
import { computed, onMounted, ref } from 'vue';
import { api } from '../../services/api';
import doctorDog from '../../assets/images/happy-dog-doctor-teal.webp';
import happyDogLogo from '../../assets/images/happy-dog-logo.jpeg';
import happyDogLocation from '../../assets/images/happy-dog-location.jpeg';
import { serviceDisplayLabel } from '../../utils/serviceDisplay';

const facebookUrl = 'https://www.facebook.com/share/1DARyzQs2j/';
const whatsappUrl = 'https://wa.me/51953280579';
function defaultRequestForm() {
  return {
  fullName: '',
  phone: '',
  email: '',
  petName: '',
  species: 'No especificada',
  breed: '',
  sex: 'UNKNOWN',
  age: '',
  weightKg: '',
  serviceCategory: '',
  serviceId: '',
  reason: '',
  scheduledAt: '',
  };
}

const form = ref(defaultRequestForm());
const services = ref([]);
const sent = ref(false);
const sentSummary = ref(null);
const error = ref('');
const loading = ref(false);
const loadingSlow = ref(false);
let loadingSlowTimer;
const serviceCategories = computed(() => [...new Set(services.value.map(service => service.category || 'Otros'))].sort());
const availableServices = computed(() => services.value.filter(service => (service.category || 'Otros') === form.value.serviceCategory));
const selectedService = computed(() => services.value.find(service => service.id === form.value.serviceId));

function servicePriceLabel(service) {
  if (!service) return '';
  if (service.priceLabel) return service.priceLabel;
  if (service.requiresQuote) return 'Precio por confirmar';
  const minimum = Number(service.price || 0);
  const maximum = service.maxPrice == null ? null : Number(service.maxPrice);
  return maximum && maximum !== minimum ? `S/ ${minimum.toFixed(2)} - S/ ${maximum.toFixed(2)}` : `S/ ${minimum.toFixed(2)}`;
}

function serviceOptionLabel(service) {
  return `${serviceDisplayLabel(service)} — ${servicePriceLabel(service)}`;
}

function formatRequestedDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Lima',
  }).format(new Date(`${value}T12:00:00-05:00`));
}

async function loadServices() {
  try {
    const response = await api.get('/public/services');
    services.value = response.data;
  } catch {
    error.value = 'No se pudo cargar el tarifario. Intenta nuevamente en unos segundos.';
  }
}

onMounted(loadServices);

async function submit() {
  error.value = '';
  sent.value = false;
  const phone = String(form.value.phone || '').replace(/\D+/g, '');

  if (phone.length < 7) {
    error.value = 'Ingresa un WhatsApp válido para poder confirmarte la cita.';
    return;
  }

  if (!form.value.scheduledAt) {
    error.value = 'Selecciona el día que prefieres para la cita.';
    return;
  }

  if (!selectedService.value) {
    error.value = 'Selecciona la atención que necesita tu mascota.';
    return;
  }

  loading.value = true;
  loadingSlow.value = false;
  loadingSlowTimer = window.setTimeout(() => {
    loadingSlow.value = true;
  }, 2500);
  try {
    const requestSummary = {
      petName: form.value.petName.trim(),
      scheduledAt: formatRequestedDate(form.value.scheduledAt),
    };
    await api.post('/public/appointment-request', {
      ...form.value,
      scheduledAt: new Date(`${form.value.scheduledAt}T12:00:00-05:00`).toISOString(),
      fullName: form.value.fullName.trim(),
      phone,
      petName: form.value.petName.trim(),
      serviceId: selectedService.value.id,
      reason: `CLIENT_DATE_REQUEST::${[serviceDisplayLabel(selectedService.value), form.value.reason.trim()].filter(Boolean).join(' · ')}`,
      species: form.value.species || 'No especificada',
      sex: form.value.sex || 'UNKNOWN',
    });
    sentSummary.value = requestSummary;
    form.value = defaultRequestForm();
    sent.value = true;
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo enviar la solicitud. Revisa los datos e intenta nuevamente.';
  } finally {
    window.clearTimeout(loadingSlowTimer);
    loadingSlow.value = false;
    loading.value = false;
  }
}

function startAnotherRequest() {
  sent.value = false;
  sentSummary.value = null;
  error.value = '';
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
        <div class="hero-microcopy" aria-label="Beneficios principales">
          <span>Confirmaci&oacute;n por WhatsApp</span>
          <span>Carnet personalizado</span>
          <span>Atenci&oacute;n en Cayma</span>
        </div>
      </div>
      <div class="hero-media">
        <div class="living-dog-frame">
          <img class="hero-doctor-dog" :src="doctorDog" alt="Perrito con bata de doctor representando atencion veterinaria">
        </div>
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
        <form v-if="!sent" class="form-grid quick-request-form" @submit.prevent="submit">
          <input v-model="form.fullName" required placeholder="Nombre del due&ntilde;o">
          <input v-model="form.phone" required inputmode="numeric" autocomplete="tel" placeholder="WhatsApp" @input="form.phone = form.phone.replace(/\D+/g, '')">
          <input v-model="form.petName" required placeholder="Nombre de la mascota">
          <label>Día preferido
            <input v-model="form.scheduledAt" type="date" required>
            <small>Recepción te confirmará la hora disponible por WhatsApp.</small>
          </label>
          <label>¿Qué atención necesita?
            <select v-model="form.serviceCategory" required @change="form.serviceId = ''">
              <option value="">Selecciona una categoría</option>
              <option v-for="category in serviceCategories" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label>Servicio y condición
            <select v-model="form.serviceId" required :disabled="!form.serviceCategory">
              <option value="">Selecciona una opción</option>
              <option v-for="service in availableServices" :key="service.id" :value="service.id">{{ serviceOptionLabel(service) }}</option>
            </select>
            <small v-if="selectedService">{{ servicePriceLabel(selectedService) }}</small>
          </label>
          <textarea v-model="form.reason" placeholder="Detalle adicional (opcional)"></textarea>
          <button :disabled="loading">{{ loading ? 'Enviando...' : 'Enviar y esperar confirmaci&oacute;n' }}</button>
          <small v-if="loadingSlow" class="request-wait-note">El servidor está iniciando. Conservaremos tus datos y enviaremos la solicitud apenas responda.</small>
        </form>
        <p v-if="error" class="error">{{ error }}</p>
        <div v-if="sent" class="request-success" role="status">
          <strong>Solicitud recibida</strong>
          <p>Recepci&oacute;n revisar&aacute; la agenda de {{ sentSummary?.petName }} para el {{ sentSummary?.scheduledAt }} y te confirmar&aacute; por WhatsApp.</p>
          <button type="button" class="secondary" @click="startAnotherRequest">Solicitar otra cita</button>
        </div>
      </section>

      <section class="glass-card portal-card pet-benefit-card">
        <span class="badge">Beneficio Happy Dog</span>
        <h2>Tu mascota con ficha y carnet</h2>
        <p>Reg&iacute;strate para acceder a sus datos, fotos, citas e historial. Adem&aacute;s, te entregamos su carnet personalizado.</p>
        <div class="portal-benefits">
          <span>Foto para carnet</span>
          <span>Historial de visitas</span>
          <span>Citas ordenadas</span>
        </div>
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
