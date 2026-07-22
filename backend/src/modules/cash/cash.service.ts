import { BadRequestException, Injectable } from '@nestjs/common';
import { CashMovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';

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

  async pendingAppointments(date?: string) {
    const { start, end } = this.dayRange(date);
    const appointments = await (this.prisma as any).appointment.findMany({
      where: {
        status: 'ATTENDED',
        scheduledAt: { gte: start, lte: end },
        cashMovements: { none: { type: { in: ['INCOME', 'DEBT_PAYMENT'] } } },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
        service: { select: { id: true, name: true, price: true } },
      },
    });

    return appointments.map((appointment: any) => ({
      ...appointment,
      suggestedAmount: appointment.service ? Number(appointment.service.price) : null,
    }));
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

  async createMovement(dto: CreateCashMovementDto, userId?: string) {
    if (Number(dto.amount) <= 0) throw new BadRequestException('El monto debe ser mayor a cero.');

    if (dto.appointmentId && dto.type !== CashMovementType.EXPENSE) {
      const existing = await (this.prisma as any).cashMovement.findFirst({
        where: {
          appointmentId: dto.appointmentId,
          type: { in: [CashMovementType.INCOME, CashMovementType.DEBT_PAYMENT] },
        },
      });
      if (existing) throw new BadRequestException('Esta atención ya fue cobrada.');
    }

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

  async findReceivables() {
    const sales = await (this.prisma as any).sale.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        appointment: { include: { pet: { select: { id: true, name: true, species: true } } } },
        items: true,
        cashMovements: { orderBy: { occurredAt: 'asc' } },
      },
    });
    return sales.map((sale: any) => this.receivableView(sale));
  }

  async createReceivable(dto: CreateReceivableDto, userId?: string) {
    const total = Number(dto.total);
    const initialPayment = Number(dto.initialPayment || 0);
    if (initialPayment > total) throw new BadRequestException('El adelanto no puede superar el total.');

    const [client, pet] = await Promise.all([
      (this.prisma as any).client.findUnique({ where: { id: dto.clientId } }),
      dto.petId ? (this.prisma as any).pet.findUnique({ where: { id: dto.petId } }) : null,
    ]);
    if (!client) throw new BadRequestException('El cliente seleccionado no existe.');
    if (dto.petId && (!pet || pet.clientId !== dto.clientId)) throw new BadRequestException('La mascota no pertenece al cliente seleccionado.');

    return (this.prisma as any).$transaction(async (tx: any) => {
      const sale = await tx.sale.create({
        data: {
          clientId: dto.clientId,
          appointmentId: dto.appointmentId || null,
          cashierId: userId || null,
          status: initialPayment >= total ? 'PAID' : 'PENDING',
          paymentMethod: initialPayment ? dto.paymentMethod || 'CASH' : null,
          subtotal: total,
          total,
          items: { create: [{ description: dto.description.trim(), quantity: 1, unitPrice: total, total }] },
        },
      });
      if (initialPayment > 0) {
        await tx.cashMovement.create({
          data: {
            type: 'DEBT_PAYMENT', category: 'DEBT', description: `Adelanto: ${dto.description.trim()}`,
            amount: initialPayment, paymentMethod: dto.paymentMethod || 'CASH', clientId: dto.clientId,
            petId: dto.petId || null, clientName: client.fullName, petName: pet?.name || null,
            saleId: sale.id, appointmentId: dto.appointmentId || null, notes: dto.notes?.trim() || null,
            registeredById: userId || null,
          },
        });
      }
      return sale;
    });
  }

  async payReceivable(id: string, dto: PayReceivableDto, userId?: string) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { client: true, appointment: { include: { pet: true } }, items: true, cashMovements: true },
      });
      if (!sale || sale.status !== 'PENDING') throw new BadRequestException('La cuenta ya no está pendiente.');
      const paid = sale.cashMovements.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      const balance = Number(sale.total) - paid;
      const amount = Number(dto.amount);
      if (amount > balance + 0.001) throw new BadRequestException(`El saldo pendiente es S/ ${balance.toFixed(2)}.`);
      const description = sale.items[0]?.description || 'Cuenta pendiente';
      const movement = await tx.cashMovement.create({
        data: {
          type: 'DEBT_PAYMENT', category: 'DEBT', description: `Abono: ${description}`, amount,
          paymentMethod: dto.paymentMethod, clientId: sale.clientId,
          petId: sale.appointment?.pet?.id || null, clientName: sale.client.fullName,
          petName: sale.appointment?.pet?.name || null, saleId: sale.id,
          appointmentId: sale.appointmentId || null, notes: dto.notes?.trim() || null,
          registeredById: userId || null,
        },
      });
      if (amount >= balance - 0.001) {
        await tx.sale.update({ where: { id }, data: { status: 'PAID', paymentMethod: dto.paymentMethod } });
      }
      return movement;
    });
  }

  private receivableView(sale: any) {
    const paid = sale.cashMovements.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    const total = Number(sale.total || 0);
    return {
      id: sale.id, createdAt: sale.createdAt, client: sale.client,
      pet: sale.appointment?.pet || null, appointmentId: sale.appointmentId,
      description: sale.items[0]?.description || 'Cuenta pendiente', total, paid,
      balance: Math.max(0, total - paid), payments: sale.cashMovements,
    };
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
