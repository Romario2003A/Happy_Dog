import { BadRequestException } from '@nestjs/common';
import { StaffService } from './staff.service';

describe('StaffService separation from access accounts', () => {
  it('creates a worker without requiring a login account', async () => {
    const prisma = {
      staffMember: { create: jest.fn().mockResolvedValue({ id: 's1', fullName: 'María', jobTitle: 'Baño y corte', userId: null }) },
      user: { findUnique: jest.fn() },
    };
    const service = new StaffService(prisma as any);

    await service.create({ fullName: 'María', jobTitle: 'Baño y corte', monthlySalary: 1200 });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.staffMember.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ fullName: 'María', jobTitle: 'Baño y corte', monthlySalary: 1200 }),
    }));
  });

  it('rejects linking an access account already used by another worker', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'RECEPTIONIST' }) },
      staffMember: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }), create: jest.fn() },
    };
    const service = new StaffService(prisma as any);

    await expect(service.create({ fullName: 'Ana', jobTitle: 'Recepción', userId: 'u1' })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.staffMember.create).not.toHaveBeenCalled();
  });

  it('deactivates only the worker record and leaves the login account untouched', async () => {
    const prisma = {
      staffMember: {
        findUnique: jest.fn().mockResolvedValue({ id: 's1' }),
        update: jest.fn().mockResolvedValue({ id: 's1', active: false }),
      },
      user: { update: jest.fn() },
    };
    const service = new StaffService(prisma as any);

    await service.setActive('s1', false);

    expect(prisma.staffMember.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 's1' }, data: { active: false } }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
