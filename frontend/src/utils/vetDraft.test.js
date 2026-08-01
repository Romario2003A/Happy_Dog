import test from 'node:test';
import assert from 'node:assert/strict';
import { isVetDraftCompatible, vetDraftKey } from './vetDraft.js';

test('aísla los borradores por cita y las atenciones directas', () => {
  assert.equal(vetDraftKey('draft:', 'pet-1', 'appointment-1'), 'draft:pet-1:appointment:appointment-1');
  assert.equal(vetDraftKey('draft:', 'pet-1'), 'draft:pet-1:direct');
});

test('no restaura un borrador de otra cita o versión', () => {
  const draft = { version: 3, appointmentId: 'appointment-1' };
  assert.equal(isVetDraftCompatible(draft, 3, 'appointment-1'), true);
  assert.equal(isVetDraftCompatible(draft, 3, 'appointment-2'), false);
  assert.equal(isVetDraftCompatible(draft, 4, 'appointment-1'), false);
  assert.equal(isVetDraftCompatible({ version: 3, appointmentId: null }, 3, null), true);
});
