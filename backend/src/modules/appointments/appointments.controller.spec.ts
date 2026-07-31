import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AppointmentsController } from './appointments.controller';

describe('AppointmentsController permissions', () => {
  it('only allows administration and reception to create appointments', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.create);
    expect(roles).toEqual([Role.ADMIN, Role.RECEPTIONIST]);
  });

  it('reserves permanent appointment deletion for administration', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AppointmentsController.prototype.remove);
    expect(roles).toEqual([Role.ADMIN]);
  });
});
