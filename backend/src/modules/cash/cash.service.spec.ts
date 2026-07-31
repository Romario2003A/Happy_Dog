import { BadRequestException } from '@nestjs/common';
import { CashService } from './cash.service';

describe('CashService daily closing', () => {
  it('calculates physical cash separately from card and Yape', async () => {
    const prisma = {
      cashMovement: {
        findMany: jest.fn().mockResolvedValue([
          { type: 'INCOME', category: 'CONSULTATION', paymentMethod: 'CASH', amount: 50 },
          { type: 'INCOME', category: 'CONSULTATION', paymentMethod: 'YAPE', amount: 80 },
          { type: 'EXPENSE', category: 'OTHER', paymentMethod: 'CASH', amount: 10 },
        ]),
      },
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new CashService(prisma as any);

    const summary = await service.summary('2026-07-30');
    expect(summary.net).toBe(120);
    expect(summary.cashNet).toBe(40);
  });

  it('blocks new movements after the day was closed', async () => {
    const prisma = {
      cashClosing: { findUnique: jest.fn().mockResolvedValue({ id: 'closed' }) },
    };
    const service = new CashService(prisma as any);

    await expect(service.createMovement({
      type: 'INCOME', category: 'OTHER', description: 'late', amount: 10,
      paymentMethod: 'CASH',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});
