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
});
