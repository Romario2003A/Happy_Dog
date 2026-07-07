import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';

@Injectable()
export class CashService {
  constructor(private prisma: PrismaService) {}

  findMovements(from?: string, to?: string) {
    const range = this.rangeFromQuery(from, to);
    return (this.prisma as any).cashMovement.findMany({
      where: { occurredAt: { gte: range.start, lte: range.end } },
      orderBy: { occurredAt: 'desc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
        registeredBy: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  async summary(date?: string) {
    const { start, end } = this.dayRange(date);
    const movements = await (this.prisma as any).cashMovement.findMany({
      where: { occurredAt: { gte: start, lte: end } },
      select: { type: true, category: true, paymentMethod: true, amount: true },
    });
    const closing = await (this.prisma as any).cashClosing.findUnique({ where: { businessDate: start } });

    const totals = {
      income: 0,
      expenses: 0,
      debtPayments: 0,
      adjustments: 0,
      net: 0,
      movementCount: movements.length,
      byPaymentMethod: [] as Array<{ key: string; total: number }>,
      byCategory: [] as Array<{ key: string; total: number }>,
      closing,
    };
    const byPayment = new Map<string, number>();
    const byCategory = new Map<string, number>();

    for (const movement of movements) {
      const amount = Number(movement.amount || 0);
      if (movement.type === CashMovementType.EXPENSE) totals.expenses += amount;
      else if (movement.type === CashMovementType.DEBT_PAYMENT) totals.debtPayments += amount;
      else if (movement.type === CashMovementType.ADJUSTMENT) totals.adjustments += amount;
      else totals.income += amount;

      if (movement.paymentMethod) byPayment.set(movement.paymentMethod, (byPayment.get(movement.paymentMethod) || 0) + amount);
      if (movement.category) byCategory.set(movement.category, (byCategory.get(movement.category) || 0) + amount);
    }

    totals.net = totals.income + totals.debtPayments + totals.adjustments - totals.expenses;
    totals.byPaymentMethod = Array.from(byPayment.entries()).map(([key, total]) => ({ key, total }));
    totals.byCategory = Array.from(byCategory.entries()).map(([key, total]) => ({ key, total }));
    return totals;
  }

  createMovement(dto: CreateCashMovementDto, userId?: string) {
    if (Number(dto.amount) <= 0) throw new BadRequestException('El monto debe ser mayor a cero.');
    return (this.prisma as any).cashMovement.create({
      data: {
        type: dto.type,
        category: dto.category || 'OTHER',
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod || null,
        occurredAt: this.parseDateTime(dto.occurredAt),
        clientName: dto.clientName || null,
        petName: dto.petName || null,
        clientId: dto.clientId || null,
        petId: dto.petId || null,
        saleId: dto.saleId || null,
        appointmentId: dto.appointmentId || null,
        notes: dto.notes || null,
        registeredById: userId || null,
      },
    });
  }

  updateMovement(id: string, dto: Partial<CreateCashMovementDto>) {
    return (this.prisma as any).cashMovement.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount === undefined ? undefined : Number(dto.amount),
        occurredAt: dto.occurredAt ? this.parseDateTime(dto.occurredAt) : undefined,
      },
    });
  }

  removeMovement(id: string) {
    return (this.prisma as any).cashMovement.delete({ where: { id } });
  }

  async closeDay(dto: CreateCashClosingDto, userId?: string) {
    const { start } = this.dayRange(dto.businessDate);
    const summary = await this.summary(dto.businessDate);
    const openingAmount = Number(dto.openingAmount || 0);
    const expectedAmount = openingAmount + summary.net;
    const countedAmount = Number(dto.countedAmount || 0);
    const difference = countedAmount - expectedAmount;

    return (this.prisma as any).cashClosing.upsert({
      where: { businessDate: start },
      update: {
        openingAmount,
        expectedAmount,
        countedAmount,
        difference,
        notes: dto.notes || null,
        closedById: userId || null,
      },
      create: {
        businessDate: start,
        openingAmount,
        expectedAmount,
        countedAmount,
        difference,
        notes: dto.notes || null,
        closedById: userId || null,
      },
    });
  }

  findClosings() {
    return (this.prisma as any).cashClosing.findMany({ orderBy: { businessDate: 'desc' }, take: 60 });
  }

  private rangeFromQuery(from?: string, to?: string) {
    const startRange = this.dayRange(from);
    const endRange = this.dayRange(to || from);
    return { start: startRange.start, end: endRange.end };
  }

  private dayRange(value?: string) {
    const day = value || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    return {
      start: new Date(`${day.slice(0, 10)}T00:00:00.000-05:00`),
      end: new Date(`${day.slice(0, 10)}T23:59:59.999-05:00`),
    };
  }

  private parseDateTime(value?: string) {
    if (!value) return new Date();
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !/[zZ]|[+-]\d\d:\d\d$/.test(value)) {
      return new Date(`${value}-05:00`);
    }
    return new Date(value);
  }
}
