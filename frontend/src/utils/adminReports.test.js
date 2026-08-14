import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterReportRows,
  isCampaignReportAppointment,
  isGroomingReportAppointment,
  isSurgeryReportAppointment,
} from './adminReports.js';

test('clasifica servicios históricos con y sin tildes', () => {
  assert.equal(isGroomingReportAppointment({ serviceName: 'Baño y corte' }), true);
  assert.equal(isSurgeryReportAppointment({ serviceName: 'CESÁREA MAYOR A 10 KG' }), true);
  assert.equal(isCampaignReportAppointment({ serviceCategory: 'CAMPAÑA' }), true);
  assert.equal(isSurgeryReportAppointment({ serviceName: 'Consulta general' }), false);
});

test('busca por paciente, dueño o servicio ignorando tildes', () => {
  const rows = [
    { petName: 'Lía', clientName: 'María', serviceName: 'Vacunación' },
    { petName: 'Toby', clientName: 'Carlos', serviceName: 'Baño' },
  ];
  assert.deepEqual(filterReportRows(rows, 'maria'), [rows[0]]);
  assert.deepEqual(filterReportRows(rows, 'bano'), [rows[1]]);
});

test('clasifica una atención por el nombre explícito de su campaña', () => {
  assert.equal(isCampaignReportAppointment({ campaignName: 'Campaña municipal de agosto', serviceName: 'Esterilización' }), true);
});
