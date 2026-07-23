<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import ReceptionLayout from '../../layouts/ReceptionLayout.vue';
import { api } from '../../services/api';

const route = useRoute();
const router = useRouter();
const receptionTabs = ['citas', 'clientes', 'carnets'];

function tabFromRoute() {
  const tab = String(route.query.tab || '');
  return receptionTabs.includes(tab) ? tab : 'citas';
}

const appointments = ref([]);
const clients = ref([]);
const users = ref([]);
const services = ref([]);
const summary = ref({});
const active = ref(tabFromRoute());
const showQuick = ref(false);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const success = ref('');
const search = ref('');
const quickMode = ref('new');
const agendaView = ref('day');
const cardFilter = ref('ready');
const cardSearch = ref('');
const cardVisibleLimit = ref(25);
const selectedCardPetIds = ref([]);
const selectedAppointment = ref(null);
const duplicateOverride = ref(false);
const reschedulingPastAppointment = ref(false);
const hours = Array.from({ length: 11 }, (_, i) => i + 8);

function dateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toIsoDateTime(value) {
  if (!value) return '';
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}-05:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

const selectedDate = ref(dateKey());
const quick = ref({
  serviceType: 'MEDICAL',
  serviceCategory: '', serviceId: '', quotedPrice: '', priceNote: '', durationMinutes: 30,
  clientId: '',
  petId: '',
  fullName: '',
  phone: '',
  email: '',
  petName: '',
  species: '',
  breed: '',
  sex: 'UNKNOWN',
  age: '',
  weightKg: '',
  scheduledAt: '',
  pickupAt: '',
  reason: '',
});
const serviceCategories = computed(() => [...new Set(services.value.filter(item => item.active !== false).map(item => item.category || 'Otros'))].sort());
const availableServices = computed(() => services.value.filter(item => item.active !== false && (item.category || 'Otros') === quick.value.serviceCategory));
const selectedService = computed(() => services.value.find(item => item.id === quick.value.serviceId));

watch(() => quick.value.serviceId, () => {
  const service = selectedService.value;
  if (!service) return;
  quick.value.reason = [service.name, service.condition].filter(Boolean).join(' - ');
  quick.value.quotedPrice = Number(service.price || 0);
  quick.value.priceNote = service.priceLabel || '';
  quick.value.durationMinutes = Number(service.durationMinutes || 30);
  const category = String(service.category || '').toUpperCase();
  quick.value.serviceType = category.includes('PELUQU') || category.includes('BAÑO') ? 'GROOMING' : category.includes('CIRUG') ? 'SURGERY' : category.includes('VACUN') || category.includes('DESPAR') ? 'VACCINE' : 'MEDICAL';
});

const searchedAppointments = computed(() => appointments.value.filter(item => {
  if (!item.scheduledAt) return false;
  const text = `${item.client?.fullName || ''} ${item.client?.phone || ''} ${item.pet?.name || ''} ${item.reason || ''}`.toLowerCase();
  return text.includes(search.value.toLowerCase());
}));

const dayAppointments = computed(() => searchedAppointments.value.filter(item => {
  return dateKey(item.scheduledAt) === selectedDate.value;
}));

const weekDays = computed(() => {
  const base = new Date(`${selectedDate.value}T00:00:00`);
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(base);
  start.setDate(base.getDate() + mondayOffset);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    const items = searchedAppointments.value
      .filter(item => dateKey(item.scheduledAt) === key)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    return {
      key,
      label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(date),
      day: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short' }).format(date),
      items,
    };
  });
});

const upcomingAppointments = computed(() => {
  const now = new Date();
  return searchedAppointments.value
    .filter(item => new Date(item.scheduledAt) >= now && !['ATTENDED', 'NO_SHOW', 'CANCELLED'].includes(item.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 12);
});

const acceptedAppointments = computed(() => {
  const now = new Date();
  return searchedAppointments.value
    .filter(item => new Date(item.scheduledAt) >= now && ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'].includes(item.status))
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 8);
});

const filteredClients = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (query.length < 2) return [];

  return clients.value.filter(client => {
    const text = `${client.fullName || ''} ${client.phone || ''} ${client.email || ''} ${client.pets?.map(p => p.name).join(' ') || ''}`.toLowerCase();
    return text.includes(query);
  }).slice(0, 20);
});

const selectedClientPets = computed(() => clients.value.find(client => client.id === quick.value.clientId)?.pets || []);

const allPets = computed(() => clients.value.flatMap(client => (client.pets || []).map(pet => ({ ...pet, client }))));
const cardStats = computed(() => {
  const pets = allPets.value;
  return {
    pending: pets.filter(pet => pet.cardStatus !== 'PRINTED').length,
    ready: pets.filter(pet => pet.cardStatus !== 'PRINTED' && pet.photoUrl).length,
    missingPhoto: pets.filter(pet => pet.cardStatus !== 'PRINTED' && !pet.photoUrl).length,
    printed: pets.filter(pet => pet.cardStatus === 'PRINTED').length,
    reprint: pets.filter(pet => pet.cardStatus === 'REPRINT_REQUESTED').length,
    recentUploads: pets.filter(pet => pet.photoUrl && pet.cardStatus !== 'PRINTED').length,
  };
});

