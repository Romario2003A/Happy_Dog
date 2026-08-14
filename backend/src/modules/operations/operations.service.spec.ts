import { ObligationRecurrence, PaymentMethod } from '@prisma/client';
import { OperationsService } from './operations.service';

describe('OperationsService', () => {
  it('combines clinical follow-ups, receivables, obligations and unassigned work', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const prisma = {
      preventiveCareRecord: { findMany: jest.fn().mockResolvedValue([{
        id: 'preventive-1', type: 'VACCINE', appliedAt: new Date(), nextAppointmentAt: tomorrow,
        followUpCalled: false, sterilizationRecommended: false, sterilizationCallDone: false,
        productName: 'Vacuna', nextProductName: 'Refuerzo', pet: { name: 'Luna', client: { fullName: 'Ana', phone: '999111222' } },
      }]) },
      medicalRecord: { findMany: jest.fn().mockResolvedValue([]) },
      appointment: { findMany: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'appointment-1', scheduledAt: tomorrow, reason: 'Baño', client: { fullName: 'Ana', phone: '999111222' }, pet: { name: 'Luna' }, service: { name: 'Baño' } }]) },
      sale: { findMany: jest.fn().mockResolvedValue([{
        id: 'sale-1', total: 100, createdAt: new Date(), appointmentId: 'appointment-1',
        client: { fullName: 'Ana', phone: '999111222' }, appointment: { pet: { name: 'Luna' } },
        items: [], cashMovements: [{ amount: 20 }],
      }]) },
      businessObligation: { findMany: jest.fn().mockResolvedValue([{
        id: 'obligation-1', name: 'Internet', payee: 'Proveedor', amount: 55, nextDueAt: tomorrow,
        recurrence: ObligationRecurrence.MONTHLY, referenceCode: 'REF-1',
      }]) },
      staffMember: { findMany: jest.fn().mockResolvedValue([{ id: 'staff-1', fullName: 'Carlos', jobTitle: 'Groomer' }]) },
    };

    const result = await new OperationsService(prisma as any).center(30);

    expect(result.summary.total).toBe(4);
    expect(result.summary.unassigned).toBe(1);
    expect(result.tasks.map(task => task.type)).toEqual(expect.arrayContaining([
      'PREVENTIVE_CALL', 'DEBT', 'OBLIGATION', 'UNASSIGNED',
    ]));
    expect(result.tasks.find(task => task.type === 'DEBT')?.amount).toBe(80);
    expect(result.staff).toHaveLength(1);
  });

  it('records a recurring obligation in cash and advances its due date atomically', async () => {
    const update = jest.fn().mockResolvedValue({});
    const create = jest.fn().mockResolvedValue({ id: 'movement-1' });
    const tx = {
      businessObligation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'obligation-1', name: 'Internet', payee: 'Proveedor', amount: 60,
          nextDueAt: new Date('2026-01-31T12:00:00.000Z'), recurrence: ObligationRecurrence.MONTHLY,
          referenceCode: 'REF-1', notes: null, active: true,
        }),
        update,
      },
      cashClosing: { findUnique: jest.fn().mockResolvedValue(null) },
      cashMovement: { create },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };

    await new OperationsService(prisma as any).payObligation('obligation-1', {
      paymentMethod: PaymentMethod.YAPE,
    });

    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({
      type: 'EXPENSE', description: 'Internet', amount: 60, paymentMethod: PaymentMethod.YAPE,
      obligationId: 'obligation-1',
    }) });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'obligation-1' },
      data: expect.objectContaining({ active: true, nextDueAt: new Date('2026-02-28T12:00:00.000Z') }),
    });
  });
});
