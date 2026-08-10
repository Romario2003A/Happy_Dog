import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
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

  it('does not confirm a client request until reception assigns a service', async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1', status: 'PENDING', serviceId: null, scheduledAt: new Date(), petId: 'p1',
        }),
        update: jest.fn(),
      },
    };
    const service = new AppointmentsService(prisma as any);

    await expect(service.update('a1', { status: 'CONFIRMED' } as any, Role.RECEPTIONIST))
      .rejects.toThrow('Asigna un servicio del tarifario antes de confirmar la cita.');
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('does not allow a veterinarian to reschedule or administratively close an appointment', async () => {
    const prisma = { appointment: { findUnique: jest.fn(), update: jest.fn() } };
    const service = new AppointmentsService(prisma as any);

    await expect(service.update('a1', { status: 'CANCELLED' } as any, Role.VETERINARIAN))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.update('a1', { scheduledAt: new Date().toISOString() } as any, Role.VETERINARIAN))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  it('allows a veterinarian to start an assigned attention for today', async () => {
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1', status: 'WAITING', scheduledAt: new Date(), petId: 'p1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'a1', status: 'IN_CONSULTATION' }),
      },
    };
    const service = new AppointmentsService(prisma as any);

    await service.update('a1', { status: 'IN_CONSULTATION' } as any, Role.VETERINARIAN);
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'IN_CONSULTATION' }),
    }));
  });

  it('rejects arrival or service start for a future appointment', async () => {
    const tomorrow = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const prisma = {
      appointment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'a1', status: 'CONFIRMED', scheduledAt: tomorrow, petId: 'p1',
        }),
        update: jest.fn(),
      },
    };
    const service = new AppointmentsService(prisma as any);

    await expect(service.update('a1', { status: 'WAITING' } as any, Role.RECEPTIONIST))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });
});
