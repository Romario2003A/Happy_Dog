function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function searchReceptionClients(clients, query, limit = 8) {
  const textQuery = normalizeText(query);
  const digitQuery = onlyDigits(query);
  if (textQuery.length < 2 && digitQuery.length < 2) return [];

  return clients.filter((client) => {
    const searchableText = normalizeText([
      client.fullName,
      client.email,
      client.documentNumber,
      ...(client.pets || []).map((pet) => pet.name),
    ].filter(Boolean).join(' '));
    const searchableDigits = [client.phone, client.documentNumber]
      .map(onlyDigits)
      .filter(Boolean);

    return searchableText.includes(textQuery)
      || (digitQuery.length >= 2 && searchableDigits.some((value) => value.includes(digitQuery)));
  }).slice(0, limit);
}

export function findExactReceptionClients(clients, draft) {
  const phone = onlyDigits(draft.phone);
  const documentNumber = onlyDigits(draft.documentNumber);
  const email = normalizeText(draft.email);

  return clients.filter((client) => (
    (phone && onlyDigits(client.phone) === phone)
    || (documentNumber && onlyDigits(client.documentNumber) === documentNumber)
    || (email && normalizeText(client.email) === email)
  ));
}

export function clientSearchPrefill(query) {
  const value = String(query || '').trim();
  if (!value) return {};
  if (value.includes('@')) return { email: value.toLowerCase() };
  if (onlyDigits(value).length >= 6) return { phone: value };
  return { fullName: value };
}
