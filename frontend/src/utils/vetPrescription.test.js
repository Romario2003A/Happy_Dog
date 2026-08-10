import test from 'node:test';
import assert from 'node:assert/strict';
import { inventoryPrescriptionItems } from './vetPrescription.js';

test('does not send an external medication as an inventory product', () => {
  assert.deepEqual(inventoryPrescriptionItems({
    productId: '__manual__',
    manualName: 'Probiótico externo',
    quantity: 1,
    dosage: '1 sobre',
    instructions: 'Cada 24 horas',
  }), []);
});

test('keeps inventory products in the prescription payload', () => {
  assert.deepEqual(inventoryPrescriptionItems({
    productId: 'product-1',
    quantity: 2,
    dosage: '5 ml',
    instructions: 'Cada 12 horas',
  }), [{
    productId: 'product-1',
    quantity: 2,
    dosage: '5 ml',
    instructions: 'Cada 12 horas',
  }]);
});
