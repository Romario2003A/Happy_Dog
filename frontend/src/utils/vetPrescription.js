export function inventoryPrescriptionItems(prescription = {}) {
  const productId = String(prescription.productId || '').trim();
  if (!productId || productId === '__manual__') return [];

  return [{
    productId,
    quantity: Number(prescription.quantity || 1),
    dosage: prescription.dosage || '',
    instructions: prescription.instructions || '',
  }];
}
