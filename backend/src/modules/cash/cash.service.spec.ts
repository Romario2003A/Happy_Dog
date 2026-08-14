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

  it('records external expenses without reducing physical cash', async () => {
    const prisma = {
      cashMovement: {
        findMany: jest.fn().mockResolvedValue([
          { type: 'INCOME', category: 'CONSULTATION', paymentMethod: 'CASH', amount: 100, affectsCash: true },
          { type: 'EXPENSE', category: 'OTHER', paymentMethod: 'TRANSFER', amount: 25, affectsCash: false },
        ]),
      },
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new CashService(prisma as any);

    const summary = await service.summary('2026-08-13');
    expect(summary.expenses).toBe(25);
    expect(summary.externalExpenses).toBe(25);
    expect(summary.net).toBe(75);
    expect(summary.cashNet).toBe(100);
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

  it('checks out an attended service and products as one paid sale', async () => {
    const tx = {
      appointment: { findUnique: jest.fn().mockResolvedValue({
        id: 'a1', status: 'ATTENDED', clientId: 'c1', petId: 'p1', serviceId: 's1',
        reason: 'Control', notes: null, sale: null, cashMovements: [],
        client: { id: 'c1', fullName: 'Ana' }, pet: { id: 'p1', name: 'Luna' },
        service: { id: 's1', name: 'Consulta medica', category: 'CONSULTA', species: 'Perro', condition: null },
      }) },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'pr1', name: 'Shampoo', category: 'Pet shop', description: null, unitPrice: 20, stock: 5, active: true }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      sale: { create: jest.fn().mockResolvedValue({ id: 'sale1' }) },
      cashMovement: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'movement', ...data })) },
      inventoryMovement: { create: jest.fn().mockResolvedValue({ id: 'im1' }) },
    };
    const prisma = {
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new CashService(prisma as any);

    const result = await service.checkoutAppointment({
      appointmentId: 'a1', serviceAmount: 50, paymentMethod: 'YAPE',
      products: [{ productId: 'pr1', quantity: 2 }],
    } as any, 'u1');

    expect(result.total).toBe(90);
    expect(tx.sale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ appointmentId: 'a1', status: 'PAID', total: 90 }),
    }));
    expect(tx.cashMovement.create).toHaveBeenCalledTimes(2);
    expect(tx.cashMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ saleId: 'sale1', appointmentId: 'a1', category: 'PET_SHOP', amount: 40, productQuantity: 2 }),
    }));
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { stock: { decrement: 2 } } }));
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
