import { BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportsController } from './reports.controller';

describe('ReportsController classic view', () => {
  function controllerWith(data: { cash?: any[]; appointments?: any[]; preventive?: any[]; services?: any[]; staff?: any[]; payroll?: any[] } = {}) {
    const prisma = {
      cashMovement: { findMany: jest.fn().mockResolvedValue(data.cash || []) },
      appointment: { findMany: jest.fn().mockResolvedValue(data.appointments || []) },
      preventiveCareRecord: { findMany: jest.fn().mockResolvedValue(data.preventive || []) },
      service: { findMany: jest.fn().mockResolvedValue(data.services || []) },
      staffMember: { findMany: jest.fn().mockResolvedValue(data.staff || []) },
      payrollPayment: { findMany: jest.fn().mockResolvedValue(data.payroll || []) },
    };
    return { controller: new ReportsController(prisma as any), prisma };
  }

  it('combines cash, appointments and preventive care without exposing edit operations', async () => {
    const { controller } = controllerWith({
      cash: [
        { id: 'm1', type: 'INCOME', category: 'GROOMING', amount: 35, paymentMethod: 'CASH', occurredAt: new Date(), clientName: 'Ana', petName: 'Luna' },
        { id: 'm2', type: 'EXPENSE', category: 'OTHER', amount: 5, paymentMethod: 'CASH', occurredAt: new Date(), counterparty: 'Proveedor' },
      ],
      appointments: [{
        id: 'a1', scheduledAt: new Date(), status: 'ATTENDED', reason: 'Baño', quotedPrice: 35,
        client: { fullName: 'Ana', phone: '999999999' }, pet: { name: 'Luna', species: 'Canino' },
        service: { name: 'SOLO BAÑO', category: 'PELUQUERIA', condition: 'MENOR A 10 KG', price: 35 },
        veterinarian: null,
        medicalRecord: { visitDate: new Date(), reason: 'Control', diagnosis: 'Dermatitis', treatment: 'Baño medicado', nextControlAt: new Date() },
        cashMovements: [{ type: 'INCOME', amount: 35 }],
      }],
      preventive: [{
        id: 'p1', appliedAt: new Date(), type: 'VACCINE', productName: 'Quíntuple', amountCharged: 50,
        pet: { name: 'Luna', species: 'Canino', client: { fullName: 'Ana', phone: '999999999' } },
        veterinarian: { fullName: 'Doctora' },
      }],
      services: [{ id: 's1', name: 'Consulta', category: 'CONSULTAS', price: 30, active: true }],
      staff: [{ id: 'u1', fullName: 'Doctora', jobTitle: 'Veterinaria', active: true, user: { email: 'doctor@happydog.com', role: 'VETERINARIAN', active: true } }],
    });

    const report = await controller.classic('2026-08-01', '2026-08-31');

    expect(report.summary).toMatchObject({ income: 35, expenses: 5, net: 30, appointments: 1, attended: 1, preventive: 1 });
    expect(report.appointments[0]).toMatchObject({ clientName: 'Ana', petName: 'Luna', paidAmount: 35 });
    expect(report.appointments[0]).toMatchObject({ diagnosis: 'Dermatitis', treatment: 'Baño medicado' });
    expect(report.preventiveRecords[0]).toMatchObject({ productName: 'Quíntuple', veterinarianName: 'Doctora' });
    expect(report.services[0]).toMatchObject({ name: 'Consulta', price: 30 });
    expect(report.staff[0]).toMatchObject({ fullName: 'Doctora', jobTitle: 'Veterinaria' });
    expect(report.summary).toMatchObject({ services: 1, staff: 1 });
  });

  it('rejects inverted or excessively long ranges', async () => {
    const { controller } = controllerWith();
    await expect(controller.classic('2026-08-31', '2026-08-01')).rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.classic('2025-01-01', '2026-08-01')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps payroll details restricted to administrators', async () => {
    const { controller, prisma } = controllerWith({ payroll: [{ id: 'p1', period: '2026-08', amount: 1500, status: 'PAID', staff: { fullName: 'Trabajador' } }] });

    const receptionistReport = await controller.classic('2026-08-01', '2026-08-31', Role.RECEPTIONIST);

    expect(receptionistReport.payrollPayments).toEqual([]);
    expect(prisma.payrollPayment.findMany).not.toHaveBeenCalled();
  });
});
