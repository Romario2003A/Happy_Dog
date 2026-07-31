import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntilDateOnly, formatDateOnly, parseDateOnly } from './dateOnly.js';

test('mantiene el día calendario sin desplazarlo por zona horaria', () => {
  const date = parseDateOnly('2027-12-31T00:00:00.000Z');

  assert.equal(date.getFullYear(), 2027);
  assert.equal(date.getMonth(), 11);
  assert.equal(date.getDate(), 31);
  assert.equal(formatDateOnly('2027-12-31T00:00:00.000Z'), '31/12/2027');
});

test('calcula vencimientos usando días locales completos', () => {
  const now = new Date(2027, 11, 30, 23, 55);

  assert.equal(daysUntilDateOnly('2027-12-31T00:00:00.000Z', now), 1);
});