const filteredCardPets = computed(() => {
  const query = cardSearch.value.trim().toLowerCase();
  const statusWeight = {
    REPRINT_REQUESTED: 0,
    PENDING: 1,
    PRINTED: 4,
  };

  return allPets.value.filter(pet => {
    const text = `${pet.name || ''} ${pet.species || ''} ${pet.breed || ''} ${pet.client?.fullName || ''} ${pet.client?.phone || ''} ${pet.client?.email || ''}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (cardFilter.value === 'pending') return pet.cardStatus !== 'PRINTED';
    if (cardFilter.value === 'ready') return pet.cardStatus !== 'PRINTED' && Boolean(pet.photoUrl);
    if (cardFilter.value === 'missingPhoto') return pet.cardStatus !== 'PRINTED' && !pet.photoUrl;
    if (cardFilter.value === 'printed') return pet.cardStatus === 'PRINTED';
    if (cardFilter.value === 'reprint') return pet.cardStatus === 'REPRINT_REQUESTED';
    return true;
  }).sort((a, b) => {
    const aWeight = statusWeight[a.cardStatus || 'PENDING'] ?? 2;
    const bWeight = statusWeight[b.cardStatus || 'PENDING'] ?? 2;
    if (aWeight !== bWeight) return aWeight - bWeight;

    const aDate = new Date(a.updatedAt || a.cardLastGeneratedAt || a.cardPrintedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.cardLastGeneratedAt || b.cardPrintedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });
});

const visibleCardPets = computed(() => filteredCardPets.value.slice(0, cardVisibleLimit.value));
const selectedCardPets = computed(() => allPets.value.filter(pet => selectedCardPetIds.value.includes(pet.id)));

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function sameDay(a, b) {
  if (!a || !b) return false;
  return dateKey(a) === dateKey(b);
}

const possibleDuplicateAppointments = computed(() => {
  if (!quick.value.scheduledAt) return [];

  const phone = onlyDigits(quick.value.phone);
  const email = normalizeText(quick.value.email);
  const fullName = normalizeText(quick.value.fullName);
  const petName = normalizeText(quick.value.petName);

  return appointments.value.filter(item => {
    if (['ATTENDED', 'NO_SHOW', 'CANCELLED'].includes(item.status)) return false;
    if (!sameDay(item.scheduledAt, quick.value.scheduledAt)) return false;

    if (quickMode.value === 'existing') {
      return item.clientId === quick.value.clientId || item.petId === quick.value.petId;
    }

    const itemPhone = onlyDigits(item.client?.phone);
    const itemEmail = normalizeText(item.client?.email);
    const itemClientName = normalizeText(item.client?.fullName);
    const itemPetName = normalizeText(item.pet?.name);

    const sameContact = (phone && itemPhone && phone === itemPhone) || (email && itemEmail && email === itemEmail);
    const sameNames = fullName && petName && itemClientName === fullName && itemPetName === petName;
    return sameContact || sameNames;
  }).slice(0, 3);
});

function formatTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', weekday: 'short', day: '2-digit', month: 'short' }).format(new Date(value));
}

function moveDay(days) {
  const date = new Date(`${selectedDate.value}T00:00:00`);
  date.setDate(date.getDate() + days);
  selectedDate.value = dateKey(date);
}

function setToday() {
  selectedDate.value = dateKey();
  agendaView.value = 'day';
}

function getAppointmentById(id) {
  return appointments.value.find(item => item.id === id);
}

function normalizeAppointmentUpdate(payload, fallback, nextStatus) {
  const source = payload?.appointment || payload?.data || payload || {};
  return {
    ...fallback,
    ...source,
    id: source.id || fallback.id,
    status: source.status || nextStatus,
    pet: source.pet || fallback.pet,
    client: source.client || fallback.client,
  };
}

function patchAppointmentInMemory(updated) {
  appointments.value = appointments.value.map(item => (
    item.id === updated.id ? { ...item, ...updated } : item
  ));
}

function selectAppointment(appointment) {
  const current = getAppointmentById(appointment.id);
  selectedAppointment.value = current ? { ...current } : { ...appointment };
}

function hourAppointments(hour) {
  return dayAppointments.value.filter(item => new Date(item.scheduledAt).getHours() === hour);
}

function statusLabel(status) {
  const labels = {
    PENDING: 'Pendiente',
    CONFIRMED: 'Confirmada',
    WAITING: 'En espera',
    IN_CONSULTATION: 'En consulta',
    ATTENDED: 'Atendida',
    NO_SHOW: 'No asistió',
    CANCELLED: 'Cancelada',
  };
  return labels[status] || status;
}

function appointmentType(appointment) {
  const text = `${appointment?.notes || ''} ${appointment?.service?.category || ''} ${appointment?.service?.name || ''} ${appointment?.reason || ''}`.toLowerCase();
  if (text.includes('service_type:grooming') || ['baño', 'bano', 'corte', 'grooming', 'peluquer'].some(word => text.includes(word))) return 'GROOMING';
  if (text.includes('service_type:vaccine') || text.includes('vacun') || text.includes('desparasit')) return 'VACCINE';
  if (text.includes('service_type:surgery') || ['cirug', 'esteriliz', 'castr'].some(word => text.includes(word))) return 'SURGERY';
  return 'MEDICAL';
}

function isGroomingAppointment(appointment) {
  return appointmentType(appointment) === 'GROOMING';
}

function appointmentStatusLabel(appointment) {
  if (appointment?.notes?.includes('OUTCOME:NO_SHOW')) return 'No asistió';
  if (isGroomingAppointment(appointment) && appointment?.status === 'IN_CONSULTATION') return 'En servicio';
  if (isGroomingAppointment(appointment) && appointment?.status === 'ATTENDED') return 'Completada';
  return statusLabel(appointment?.status);
}

function isPastAppointment(appointment) {
  return Boolean(appointment?.scheduledAt) && dateKey(appointment.scheduledAt) < dateKey();
}

function isFutureAppointment(appointment) {
  return Boolean(appointment?.scheduledAt) && dateKey(appointment.scheduledAt) > dateKey();
}

function appointmentTimeHasPassed(appointment) {
  return Boolean(appointment?.scheduledAt) && new Date(appointment.scheduledAt) < new Date();
}

function createFollowUpFromPastAppointment() {
  if (!selectedAppointment.value) return;
  const appointment = selectedAppointment.value;
  quick.value.serviceType = appointmentType(appointment);
  quickMode.value = 'existing';
  quick.value.clientId = appointment.clientId || appointment.client?.id || '';
  quick.value.petId = appointment.petId || appointment.pet?.id || '';
  quick.value.scheduledAt = '';
  quick.value.reason = appointment.reason ? `Control: ${appointment.reason}` : 'Control';
  selectedDate.value = dateKey();
  agendaView.value = 'day';
  selectedAppointment.value = null;
  reschedulingPastAppointment.value = true;
  showQuick.value = true;
}

async function markNoShow(appointment) {
  error.value = '';
  success.value = '';
  try {
    const { data } = await api.patch(`/appointments/${appointment.id}`, { status: 'NO_SHOW' });
    appointments.value = appointments.value.map(item => item.id === appointment.id ? data : item);
    selectedAppointment.value = data;
    success.value = 'La cita fue cerrada como no asistió.';
  } catch (e) {
    error.value = 'No se pudo cerrar la cita como no asistió.';
  }
}

function cardStatusLabel(status) {
  const labels = {
    PENDING: 'Pendiente',
    PRINTED: 'Impresa',
    REPRINT_REQUESTED: 'Reimpresión',
  };
  return labels[status] || 'Pendiente';
}

function cardActivityLabel(pet) {
  if (pet.cardStatus === 'PRINTED') return `Entregado: ${formatDateTime(pet.cardPrintedAt)}`;
  if (pet.cardStatus === 'REPRINT_REQUESTED') return `Reimpresión solicitada: ${formatDateTime(pet.updatedAt || pet.createdAt)}`;
  if (pet.photoUrl) return `Foto lista: ${formatDateTime(pet.updatedAt || pet.createdAt)}`;
  return `Registrado: ${formatDateTime(pet.createdAt || pet.updatedAt)}`;
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function toggleCardPet(petId, checked) {
  if (checked) {
    if (!selectedCardPetIds.value.includes(petId)) selectedCardPetIds.value = [...selectedCardPetIds.value, petId];
    return;
  }
  selectedCardPetIds.value = selectedCardPetIds.value.filter(id => id !== petId);
}

function selectVisibleCardPets() {
  selectedCardPetIds.value = visibleCardPets.value.map(pet => pet.id);
}

function clearSelectedCardPets() {
  selectedCardPetIds.value = [];
}

function setActive(tab, syncUrl = true) {
  if (!receptionTabs.includes(tab)) return;
  active.value = tab;
  error.value = '';
  success.value = '';
  search.value = '';
  cardSearch.value = '';
  cardVisibleLimit.value = 25;

  if (!syncUrl) return;

  const nextQuery = { ...route.query };
  if (tab === 'citas') {
    delete nextQuery.tab;
  } else {
    nextQuery.tab = tab;
  }

  const currentTab = String(route.query.tab || 'citas');
  if (currentTab !== tab) {
    router.replace({ query: nextQuery });
  }
}

watch(() => route.query.tab, () => {
  setActive(tabFromRoute(), false);
});

function setCardFilter(filter) {
  cardFilter.value = filter;
  cardVisibleLimit.value = 25;
  selectedCardPetIds.value = [];
}

function showMoreCardPets() {
  cardVisibleLimit.value += 25;
}

async function loadData() {
  loading.value = true;
  error.value = '';
  try {
    const [appointmentsRes, clientsRes, usersRes, summaryRes, servicesRes] = await Promise.all([
      api.get('/appointments'),
      api.get('/clients'),
      api.get('/users'),
      api.get('/reports/summary'),
      api.get('/services'),
    ]);
    appointments.value = appointmentsRes.data;
    clients.value = clientsRes.data;
    users.value = usersRes.data;
    summary.value = summaryRes.data;
    services.value = servicesRes.data;
  } catch (e) {
    error.value = 'No se pudo cargar la información de recepción.';
  } finally {
    loading.value = false;
  }
}

async function setStatus(appointment, status) {
  error.value = '';
  success.value = '';

  const optimistic = normalizeAppointmentUpdate(null, appointment, status);
  patchAppointmentInMemory(optimistic);
  if (selectedAppointment.value?.id === appointment.id) {
    selectedAppointment.value = { ...optimistic };
  }

  try {
    const { data } = await api.patch(`/appointments/${appointment.id}`, { status });
    const updated = normalizeAppointmentUpdate(data, optimistic, status);
    patchAppointmentInMemory(updated);
    await loadData();
    const refreshed = getAppointmentById(appointment.id) || updated;
    if (selectedAppointment.value?.id === appointment.id) {
      selectedAppointment.value = { ...refreshed };
    }
    success.value = status === 'CONFIRMED'
      ? 'Cita confirmada correctamente.'
      : 'Cita actualizada correctamente.';
  } catch (e) {
    await loadData();
    const restored = getAppointmentById(appointment.id) || appointment;
    if (selectedAppointment.value?.id === appointment.id) {
      selectedAppointment.value = { ...restored };
    }
    error.value = 'No se pudo actualizar la cita.';
  }
}

async function generatePetIdCard(petId) {
  if (!petId) return;
  error.value = '';
  success.value = '';
  const pet = allPets.value.find(item => item.id === petId);
  if (pet?.cardStatus === 'PRINTED' && !window.confirm(`${pet.name} ya tiene carnet marcado como impreso. ¿Generar una reimpresion?`)) {
    return;
  }
  try {
    const { data } = await api.get(`/pets/${petId}/id-card`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const opened = window.open(url, '_blank');
    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.download = `carnet-mascota-${petId}.pdf`;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    success.value = 'Carnet de mascota generado en PDF.';
    await loadData();
  } catch (e) {
    error.value = 'No se pudo generar el carnet de la mascota.';
  }
}

async function generatePetIdCardsBatch() {
  if (!selectedCardPetIds.value.length) {
    error.value = 'Selecciona al menos una mascota para generar el lote.';
    return;
  }

  const printedPets = selectedCardPets.value.filter(pet => pet.cardStatus === 'PRINTED');
  if (printedPets.length && !window.confirm(`${printedPets.length} carnet(s) ya figuran como impresos. ¿Generar reimpresion de todos modos?`)) {
    return;
  }

  error.value = '';
  success.value = '';
  try {
    const { data } = await api.post('/pets/id-cards-batch', { petIds: selectedCardPetIds.value }, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
    const opened = window.open(url, '_blank');
    if (!opened) {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'carnets-happy-dog.pdf';
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    success.value = `PDF generado con ${selectedCardPetIds.value.length} carnet(s).`;
    await loadData();
  } catch (e) {
    error.value = 'No se pudo generar el lote de carnets.';
  }
}

async function markSelectedCardsPrinted() {
  if (!selectedCardPetIds.value.length) {
    error.value = 'Selecciona al menos una mascota para marcar como impresa.';
    return;
  }
  if (!window.confirm(`Vas a marcar ${selectedCardPetIds.value.length} carnet(s) como impresos. ¿Confirmas?`)) return;

  error.value = '';
  success.value = '';
  try {
    await api.post('/pets/mark-cards-printed', { petIds: selectedCardPetIds.value });
    success.value = 'Carnets marcados como impresos.';
    selectedCardPetIds.value = [];
    await loadData();
  } catch (e) {
    error.value = 'No se pudo marcar los carnets como impresos.';
  }
}

async function requestCardReprint(pet) {
  if (!pet?.id) return;

  const petName = pet.name || 'Esta mascota';
  const message = `${petName} ya figura como carnet entregado. ¿Quieres moverlo a Reimpresiones para generar otro carnet?`;
  if (!window.confirm(message)) return;

  error.value = '';
  success.value = '';
  try {
    await api.post(`/pets/${pet.id}/request-card-reprint`);
    success.value = `${petName} pasó a Reimpresiones.`;
    selectedCardPetIds.value = [];
    cardVisibleLimit.value = 25;
    cardFilter.value = 'reprint';
    await loadData();
  } catch (e) {
    error.value = 'No se pudo solicitar la reimpresión.';
  }
}

async function uploadPetPhoto(petId, event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  error.value = '';
  success.value = '';

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    error.value = 'Sube una foto en formato JPG o PNG para que salga en el carnet.';
    return;
  }

  if (file.size > 4 * 1024 * 1024) {
    error.value = 'La foto no debe pesar mas de 4 MB.';
    return;
  }

  try {
    const formData = new FormData();
    formData.append('photo', file);
    await api.post(`/pets/${petId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    success.value = 'Foto de mascota actualizada. El carnet usara esta imagen.';
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo subir la foto de la mascota.';
  }
}

function resetQuick() {
  quick.value = { serviceType: 'MEDICAL', serviceCategory: '', serviceId: '', quotedPrice: '', priceNote: '', durationMinutes: 30, clientId: '', petId: '', fullName: '', phone: '', email: '', petName: '', species: '', breed: '', sex: 'UNKNOWN', age: '', weightKg: '', scheduledAt: '', pickupAt: '', reason: '' };
  duplicateOverride.value = false;
  reschedulingPastAppointment.value = false;
}

function useExistingAppointment(appointment) {
  selectAppointment(appointment);
  selectedDate.value = dateKey(appointment.scheduledAt);
  agendaView.value = 'day';
  showQuick.value = false;
  success.value = 'Se abrió la cita existente para evitar duplicarla.';
}

async function saveIgnoringDuplicate() {
  duplicateOverride.value = true;
  await saveQuickAppointment();
}

async function saveQuickAppointment() {
  saving.value = true;
  error.value = '';
  success.value = '';
  try {
    if (!duplicateOverride.value && possibleDuplicateAppointments.value.length) {
      selectedAppointment.value = possibleDuplicateAppointments.value[0];
      error.value = 'Ya existe una cita parecida para ese cliente o mascota en la misma fecha. Revisa la cita existente o crea la nueva solo si realmente corresponde.';
      return;
    }

    let clientId = quick.value.clientId;
    let petId = quick.value.petId;

    if (quickMode.value === 'new') {
      const { data: client } = await api.post('/clients', {
        fullName: quick.value.fullName,
        phone: quick.value.phone,
        email: quick.value.email || undefined,
      });
      const { data: pet } = await api.post('/pets', {
        name: quick.value.petName,
        species: quick.value.species,
        breed: quick.value.breed || undefined,
        sex: quick.value.sex || 'UNKNOWN',
        age: quick.value.age || undefined,
        weightKg: quick.value.weightKg === '' ? undefined : Number(quick.value.weightKg),
        clientId: client.id,
      });
      clientId = client.id;
      petId = pet.id;
    }

    await api.post('/appointments', {
      clientId,
      petId,
      scheduledAt: toIsoDateTime(quick.value.scheduledAt),
      pickupAt: quick.value.serviceType === 'GROOMING' && quick.value.pickupAt ? toIsoDateTime(quick.value.pickupAt) : undefined,
      serviceId: quick.value.serviceId || undefined,
      quotedPrice: quick.value.quotedPrice === '' ? undefined : Number(quick.value.quotedPrice),
      priceNote: quick.value.priceNote || undefined,
      durationMinutes: Number(quick.value.durationMinutes || 30),
      reason: quick.value.reason.trim(),
      notes: `SERVICE_TYPE:${quick.value.serviceType}`,
    });
    success.value = 'Cita creada desde recepción correctamente.';
    resetQuick();
    showQuick.value = false;
    await loadData();
  } catch (e) {
    error.value = e.response?.data?.message || 'No se pudo agendar desde recepción.';
  } finally {
    saving.value = false;
    duplicateOverride.value = false;
  }
}

onMounted(loadData);
</script>

<template>
  <ReceptionLayout title="Recepción" subtitle="Agenda, citas por llamada y coordinación diaria" hide-user-pill>
    <template #nav>
      <button @click="setActive('citas')">Citas</button>
      <button @click="setActive('clientes')">Clientes</button>
      <button @click="setActive('carnets')">Carnets</button>
      <button @click="$router.push('/recepcion/cuenta')">Mi cuenta</button>
    </template>

    <template #top-actions>
      <button
        class="secondary top-action-button"
        type="button"
        aria-label="Abrir el panel administrativo"
        @click="$router.push('/admin')"
      >
        Panel administrativo
      </button>
    </template>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>

    <div v-if="active==='citas'" class="reception-grid">
      <section class="glass-card calendar-card">
        <div class="calendar-header">
          <div>
            <span class="badge">Agenda</span>
            <h2>Calendario de citas</h2>
            <p class="muted-text">Opera el dia y revisa lo que viene sin perder citas futuras.</p>
          </div>
          <div class="date-controls">
            <button class="small secondary" type="button" @click="setToday">Hoy</button>
            <button class="small secondary" type="button" @click="moveDay(-1)">Anterior</button>
            <input v-model="selectedDate" type="date">
            <button class="small secondary" type="button" @click="moveDay(1)">Siguiente</button>
          </div>
        </div>

        <div class="segmented agenda-tabs">
          <button type="button" :class="{active:agendaView==='day'}" @click="agendaView='day'">Día</button>
          <button type="button" :class="{active:agendaView==='week'}" @click="agendaView='week'">Semana</button>
          <button type="button" :class="{active:agendaView==='upcoming'}" @click="agendaView='upcoming'">Próximas</button>
        </div>

        <input v-model="search" class="search-field" placeholder="Buscar por cliente, teléfono, mascota o motivo">

        <p v-if="loading" class="muted-text">Cargando agenda...</p>
        <div v-else-if="agendaView==='day'" class="day-calendar">
          <div v-for="hour in hours" :key="hour" class="calendar-row">
            <div class="calendar-time">{{ String(hour).padStart(2, '0') }}:00</div>
            <div class="calendar-slot">
              <article v-for="item in hourAppointments(hour)" :key="item.id" class="calendar-event" :data-status="item.status" @click="selectAppointment(item)">
                <div>
                  <strong>{{ formatTime(item.scheduledAt) }} - {{ item.pet?.name || 'Mascota' }}</strong>
                  <span>{{ item.client?.fullName || 'Cliente' }} · {{ item.reason }}</span>
                </div>
                <div class="event-actions">
                  <span class="status">{{ appointmentStatusLabel(item) }}</span>
                  <button class="small secondary" @click.stop="selectAppointment(item)">Ver</button>
                </div>
              </article>
              <span v-if="!hourAppointments(hour).length" class="empty-slot">Libre</span>
            </div>
          </div>
        </div>

        <div v-else-if="agendaView==='week'" class="week-calendar">
          <article v-for="day in weekDays" :key="day.key" class="week-day" :class="{ today: day.key === selectedDate }">
            <button class="week-day-head" type="button" @click="selectedDate = day.key; agendaView = 'day'">
              <span>{{ day.label }}</span>
              <strong>{{ day.day }}</strong>
              <small>{{ day.items.length }} citas</small>
            </button>
            <div class="week-events">
              <button v-for="item in day.items" :key="item.id" class="week-event" type="button" @click="selectAppointment(item)">
                <strong>{{ formatTime(item.scheduledAt) }} - {{ item.pet?.name || 'Mascota' }}</strong>
                <span>{{ item.client?.fullName || 'Cliente' }}</span>
                <small>{{ appointmentStatusLabel(item) }}</small>
              </button>
              <span v-if="!day.items.length" class="empty-slot">Sin citas</span>
            </div>
          </article>
        </div>

        <div v-else class="upcoming-list">
          <article v-for="item in upcomingAppointments" :key="item.id" class="calendar-event" :data-status="item.status" @click="selectAppointment(item)">
            <div>
              <strong>{{ formatDate(item.scheduledAt) }} - {{ formatTime(item.scheduledAt) }}</strong>
              <span>{{ item.pet?.name || 'Mascota' }} · {{ item.client?.fullName || 'Cliente' }} · {{ item.reason }}</span>
            </div>
            <div class="event-actions">
              <span class="status">{{ appointmentStatusLabel(item) }}</span>
              <button class="small secondary" @click.stop="selectAppointment(item)">Ver</button>
            </div>
          </article>
          <p v-if="!upcomingAppointments.length" class="empty">No hay citas futuras pendientes con este filtro.</p>
        </div>
      </section>

      <section class="glass-card quick-card">
        <div class="section-title">
          <div>
            <span class="badge">Recepción</span>
            <h2>Agendar desde recepción</h2>
          </div>
        </div>
        <p class="muted-text">Para citas que llegan por llamada, WhatsApp o atención presencial.</p>
        <div class="use-cases">
          <span>Cliente nuevo</span>
          <span>Cliente existente</span>
          <span>Sin cuenta web</span>
        </div>
        <button class="full" @click="reschedulingPastAppointment = false; showQuick=!showQuick">{{ showQuick ? 'Ocultar formulario' : '+ Nueva cita por llamada o WhatsApp' }}</button>

        <div v-if="!showQuick" class="detail-box upcoming-summary">
          <span class="badge">Aceptadas</span>
          <h3>{{ acceptedAppointments.length }} {{ acceptedAppointments.length === 1 ? 'cita aceptada' : 'citas aceptadas' }}</h3>
          <button
            v-for="item in acceptedAppointments.slice(0, 4)"
            :key="item.id"
            class="summary-appointment"
            type="button"
            @click="selectAppointment(item); agendaView='upcoming'"
          >
            <strong>{{ formatDate(item.scheduledAt) }} · {{ formatTime(item.scheduledAt) }}</strong>
            <span>{{ item.pet?.name || 'Mascota' }} - {{ appointmentStatusLabel(item) }}</span>
          </button>
          <button v-if="acceptedAppointments.length > 4" class="secondary small full" type="button" @click="agendaView='upcoming'">Ver todas</button>
          <p v-if="!acceptedAppointments.length" class="muted-text">Cuando confirmes una cita, aparecerá aquí como aceptada.</p>
        </div>

        <form v-if="showQuick" class="stack quick-form" @submit.prevent="saveQuickAppointment">
          <div v-if="reschedulingPastAppointment" class="reschedule-notice">
            <strong>Nueva cita después de una inasistencia</strong>
            <span>El registro anterior se conserva. Acuerda con el cliente una nueva fecha y hora.</span>
          </div>
          <label>¿Qué atención necesita?
            <select v-model="quick.serviceCategory" required @change="quick.serviceId=''; quick.quotedPrice=''; quick.reason=''">
              <option value="">Seleccionar categoría</option>
              <option v-for="category in serviceCategories" :key="category" :value="category">{{ category }}</option>
            </select>
          </label>
          <label v-if="quick.serviceCategory">Servicio y condición
            <select v-model="quick.serviceId" required>
              <option value="">Seleccionar opción del tarifario</option>
              <option v-for="service in availableServices" :key="service.id" :value="service.id">{{ service.name }}{{ service.species ? ` · ${service.species}` : '' }}{{ service.condition ? ` · ${service.condition}` : '' }} — {{ service.priceLabel || `S/ ${Number(service.price).toFixed(2)}${service.maxPrice ? ` a S/ ${Number(service.maxPrice).toFixed(2)}` : ''}` }}</option>
            </select>
          </label>
          <label v-if="selectedService">Precio acordado
            <input v-model.number="quick.quotedPrice" type="number" min="0" step="0.01" required>
            <small>{{ selectedService.requiresQuote || selectedService.maxPrice ? 'Confirma el importe dentro del rango antes de guardar.' : 'Precio tomado automáticamente del tarifario.' }}</small>
          </label>
          <label v-if="selectedService">Duración estimada
            <input v-model.number="quick.durationMinutes" type="number" min="5" step="5" required>
            <small>La agenda reservará este tiempo y avisará si existe un cruce.</small>
          </label>
          <div class="segmented">
            <button type="button" :class="{active:quickMode==='new'}" @click="quickMode='new'">Registrar cliente nuevo</button>
            <button type="button" :class="{active:quickMode==='existing'}" @click="quickMode='existing'">Agendar cliente existente</button>
          </div>

          <template v-if="quickMode==='existing'">
            <label>Cliente
              <select v-model="quick.clientId" required @change="quick.petId=''">
                <option value="">Seleccionar cliente</option>
                <option v-for="client in clients" :key="client.id" :value="client.id">{{ client.fullName }} - {{ client.phone || client.email || 'sin contacto' }}</option>
              </select>
            </label>
            <label>Mascota
              <select v-model="quick.petId" required>
                <option value="">Seleccionar mascota</option>
                <option v-for="pet in selectedClientPets" :key="pet.id" :value="pet.id">{{ pet.name }} - {{ pet.species }}</option>
              </select>
            </label>
          </template>

          <template v-else>
            <label>Dueño<input v-model="quick.fullName" required placeholder="Nombre completo"></label>
            <label>Teléfono / WhatsApp<input v-model="quick.phone" required placeholder="999 999 999"></label>
            <label>Correo opcional<input v-model="quick.email" type="email" placeholder="correo@ejemplo.com"></label>
            <label>Mascota<input v-model="quick.petName" required placeholder="Nombre de la mascota"></label>
            <label>Especie<input v-model="quick.species" required placeholder="Perro, gato, conejo"></label>
            <label>Raza<input v-model="quick.breed" placeholder="Raza o cruce"></label>
            <label>Sexo
              <select v-model="quick.sex">
                <option value="UNKNOWN">No especificado</option>
                <option value="MALE">Macho</option>
                <option value="FEMALE">Hembra</option>
              </select>
            </label>
            <label>Edad<input v-model="quick.age" placeholder="Ej. 2 años"></label>
            <label>Peso kg<input v-model.number="quick.weightKg" type="number" min="0" step="0.01" placeholder="Ej. 8.5"></label>
          </template>

          <label>{{ reschedulingPastAppointment ? 'Nueva fecha y hora' : 'Fecha y hora' }}<input v-model="quick.scheduledAt" required type="datetime-local"></label>
          <label v-if="quick.serviceType === 'GROOMING'">Hora estimada de recojo<input v-model="quick.pickupAt" type="datetime-local"><small>Opcional; se puede completar cuando se conozca.</small></label>
          <label>Detalle adicional<textarea v-model="quick.reason" required placeholder="Se completa desde el servicio; puedes añadir un detalle"></textarea></label>
          <div v-if="possibleDuplicateAppointments.length" class="duplicate-alert">
            <strong>Posible cita duplicada</strong>
            <span>Ya hay una cita activa parecida en esa fecha. Revisa antes de crear otra.</span>
            <button
              v-for="item in possibleDuplicateAppointments"
              :key="item.id"
              class="summary-appointment"
              type="button"
              @click="useExistingAppointment(item)"
            >
              <strong>{{ formatDate(item.scheduledAt) }} · {{ formatTime(item.scheduledAt) }}</strong>
              <span>{{ item.pet?.name || 'Mascota' }} - {{ item.client?.fullName || 'Cliente' }} - {{ appointmentStatusLabel(item) }}</span>
            </button>
            <button class="small secondary" type="button" :disabled="saving" @click="saveIgnoringDuplicate">Crear de todos modos</button>
          </div>
          <button :disabled="saving">{{ saving ? 'Guardando...' : quickMode==='new' ? 'Guardar cliente, mascota y cita' : 'Guardar nueva cita' }}</button>
        </form>

        <div v-if="selectedAppointment" class="detail-box">
          <span class="badge">Detalle</span>
          <h3>{{ selectedAppointment.pet?.name || 'Mascota' }}</h3>
          <div v-if="isPastAppointment(selectedAppointment)" class="past-appointment-notice" :class="{ warning: !['ATTENDED','NO_SHOW','CANCELLED'].includes(selectedAppointment.status) }">
            <strong>{{ ['ATTENDED','NO_SHOW','CANCELLED'].includes(selectedAppointment.status) ? 'Cita pasada' : 'Cita pasada sin cierre' }}</strong>
            <span>{{ ['ATTENDED','NO_SHOW','CANCELLED'].includes(selectedAppointment.status) ? 'Este registro es solo de consulta y ya no puede cambiar de estado.' : `Esta cita todavía figura como ${statusLabel(selectedAppointment.status).toLowerCase()}. No se debe crear otra hasta resolver su estado.` }}</span>
          </div>
          <p><b>Cliente:</b> {{ selectedAppointment.client?.fullName || '-' }}</p>
          <p><b>Contacto:</b> {{ selectedAppointment.client?.phone || selectedAppointment.client?.email || '-' }}</p>
          <p><b>Hora:</b> {{ formatTime(selectedAppointment.scheduledAt) }}</p>
          <p v-if="selectedAppointment.pickupAt"><b>Recojo estimado:</b> {{ formatDate(selectedAppointment.pickupAt) }} · {{ formatTime(selectedAppointment.pickupAt) }}</p>
          <p><b>Motivo:</b> {{ selectedAppointment.reason }}</p>
          <p><b>Tipo:</b> {{ isGroomingAppointment(selectedAppointment) ? 'Baño o corte' : appointmentType(selectedAppointment) === 'VACCINE' ? 'Vacuna o desparasitación' : appointmentType(selectedAppointment) === 'SURGERY' ? 'Cirugía' : 'Consulta médica' }}</p>
          <p><b>Estado:</b> {{ appointmentStatusLabel(selectedAppointment) }}</p>
          <div v-if="isFutureAppointment(selectedAppointment) && selectedAppointment.status === 'CONFIRMED'" class="future-appointment-notice">
            <strong>Cita confirmada para una fecha futura</strong>
            <span>No requiere ninguna acción hasta que el cliente llegue el día de la cita.</span>
          </div>
          <div v-if="!isPastAppointment(selectedAppointment)" class="detail-actions">
            <button v-if="selectedAppointment.status==='PENDING'" class="small" @click="setStatus(selectedAppointment,'CONFIRMED')">Confirmar</button>
            <button v-if="!isFutureAppointment(selectedAppointment) && !isGroomingAppointment(selectedAppointment) && selectedAppointment.status==='CONFIRMED'" class="small secondary" @click="setStatus(selectedAppointment,'WAITING')">Registrar llegada</button>
            <button v-if="!isGroomingAppointment(selectedAppointment) && selectedAppointment.status==='WAITING'" class="small secondary" @click="setStatus(selectedAppointment,'IN_CONSULTATION')">Enviar al doctor</button>
            <button v-if="!isFutureAppointment(selectedAppointment) && isGroomingAppointment(selectedAppointment) && selectedAppointment.status==='CONFIRMED'" class="small secondary" @click="setStatus(selectedAppointment,'IN_CONSULTATION')">Iniciar servicio</button>
            <button v-if="isGroomingAppointment(selectedAppointment) && selectedAppointment.status==='IN_CONSULTATION'" class="small" @click="setStatus(selectedAppointment,'ATTENDED')">Completar servicio</button>
            <button v-if="!isFutureAppointment(selectedAppointment) && appointmentTimeHasPassed(selectedAppointment) && ['PENDING','CONFIRMED','WAITING'].includes(selectedAppointment.status)" class="small secondary" @click="markNoShow(selectedAppointment)">No asistió</button>
            <button v-if="['PENDING','CONFIRMED','WAITING','IN_CONSULTATION'].includes(selectedAppointment.status)" class="small secondary" @click="setStatus(selectedAppointment,'CANCELLED')">Cancelar</button>
            <button v-if="selectedAppointment.status==='CANCELLED'" class="small" @click="setStatus(selectedAppointment,'PENDING')">Reactivar</button>
          </div>
          <button v-else-if="!['ATTENDED','NO_SHOW','CANCELLED'].includes(selectedAppointment.status)" type="button" class="secondary full" @click="markNoShow(selectedAppointment)">Cerrar como no asistió</button>
          <button v-else-if="['ATTENDED','NO_SHOW','CANCELLED'].includes(selectedAppointment.status)" type="button" class="secondary full" @click="createFollowUpFromPastAppointment">Agendar nueva cita</button>
        </div>
      </section>
    </div>

    <div v-else-if="active==='carnets'" class="panel-grid single">
      <section class="glass-card">
        <div class="section-title">
          <div>
            <span class="badge">Carnets</span>
            <h2>Centro de carnets</h2>
            <p class="muted-text">Un solo lugar para revisar fotos subidas, generar PDFs y marcar carnets entregados.</p>
          </div>
          <div v-if="selectedCardPetIds.length" class="detail-actions card-batch-actions">
            <strong>{{ selectedCardPetIds.length }} seleccionado{{ selectedCardPetIds.length === 1 ? '' : 's' }}</strong>
            <button class="small" type="button" @click="generatePetIdCardsBatch">Generar lote PDF</button>
            <button class="small secondary" type="button" @click="markSelectedCardsPrinted">Marcar impresos</button>
            <button class="small secondary" type="button" @click="clearSelectedCardPets">Cancelar selección</button>
          </div>
        </div>

        <div class="card-workflow">
          <article>
            <span>Listos para imprimir</span>
            <strong>{{ cardStats.ready }}</strong>
            <small>Con foto y sin marcar como impreso</small>
          </article>
          <article>
            <span>Falta foto</span>
            <strong>{{ cardStats.missingPhoto }}</strong>
            <small>Recepción debe pedir o subir imagen</small>
          </article>
          <article>
            <span>Reimpresiones</span>
            <strong>{{ cardStats.reprint }}</strong>
            <small>Carnets entregados que piden otro</small>
          </article>
        </div>

        <div class="segmented card-tabs">
          <button type="button" :class="{active:cardFilter==='ready'}" @click="setCardFilter('ready')">Listos</button>
          <button type="button" :class="{active:cardFilter==='reprint'}" @click="setCardFilter('reprint')">Reimpresión</button>
          <button type="button" :class="{active:cardFilter==='missingPhoto'}" @click="setCardFilter('missingPhoto')">Falta foto</button>
          <button type="button" :class="{active:cardFilter==='printed'}" @click="setCardFilter('printed')">Entregados</button>
          <button type="button" :class="{active:cardFilter==='all'}" @click="setCardFilter('all')">Todos</button>
        </div>

        <input v-model="cardSearch" class="search-field" placeholder="Buscar cliente, telefono, correo o mascota">
        <p class="card-result-count">{{ filteredCardPets.length }} resultado{{ filteredCardPets.length === 1 ? '' : 's' }}</p>
        <table>
          <thead>
            <tr>
              <th class="checkbox-cell">
                <input
                  type="checkbox"
                  aria-label="Seleccionar mascotas visibles"
                  :checked="visibleCardPets.length > 0 && visibleCardPets.every(pet => selectedCardPetIds.includes(pet.id))"
                  @change="$event.target.checked ? selectVisibleCardPets() : clearSelectedCardPets()"
                >
              </th>
              <th>Mascota</th>
              <th>Cliente</th>
              <th>Foto</th>
              <th>Estado</th>
              <th>Actividad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!filteredCardPets.length">
              <td colspan="7" class="empty">No hay mascotas con este filtro.</td>
            </tr>
            <tr v-for="pet in visibleCardPets" :key="pet.id">
              <td class="checkbox-cell">
                <input type="checkbox" :checked="selectedCardPetIds.includes(pet.id)" @change="toggleCardPet(pet.id, $event.target.checked)">
              </td>
              <td>
                <strong>{{ pet.name }}</strong>
                <small>{{ pet.species }} {{ pet.breed ? `- ${pet.breed}` : '' }}</small>
              </td>
              <td>
                <strong>{{ pet.client?.fullName || '-' }}</strong>
                <small>{{ pet.client?.phone || pet.client?.email || 'Sin contacto' }}</small>
              </td>
              <td><span class="status">{{ pet.photoUrl ? 'Lista' : 'Falta foto' }}</span></td>
              <td>
                <span class="status">{{ cardStatusLabel(pet.cardStatus) }}</span>
                <small>{{ pet.cardPrintCount || 0 }} impresion(es)</small>
              </td>
              <td>{{ cardActivityLabel(pet) }}</td>
              <td>
                <div class="pet-actions">
                  <button class="small secondary" type="button" @click="generatePetIdCard(pet.id)">PDF</button>
                  <label class="small secondary file-button">
                    Foto
                    <input type="file" accept="image/jpeg,image/png" @change="uploadPetPhoto(pet.id, $event)">
                  </label>
                  <button
                    v-if="pet.cardStatus !== 'PRINTED'"
                    class="small secondary"
                    type="button"
                    @click="selectedCardPetIds=[pet.id]; markSelectedCardsPrinted()"
                  >
                    Marcar impreso
                  </button>
                  <button
                    v-else
                    class="small secondary"
                    type="button"
                    @click="requestCardReprint(pet)"
                  >
                    Solicitar reimpresión
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="visibleCardPets.length < filteredCardPets.length" class="load-more-row">
          <button class="secondary" type="button" @click="showMoreCardPets">
            Ver 25 mas
          </button>
        </div>
      </section>
    </div>

    <div v-else class="panel-grid">
      <section class="glass-card">
        <h2>Clientes y mascotas</h2>
        <p class="muted-text">Busca por nombre, teléfono, correo o mascota. La lista aparece desde 2 caracteres para no saturar recepción.</p>
        <input v-model="search" class="search-field" placeholder="Ej. Romario, 993, Sasha">
        <div v-if="search.trim().length < 2" class="empty-state compact">
          <strong>Busca un cliente para empezar</strong>
          <span>No mostramos todos los clientes juntos porque en producción esta lista puede crecer demasiado.</span>
        </div>
        <table>
          <thead><tr><th>Cliente</th><th>Contacto</th><th>Mascotas</th></tr></thead>
          <tbody>
            <tr v-if="search.trim().length >= 2 && !filteredClients.length"><td colspan="3" class="empty">No hay coincidencias con esa búsqueda.</td></tr>
            <tr v-for="client in filteredClients" :key="client.id">
              <td>{{ client.fullName }}</td>
              <td>{{ client.phone || client.email || '-' }}</td>
              <td>
                <span v-if="client.pets?.length">{{ client.pets.map(pet => pet.name).join(', ') }}</span>
                <span v-else>-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </ReceptionLayout>
</template>

