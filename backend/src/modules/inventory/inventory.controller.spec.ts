import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { InventoryController } from './inventory.controller';

describe('InventoryController permissions', () => {
  it('solo permite mover stock a administración y recepción', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, InventoryController.prototype.addMovement);
    expect(roles).toEqual([Role.ADMIN, Role.RECEPTIONIST]);
    expect(roles).not.toContain(Role.VETERINARIAN);
  });

  it('reserva la eliminación permanente para administración', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, InventoryController.prototype.remove);
    expect(roles).toEqual([Role.ADMIN]);
  });
});
