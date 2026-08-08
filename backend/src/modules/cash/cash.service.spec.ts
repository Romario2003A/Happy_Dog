import { BadRequestException } from '@nestjs/common';
import { CashService } from './cash.service';

describe('CashService daily closing', () => {
  it('keeps payroll movements under the Personal workflow', async () => {
    const service = new CashService({} as any);

    await expect(service.createMovement({
      type: 'EXPENSE', category: 'PAYROLL', description: 'Pago manual', amount: 100,
      paymentMethod: 'CASH',
    } as any)).rejects.toThrow('se registran desde el módulo Personal');
  });

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

  it('lists charges by completion day and returns service metadata for cash classification', async () => {
    const prisma = {
      appointment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new CashService(prisma as any);

    await service.pendingAppointments('2026-08-02');

    const query = prisma.appointment.findMany.mock.calls[0][0];
    expect(query.where.OR).toEqual([
      { completedAt: { gte: expect.any(Date), lte: expect.any(Date) } },
      { completedAt: null, scheduledAt: { gte: expect.any(Date), lte: expect.any(Date) } },
    ]);
    expect(query.where.sale).toEqual({ is: null });
    expect(query.include.service.select).toMatchObject({ category: true, condition: true, priceLabel: true });
  });

  it('rejects collecting an appointment that is not finished', async () => {
    const prisma = {
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
      appointment: { findUnique: jest.fn().mockResolvedValue({ id: 'a1', status: 'CONFIRMED', clientId: 'c1', petId: 'p1', sale: null }) },
    };
    const service = new CashService(prisma as any);

    await expect(service.createMovement({
      type: 'INCOME', category: 'SURGERY', description: 'Cesárea', amount: 500,
      paymentMethod: 'CASH', appointmentId: 'a1', clientId: 'c1', petId: 'p1',
    } as any)).rejects.toThrow('Solo se puede cobrar una atención terminada.');
  });
});
