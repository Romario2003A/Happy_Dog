import test from 'node:test';
import assert from 'node:assert/strict';
import { appointmentCashCategory, appointmentServiceLabel } from './cashAppointment.js';

test('clasifica una cesárea como cirugía en caja', () => {
  const appointment = { service: { category: 'CIRUGIAS', name: 'CESAREA', condition: 'MAYOR A 10 KG' } };
  assert.equal(appointmentCashCategory(appointment), 'SURGERY');
  assert.equal(appointmentServiceLabel(appointment), 'CESAREA - MAYOR A 10 KG');
});

test('distingue desparasitación, laboratorio e imágenes al cobrar', () => {
  assert.equal(appointmentCashCategory({ service: { category: 'VACUNACIONES', name: 'DESPARASITACIÓN' } }), 'DEWORMING');
  assert.equal(appointmentCashCategory({ service: { category: 'LABORATORIO', name: 'HEMOGRAMA' } }), 'LABORATORY');
  assert.equal(appointmentCashCategory({ service: { category: 'IMAGENES', name: 'ECOGRAFÍA' } }), 'IMAGING');
});
