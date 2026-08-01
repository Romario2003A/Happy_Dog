import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeServiceParts, serviceDisplayLabel } from './serviceDisplay.js';
import { attentionTypeForAppointment, vetTaskForAppointment } from './vetAppointment.js';

test('muestra una condición del servicio una sola vez', () => {
  assert.equal(serviceDisplayLabel({ name: 'CESAREA - MAYOR A 10 KG', condition: 'MAYOR A 10 KG' }), 'CESAREA - MAYOR A 10 KG');
  assert.equal(dedupeServiceParts('CESAREA - MAYOR A 10 KG - MAYOR A 10 KG'), 'CESAREA - MAYOR A 10 KG');
});

test('una cesárea usa el registro de cirugía general y no el consentimiento de esterilización', () => {
  const appointment = { service: { category: 'CIRUGIAS', name: 'CESAREA', condition: 'MAYOR A 10 KG' } };
  assert.equal(attentionTypeForAppointment(appointment), 'SURGERY');
  assert.equal(vetTaskForAppointment(appointment), 'consultation');
});

test('esterilización y castración sí abren su autorización específica', () => {
  assert.equal(vetTaskForAppointment({ service: { name: 'OVH canino' } }), 'surgery');
  assert.equal(vetTaskForAppointment({ reason: 'Castración felina' }), 'surgery');
});
