import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicalReasonForAppointment, preventiveDefaultsForAppointment } from './vetAppointment.js';

test('conserva el motivo clínico escrito por recepción aunque exista un servicio', () => {
  assert.equal(clinicalReasonForAppointment({
    service: { name: 'CONSULTA GENERAL' },
    reason: 'No quiere comer y podría haber tragado un objeto',
  }), 'No quiere comer y podría haber tragado un objeto');
});

test('separa el detalle del cliente del servicio en una solicitud pública', () => {
  assert.equal(clinicalReasonForAppointment({
    service: { name: 'CONSULTA GENERAL' },
    reason: 'CLIENT_DATE_REQUEST::CONSULTA GENERAL · Vomita desde anoche',
  }), 'Vomita desde anoche');
});

test('usa el servicio si no existe un motivo más específico', () => {
  assert.equal(clinicalReasonForAppointment({
    service: { name: 'CONSULTA GENERAL' },
    reason: 'CLIENT_DATE_REQUEST::CONSULTA GENERAL',
  }), 'CONSULTA GENERAL');
});

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
