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
});
