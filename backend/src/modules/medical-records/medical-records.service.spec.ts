import { BadRequestException } from '@nestjs/common';
import { MedicalRecordsService } from './medical-records.service';

describe('MedicalRecordsService safeguards', () => {
  it('rechaza cantidades de receta no positivas antes de tocar inventario', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new MedicalRecordsService(prisma as any);

    await expect(service.create({
      petId: 'pet-1',
      veterinarianId: 'vet-1',
      reason: 'Consulta',
      diagnosis: 'Diagnóstico',
      prescriptions: [{ productId: 'product-1', quantity: -2 }],
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('impide asociar la historia a una cita de otra mascota', async () => {
    const tx = {
      appointment: { findUnique: jest.fn().mockResolvedValue({ petId: 'pet-otra' }) },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    const service = new MedicalRecordsService(prisma as any);

    await expect(service.create({
      appointmentId: 'appointment-1',
      petId: 'pet-1',
      veterinarianId: 'vet-1',
      reason: 'Consulta',
      diagnosis: 'Diagnóstico',
    })).rejects.toThrow('La cita seleccionada no corresponde a esta mascota.');
  });
});
