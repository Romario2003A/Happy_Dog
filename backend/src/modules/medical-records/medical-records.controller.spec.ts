import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { MedicalRecordsController } from './medical-records.controller';

describe('MedicalRecordsController permissions', () => {
  it('permite crear una atención únicamente al veterinario', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, MedicalRecordsController.prototype.create);

    expect(roles).toEqual([Role.VETERINARIAN]);
    expect(roles).not.toContain(Role.ADMIN);
    expect(roles).not.toContain(Role.RECEPTIONIST);
  });

  it('usa siempre al veterinario autenticado como autor', () => {
    const service = { create: jest.fn().mockReturnValue({ id: 'record' }) };
    const controller = new MedicalRecordsController(service as any);

    controller.create({ petId: 'pet', veterinarianId: 'otro', reason: 'control', diagnosis: 'ok' } as any, 'vet-real');

    expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ veterinarianId: 'vet-real' }));
  });
});
