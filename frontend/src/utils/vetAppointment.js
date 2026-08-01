function normalizedAppointmentText(appointment) {
  return `${appointment?.service?.category || ''} ${appointment?.service?.name || ''} ${appointment?.service?.condition || ''} ${appointment?.reason || ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function isSterilizationAppointment(appointment) {
  return /esteriliz|castr|\bovh\b|orqui/.test(normalizedAppointmentText(appointment));
}

export function isSurgicalAppointment(appointment) {
  const text = normalizedAppointmentText(appointment);
  return isSterilizationAppointment(appointment)
    || /cirug|cesarea|piometra|entropion|enucleacion|distiqui|tumor|hernia|uretrot|otohematoma|amputacion|prolapso/.test(text);
}

export function vetTaskForAppointment(appointment) {
  const text = normalizedAppointmentText(appointment);
  if (/vacun|desparasit/.test(text)) return 'preventive';
  if (isSterilizationAppointment(appointment)) return 'surgery';
  return 'consultation';
}

export function attentionTypeForAppointment(appointment) {
  const text = normalizedAppointmentText(appointment);
  if (/vacun|desparasit/.test(text)) return 'VACCINE';
  if (isSurgicalAppointment(appointment)) return 'SURGERY';
  if (/control|seguimiento/.test(text)) return 'FOLLOW_UP';
  return 'CONSULTATION';
}

export function preventiveDefaultsForAppointment(appointment) {
  const text = normalizedAppointmentText(appointment);
  if (!/vacun|desparasit/.test(text)) return null;

  return {
    type: /desparasit/.test(text) ? 'DEWORMING' : 'VACCINE',
    productName: String(appointment?.service?.name || '').trim(),
    weightKg: appointment?.pet?.weightKg ?? null,
    amountCharged: appointment?.quotedPrice ?? appointment?.service?.price ?? null,
  };
}
