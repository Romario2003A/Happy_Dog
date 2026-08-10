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

export function clientServiceBaseName(service: ServiceCandidate) {
  const name = String(service.name || '').trim();
  const condition = String(service.condition || '').trim();
  if (!condition) return name;
  const suffix = ` - ${condition}`;
  return normalized(name).endsWith(normalized(suffix))
    ? name.slice(0, -suffix.length).trim()
    : name;
}

export function clientRequestTypeForService(service: ServiceCandidate) {
  const category = normalized(service.category);
  if (category === 'CONSULTAS') return 'MEDICAL';
  if (category === 'VACUNACIONES') return 'VACCINE';
  if (category === 'PELUQUERIA') return 'GROOMING';
  if (category === 'CIRUGIAS') return 'SURGERY';
  if (category === 'LABORATORIO') return 'LABORATORY';
  if (category === 'IMAGENES') return 'IMAGING';
  return 'TREATMENT';
}

export function clientServiceOptions(services: ServiceCandidate[]) {
  const unique = new Map<string, { requestType: string; name: string; requiresWeight: boolean }>();
  for (const service of services) {
    const requestType = clientRequestTypeForService(service);
    const name = clientServiceBaseName(service);
    const key = `${requestType}:${normalized(name)}`;
    const requiresWeight = /\bKG\b/.test(normalized(`${service.name || ''} ${service.condition || ''}`));
    if (name && !unique.has(key)) unique.set(key, { requestType, name, requiresWeight });
    else if (unique.has(key) && requiresWeight) unique.get(key)!.requiresWeight = true;
  }
  return [...unique.values()].sort((a, b) => (
    a.requestType.localeCompare(b.requestType) || a.name.localeCompare(b.name, 'es')
  ));
}

export function suggestClientAppointmentService<T extends ServiceCandidate>(
  services: T[],
  requestType: string,
  requestSubtype: string,
  weightKg?: number,
  requestedServiceName?: string,
): T | null {
  const type = normalized(requestType);
  const subtype = normalized(requestSubtype);
  const exactName = (name: string) => services.find(service => normalized(service.name) === normalized(name));

  if (requestedServiceName) {
    const requested = normalized(requestedServiceName);
    const candidates = services.filter(service => (
      clientRequestTypeForService(service) === type && normalized(clientServiceBaseName(service)) === requested
    ));
    if (candidates.length === 1) {
      const onlyCandidate = candidates[0];
      const weightSpecific = /\bKG\b/.test(normalized(`${onlyCandidate.name || ''} ${onlyCandidate.condition || ''}`));
      return !weightSpecific || matchesWeight(onlyCandidate, weightKg) ? onlyCandidate : null;
    }
    const weightMatch = candidates.find(service => matchesWeight(service, weightKg));
    if (weightMatch) return weightMatch;
    return candidates.find(service => /TODO TAMANO/.test(normalized(`${service.name} ${service.condition}`))) || null;
  }

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
