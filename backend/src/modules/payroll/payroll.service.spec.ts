import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, PayrollPaymentStatus } from '@prisma/client';
import { PayrollService } from './payroll.service';

describe('PayrollService workflow', () => {
  it('uses the configured monthly salary when creating a pending period', async () => {
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'staff-1', role: 'VETERINARIAN', monthlySalary: 1800 }) },
      payrollPayment: { create: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'PENDING' }) },
    };
    const service = new PayrollService(prisma as any);

    await service.create({ staffId: 'staff-1', period: '2026-08' }, 'admin-1');

    expect(prisma.payrollPayment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ staffId: 'staff-1', period: '2026-08', amount: 1800, registeredById: 'admin-1' }),
    }));
  });

  it('marks the payment once and creates one payroll expense in cash', async () => {
    const payment = {
      id: 'pay-1', period: '2026-08', amount: 1800, status: PayrollPaymentStatus.PENDING,
      cashMovementId: null, notes: null, registeredById: null, staff: { fullName: 'Dra. Happy Dog' },
    };
    const tx = {
      payrollPayment: {
        findUnique: jest.fn().mockResolvedValue(payment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ ...payment, status: 'PAID', cashMovementId: 'cash-1' }),
      },
      cashMovement: { create: jest.fn().mockResolvedValue({ id: 'cash-1' }) },
    };
    const prisma = {
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async callback => callback(tx)),
    };
    const service = new PayrollService(prisma as any);

    await service.pay('pay-1', { paymentMethod: PaymentMethod.TRANSFER, paidAt: '2026-08-31T12:00:00-05:00' }, 'admin-1');

    expect(tx.cashMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.cashMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      type: 'EXPENSE', category: 'PAYROLL', amount: 1800,
      description: 'Pago de personal · Dra. Happy Dog · 2026-08', registeredById: 'admin-1',
    }) });
  });

  it('blocks a second confirmation and does not create another cash movement', async () => {
    const tx = {
      payrollPayment: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pay-1', status: PayrollPaymentStatus.PAID, cashMovementId: 'cash-1', staff: { fullName: 'Dra. Happy Dog' } }),
      },
      cashMovement: { create: jest.fn() },
    };
    const prisma = {
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async callback => callback(tx)),
    };
    const service = new PayrollService(prisma as any);

    await expect(service.pay('pay-1', { paymentMethod: PaymentMethod.CASH }, 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it('does not pay through a closed cash day', async () => {
    const prisma = { cashClosing: { findUnique: jest.fn().mockResolvedValue({ id: 'closed' }) } };
    const service = new PayrollService(prisma as any);

    await expect(service.pay('pay-1', { paymentMethod: PaymentMethod.CASH }, 'admin-1')).rejects.toThrow('La caja de ese día está cerrada');
  });
});
