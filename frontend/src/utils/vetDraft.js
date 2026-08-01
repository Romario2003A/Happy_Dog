export function vetDraftKey(prefix, petId, appointmentId = null) {
  if (!petId) return '';
  const context = appointmentId ? `appointment:${appointmentId}` : 'direct';
  return `${prefix}${petId}:${context}`;
}

export function isVetDraftCompatible(draft, version, appointmentId = null) {
  if (!draft || draft.version !== version) return false;
  return (draft.appointmentId || null) === (appointmentId || null);
}
