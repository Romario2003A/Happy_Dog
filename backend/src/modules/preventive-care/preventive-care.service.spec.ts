import { BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PreventiveCareService } from './preventive-care.service';

describe('PreventiveCareService', () => {
  const dto = {
    appointmentId: 'appointment-1',
    petId: 'pet-1',
    veterinarianId: 'vet-1',
    type: 'VACCINE',
    appliedAt: '2026-08-01',
    productName: 'Quíntuple',
  } as any;

  it('guarda el registro y marca la cita como atendida en una transacción', async () => {
    const tx = {
      appointment: { findUnique: jest.fn().mockResolvedValue({ petId:'pet-1' }), update: jest.fn().mockResolvedValue({}) },
      preventiveCareRecord: { create: jest.fn().mockResolvedValue({ id:'care-1' }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new PreventiveCareService(prisma as any);

    await expect(service.create(dto)).resolves.toEqual({ id:'care-1' });
    expect(tx.preventiveCareRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ appointmentId: expect.anything() }),
    }));
    expect(tx.appointment.update).toHaveBeenCalledWith({
      where:{id:'appointment-1'},
      data:{status:AppointmentStatus.ATTENDED},
    });
  });

  it('rechaza una cita que pertenece a otra mascota', async () => {
    const tx = {
      appointment: { findUnique: jest.fn().mockResolvedValue({ petId:'pet-2' }), update: jest.fn() },
      preventiveCareRecord: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new PreventiveCareService(prisma as any);

    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.preventiveCareRecord.create).not.toHaveBeenCalled();
  });
});
