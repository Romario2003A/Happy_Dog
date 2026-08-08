const LIMA_OFFSET = '-05:00';

export function limaDateTimeToIso(value) {
  if (!value) return '';
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}${LIMA_OFFSET}`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}
