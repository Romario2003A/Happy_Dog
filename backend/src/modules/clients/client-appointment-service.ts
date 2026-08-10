type ServiceCandidate = {
  id: string;
  name?: string | null;
  category?: string | null;
  condition?: string | null;
  [key: string]: any;
};

function normalized(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesWeight(service: ServiceCandidate, weightKg?: number) {
  if (!weightKg || weightKg <= 0) return false;
  const text = normalized(`${service.name || ''} ${service.condition || ''}`);
  if (/TODO TAMANO/.test(text)) return true;
  if (weightKg <= 10) return /MENOR A 10|MENOS A 10|0 A 10/.test(text);
  return /MAYOR A 10/.test(text);
}

export function suggestClientAppointmentService<T extends ServiceCandidate>(
  services: T[],
  requestType: string,
  requestSubtype: string,
  weightKg?: number,
): T | null {
  const type = normalized(requestType);
  const subtype = normalized(requestSubtype);
  const exactName = (name: string) => services.find(service => normalized(service.name) === normalized(name));

  if (type === 'MEDICAL' || type === 'SURGERY') return exactName('CONSULTA GENERAL') || null;

  if (type === 'VACCINE') {
    const vaccineNames: Record<string, string> = {
      DEWORMING: 'DESPARASITACIONES',
      RABIES: 'RABIA',
      QUADRUPLE: 'VACUNA CUADRUPLE',
      QUINTUPLE: 'VACUNA QUINTUPLE',
      FELINE_TRIPLE: 'TRIPLE FELINA',
      FELINE_LEUKEMIA: 'LEUCEMIA',
    };
    return vaccineNames[subtype] ? exactName(vaccineNames[subtype]) || null : null;
  }

  if (type !== 'GROOMING') return null;
  if (subtype === 'NAILS') return exactName('CORTE DE UÑAS') || null;

  const namePattern = subtype === 'BATH'
    ? /^SOLO BANO\b/
    : subtype === 'BATH_CUT'
      ? /^BANO \+ CORTE O RAPADO\b/
      : subtype === 'MEDICATED'
        ? /^BANO MEDICADO\b/
        : null;
  if (!namePattern) return null;
  return services.find(service => namePattern.test(normalized(service.name)) && matchesWeight(service, weightKg)) || null;
}
