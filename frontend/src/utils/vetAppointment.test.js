import test from 'node:test';
import assert from 'node:assert/strict';
import { preventiveDefaultsForAppointment } from './vetAppointment.js';

test('precarga vacuna, producto y precio desde la cita', () => {
  assert.deepEqual(preventiveDefaultsForAppointment({
    quotedPrice: 50,
    service: { category: 'VACUNACIONES', name: 'VACUNA QUINTUPLE', price: 45 },
    pet: { weightKg: 9 },
  }), {
    type: 'VACCINE',
    productName: 'VACUNA QUINTUPLE',
    weightKg: 9,
    amountCharged: 50,
  });
});

test('distingue una desparasitación de una vacuna', () => {
  assert.equal(preventiveDefaultsForAppointment({
    service: { category: 'VACUNACIONES', name: 'DESPARASITACIONES' },
  }).type, 'DEWORMING');
});
