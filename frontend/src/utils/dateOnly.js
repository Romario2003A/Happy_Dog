export function parseDateOnly(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateOnly(value, locale = 'es-PE') {
  const parsed = parseDateOnly(value);
  return parsed ? parsed.toLocaleDateString(locale) : '';
}

export function daysUntilDateOnly(value, now = new Date()) {
  const parsed = parseDateOnly(value);
  if (!parsed) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parsed.getTime() - today.getTime()) / 86400000);
}
