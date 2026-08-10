import { clientServiceOptions, suggestClientAppointmentService } from './client-appointment-service';

describe('client appointment service suggestion', () => {
  const services = [
    { id: 'consult', name: 'CONSULTA GENERAL', category: 'CONSULTAS' },
    { id: 'bath-small', name: 'SOLO BAÑO - MENOR A 10 KG', condition: 'MENOR A 10 KG' },
    { id: 'bath-large', name: 'SOLO BAÑO - MAYOR A 10 KG', condition: 'MAYOR A 10 KG' },
    { id: 'nails', name: 'CORTE DE UÑAS' },
    { id: 'rabies', name: 'RABIA' },
    { id: 'cesarean-small', name: 'CESAREA - MENOR A 10 KG', category: 'CIRUGIAS', condition: 'MENOR A 10 KG' },
    { id: 'cesarean-large', name: 'CESAREA - MAYOR A 10 KG', category: 'CIRUGIAS', condition: 'MAYOR A 10 KG' },
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

  it('shows a clean catalog without duplicated weight variants or prices', () => {
    const options = clientServiceOptions(services);
    expect(options.filter(option => option.name === 'CESAREA')).toEqual([{ requestType: 'SURGERY', name: 'CESAREA', requiresWeight: true }]);
  });

  it('uses a specific surgery chosen by the client and resolves its weight internally', () => {
    expect(suggestClientAppointmentService(services, 'SURGERY', '', 7, 'CESAREA')?.id).toBe('cesarean-small');
    expect(suggestClientAppointmentService(services, 'SURGERY', '', 18, 'CESAREA')?.id).toBe('cesarean-large');
  });
});
