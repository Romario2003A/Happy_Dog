import { BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

describe('InventoryService movements', () => {
  it('rejects a zero-unit outgoing movement', async () => {
    const service = new InventoryService({} as any);
    await expect(service.addMovement('p1', { type: 'OUT', quantity: 0 } as any))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses a conditional stock update to avoid concurrent overselling', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', stock: 2 }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inventoryMovement: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback:any) => callback(tx)) };
    const service = new InventoryService(prisma as any);

    await expect(service.addMovement('p1', { type: 'OUT', quantity: 2 } as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('deletes adjustment history before removing an unused product', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          _count: { cashMovements: 0, saleItems: 0, prescriptionItems: 0 },
        }),
        delete: jest.fn().mockResolvedValue({ id: 'p1' }),
      },
      inventoryMovement: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    };
    const prisma = { $transaction: jest.fn((callback:any) => callback(tx)) };
    const service = new InventoryService(prisma as any);

    await expect(service.remove('p1')).resolves.toEqual({ id: 'p1' });
    expect(tx.inventoryMovement.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1' } });
    expect(tx.product.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('preserves products linked to commercial history', async () => {
    const tx = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          _count: { cashMovements: 1, saleItems: 0, prescriptionItems: 0 },
        }),
        delete: jest.fn(),
      },
      inventoryMovement: { deleteMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((callback:any) => callback(tx)) };
    const service = new InventoryService(prisma as any);

    await expect(service.remove('p1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.inventoryMovement.deleteMany).not.toHaveBeenCalled();
    expect(tx.product.delete).not.toHaveBeenCalled();
  });
});
