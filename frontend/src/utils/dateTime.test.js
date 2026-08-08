import test from 'node:test';
import assert from 'node:assert/strict';
import { limaDateTimeToIso } from './dateTime.js';

test('convierte la hora local de Lima a un instante UTC sin desplazar la cita', () => {
  assert.equal(limaDateTimeToIso('2026-08-14T10:00'), '2026-08-14T15:00:00.000Z');
});

test('devuelve vacío cuando no recibe una fecha válida', () => {
  assert.equal(limaDateTimeToIso(''), '');
  assert.equal(limaDateTimeToIso('fecha-invalida'), '');
});
