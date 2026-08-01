function normalized(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es');
}

export function dedupeServiceParts(value) {
  const parts = String(value || '').split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  return parts.filter((part, index) => index === 0 || normalized(part) !== normalized(parts[index - 1])).join(' - ');
}

export function serviceDisplayLabel(service) {
  if (!service) return '';
  const condition = String(service.condition || '').trim();
  let name = String(service.name || '').trim();
  if (condition) {
    const suffix = ` - ${condition}`;
    if (normalized(name).endsWith(normalized(suffix))) name = name.slice(0, -suffix.length).trim();
  }
  return dedupeServiceParts([name, condition].filter(Boolean).join(' - '));
}
