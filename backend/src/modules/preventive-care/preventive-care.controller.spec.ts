import { PreventiveCareController } from './preventive-care.controller';

describe('PreventiveCareController authorship', () => {
  it('usa siempre al veterinario autenticado como autor', () => {
    const service = { create: jest.fn().mockReturnValue({ id: 'care' }) };
    const controller = new PreventiveCareController(service as any);

    controller.create({ petId: 'pet', veterinarianId: 'otro', type: 'VACCINE', appliedAt: new Date().toISOString() } as any, 'vet-real');

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ veterinarianId: 'vet-real' }));
  });
});
