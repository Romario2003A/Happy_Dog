import { suggestClientAppointmentService } from './client-appointment-service';

describe('client appointment service suggestion', () => {
  const services = [
    { id: 'consult', name: 'CONSULTA GENERAL', category: 'CONSULTAS' },
    { id: 'bath-small', name: 'SOLO BAÑO - MENOR A 10 KG', condition: 'MENOR A 10 KG' },
    { id: 'bath-large', name: 'SOLO BAÑO - MAYOR A 10 KG', condition: 'MAYOR A 10 KG' },
    { id: 'nails', name: 'CORTE DE UÑAS' },
    { id: 'rabies', name: 'RABIA' },
  ];

  it('prepares a general consultation for medical and surgery evaluations', () => {
    expect(suggestClientAppointmentService(services, 'MEDICAL', '', 8)?.id).toBe('consult');
    expect(suggestClientAppointmentService(services, 'SURGERY', '', 8)?.id).toBe('consult');
  });

  it('uses the pet weight for grooming without exposing technical ranges', () => {
    expect(suggestClientAppointmentService(services, 'GROOMING', 'BATH', 8)?.id).toBe('bath-small');
    expect(suggestClientAppointmentService(services, 'GROOMING', 'BATH', 18)?.id).toBe('bath-large');
    expect(suggestClientAppointmentService(services, 'GROOMING', 'NAILS')?.id).toBe('nails');
  });

  it('only assigns a vaccine when the client identifies it', () => {
    expect(suggestClientAppointmentService(services, 'VACCINE', 'RABIES')?.id).toBe('rabies');
    expect(suggestClientAppointmentService(services, 'VACCINE', 'UNKNOWN')).toBeNull();
  });
});
