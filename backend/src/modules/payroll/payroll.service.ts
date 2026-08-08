import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CashMovementCategory, CashMovementType, PayrollPaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePayrollPaymentDto } from './dto/create-payroll-payment.dto';
import { PayPayrollPaymentDto } from './dto/pay-payroll-payment.dto';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  findAll(period?: string) {
    if (period && !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      throw new BadRequestException('El periodo debe tener el formato AAAA-MM.');
    }
    return this.prisma.payrollPayment.findMany({
      where: period ? { period } : undefined,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: {
        staff: { select: { id: true, fullName: true, jobTitle: true, active: true, monthlySalary: true, payDay: true, bankAccount: true } },
        registeredBy: { select: { id: true, fullName: true } },
        cashMovement: { select: { id: true, occurredAt: true, amount: true } },
      },
    });
  }

  async create(dto: CreatePayrollPaymentDto, registeredById?: string) {
    const staff = await this.prisma.staffMember.findUnique({ where: { id: dto.staffId } });
    if (!staff) throw new BadRequestException('El trabajador seleccionado no existe.');
    const amount = dto.amount == null ? Number(staff.monthlySalary || 0) : Number(dto.amount);
    if (amount <= 0) throw new BadRequestException('Registra un sueldo mensual o indica un monto mayor a cero.');

    try {
      return await this.prisma.payrollPayment.create({
        data: {
          staffId: staff.id,
          period: dto.period,
          amount,
          notes: dto.notes?.trim() || null,
          registeredById: registeredById || null,
        },
        include: { staff: { select: { id: true, fullName: true, jobTitle: true, active: true, monthlySalary: true, payDay: true, bankAccount: true } } },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ese trabajador ya tiene un pago registrado para este mes.');
      }
      throw error;
    }
  }

  async pay(id: string, dto: PayPayrollPaymentDto, registeredById?: string) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) throw new BadRequestException('La fecha de pago no es valida.');
    await this.assertCashDayOpen(paidAt);

    return this.prisma.$transaction(async tx => {
      const payment = await tx.payrollPayment.findUnique({
        where: { id },
        include: { staff: { select: { fullName: true } } },
      });
      if (!payment) throw new NotFoundException('El pago del personal no existe.');
      if (payment.status !== PayrollPaymentStatus.PENDING || payment.cashMovementId) {
        throw new BadRequestException('Este pago ya fue procesado y no puede duplicarse.');
      }

      const claimed = await tx.payrollPayment.updateMany({
        where: { id, status: PayrollPaymentStatus.PENDING, cashMovementId: null },
        data: {
          status: PayrollPaymentStatus.PAID,
          paidAt,
          paymentMethod: dto.paymentMethod,
          referenceCode: dto.referenceCode?.trim() || null,
          notes: dto.notes?.trim() || payment.notes,
          registeredById: registeredById || payment.registeredById,
        },
      });
      if (claimed.count !== 1) throw new BadRequestException('Este pago ya fue procesado y no puede duplicarse.');

      const movement = await tx.cashMovement.create({
        data: {
          type: CashMovementType.EXPENSE,
          category: CashMovementCategory.PAYROLL,
          description: `Pago de personal · ${payment.staff.fullName} · ${payment.period}`,
          counterparty: payment.staff.fullName,
          referenceCode: dto.referenceCode?.trim() || null,
          amount: payment.amount,
          paymentMethod: dto.paymentMethod,
          occurredAt: paidAt,
          notes: dto.notes?.trim() || payment.notes,
          registeredById: registeredById || null,
        },
      });

      return tx.payrollPayment.update({
        where: { id },
        data: { cashMovementId: movement.id },
        include: {
          staff: { select: { id: true, fullName: true, jobTitle: true, active: true, monthlySalary: true, payDay: true, bankAccount: true } },
          registeredBy: { select: { id: true, fullName: true } },
          cashMovement: { select: { id: true, occurredAt: true, amount: true } },
        },
      });
    });
  }

  async cancel(id: string) {
    const payment = await this.prisma.payrollPayment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('El pago del personal no existe.');
    if (payment.status !== PayrollPaymentStatus.PENDING) {
      throw new BadRequestException('Solo se puede cancelar un pago que todavía está pendiente.');
    }
    return this.prisma.payrollPayment.update({ where: { id }, data: { status: PayrollPaymentStatus.CANCELLED } });
  }

  private async assertCashDayOpen(date: Date) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(date);
    const start = new Date(`${day}T00:00:00.000-05:00`);
    const closing = await this.prisma.cashClosing.findUnique({ where: { businessDate: start }, select: { id: true } });
    if (closing) throw new BadRequestException('La caja de ese día está cerrada. Reábrela antes de registrar el pago.');
  }
}
