import { serviceDisplayLabel } from './serviceDisplay.js';

export function appointmentServiceLabel(appointment) {
  if (appointment?.service?.name) return serviceDisplayLabel(appointment.service);
  const type = String(appointment?.notes || '').match(/SERVICE_TYPE:([A-Z_]+)/)?.[1];
  return ({
    GROOMING: 'Baño y corte',
    VACCINE: 'Vacuna o desparasitación',
    SURGERY: 'Cirugía',
    MEDICAL: 'Consulta médica',
  })[type] || appointment?.reason || 'Atención';
}

export function appointmentCashCategory(appointment) {
  const text = `${appointment?.service?.category || ''} ${appointment?.service?.name || ''} ${appointment?.notes || ''} ${appointment?.reason || ''}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (text.includes('GROOM') || text.includes('BANO') || text.includes('CORTE') || text.includes('PELUQUER')) return 'GROOMING';
  if (text.includes('DESPARASIT')) return 'DEWORMING';
  if (text.includes('VACUN')) return 'VACCINE';
  if (text.includes('CIRUG') || text.includes('CESAREA') || text.includes('PIOMETRA') || text.includes('OVH') || text.includes('ORQUI')) return 'SURGERY';
  if (text.includes('LABORATOR')) return 'LABORATORY';
  if (text.includes('IMAGEN') || text.includes('ECOGRAF') || text.includes('RADIOGRAF')) return 'IMAGING';
  if (text.includes('TRATAMIENTO')) return 'TREATMENT';
  return 'CONSULTATION';
}
