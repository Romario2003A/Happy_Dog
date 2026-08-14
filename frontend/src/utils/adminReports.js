function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function appointmentText(appointment) {
  return normalized([
    appointment?.serviceCategory,
    appointment?.serviceName,
    appointment?.serviceCondition,
    appointment?.reason,
    appointment?.campaignName,
  ].join(' '));
}

export function isGroomingReportAppointment(appointment) {
  return /bano|corte|peluquer|groom/.test(appointmentText(appointment));
}

export function isSurgeryReportAppointment(appointment) {
  return /cirug|esteriliz|castr|cesarea|piometra|ovh|orqui|hernia|tumor|amputacion|enucleacion/.test(appointmentText(appointment));
}

export function isCampaignReportAppointment(appointment) {
  return /campana/.test(appointmentText(appointment));
}

export function filterReportRows(rows, query) {
  const search = normalized(query).trim();
  if (!search) return rows;
  return rows.filter(row => normalized(Object.values(row || {}).filter(value => typeof value !== 'object').join(' ')).includes(search));
}
