import { BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService workflow', () => {
  it('does not allow reopening an attended appointment', async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', status: 'ATTENDED' }),
        update: jest.fn(),
      },
    };
    const service = new AppointmentsService(prisma as any);

    await expect(service.update('a1', { status: 'CONFIRMED' } as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('clears old timestamps when a cancelled appointment is reactivated', async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1', status: 'CANCELLED', checkedInAt: new Date(), startedAt: new Date(), completedAt: null,
        }),
        update: jest.fn().mockResolvedValue({ id: 'a1', status: 'PENDING' }),
      },
    };
    const service = new AppointmentsService(prisma as any);

    await service.update('a1', { status: 'PENDING' } as any);
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PENDING', checkedInAt: null, startedAt: null, completedAt: null }),
    }));
  });
});
