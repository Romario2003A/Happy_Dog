import { NotFoundException } from '@nestjs/common';
import { PetsService } from './pets.service';

describe('PetsService remove', () => {
  it('removes clinical and appointment dependencies before the pet', async () => {
    const tx = {
      pet: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pet-1', appointments: [{ id: 'app-1' }] }),
        delete: jest.fn().mockResolvedValue({ id: 'pet-1' }),
      },
      medicalRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      preventiveCareRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      appointment: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) };
    const service = new PetsService(prisma as any);

    await expect(service.remove('pet-1')).resolves.toEqual({
      deleted: true,
      petId: 'pet-1',
      appointments: 1,
    });
    expect(tx.medicalRecord.deleteMany).toHaveBeenCalledWith({ where: { petId: 'pet-1' } });
    expect(tx.preventiveCareRecord.deleteMany).toHaveBeenCalledWith({ where: { petId: 'pet-1' } });
    expect(tx.appointment.deleteMany).toHaveBeenCalledWith({ where: { petId: 'pet-1' } });
    expect(tx.pet.delete).toHaveBeenCalledWith({ where: { id: 'pet-1' } });
  });

  it('returns a clear not-found error', async () => {
    const tx = { pet: { findUnique: jest.fn().mockResolvedValue(null) } };
    const prisma = { $transaction: jest.fn((callback: any) => callback(tx)) };
    const service = new PetsService(prisma as any);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
