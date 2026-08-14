import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientSearchPrefill,
  findExactReceptionClients,
  searchReceptionClients,
} from './receptionClientLookup.js';

const clients = [
  {
    id: 'client-1',
    fullName: 'María López',
    phone: '993 784 826',
    email: 'maria@example.com',
    documentNumber: '44556677',
    pets: [{ name: 'Max' }],
  },
  {
    id: 'client-2',
    fullName: 'Carlos Ruiz',
    phone: '988111222',
    pets: [{ name: 'Nala' }],
  },
];

test('encuentra por nombre, teléfono, DNI, correo o mascota', () => {
  assert.equal(searchReceptionClients(clients, 'maria')[0].id, 'client-1');
  assert.equal(searchReceptionClients(clients, '993784')[0].id, 'client-1');
  assert.equal(searchReceptionClients(clients, '44556677')[0].id, 'client-1');
  assert.equal(searchReceptionClients(clients, 'maria@example.com')[0].id, 'client-1');
  assert.equal(searchReceptionClients(clients, 'max')[0].id, 'client-1');
});

test('detecta coincidencias exactas aunque el teléfono tenga espacios', () => {
  assert.deepEqual(findExactReceptionClients(clients, { phone: '993784826' }), [clients[0]]);
});

test('prellena el campo adecuado al registrar un cliente nuevo', () => {
  assert.deepEqual(clientSearchPrefill('nuevo@correo.com'), { email: 'nuevo@correo.com' });
  assert.deepEqual(clientSearchPrefill('999 222 111'), { phone: '999 222 111' });
  assert.deepEqual(clientSearchPrefill('Ana Torres'), { fullName: 'Ana Torres' });
});
