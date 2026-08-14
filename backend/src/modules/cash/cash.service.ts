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

  private async assertDayOpen(value:Date|string, db:any=this.prisma){
    const date=value instanceof Date ? value : this.parseDateTime(value);
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Lima'}).format(date);
    const {start}=this.dayRange(day);
    const closing=await db.cashClosing.findUnique({where:{businessDate:start},select:{id:true}});
    if(closing) throw new BadRequestException('La caja de ese día está cerrada. Reábrela antes de registrar o modificar movimientos.');
  }

  findMovements(from?: string, to?: string) {
    const range = this.rangeFromQuery(from, to);
    return (this.prisma as any).cashMovement.findMany({
      where: { occurredAt: { gte: range.start, lte: range.end } },
      orderBy: { occurredAt: 'desc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
        registeredBy: { select: { id: true, fullName: true, role: true } },
        product: { select: { id: true, name: true, sku: true, presentation: true } },
      },
    });
  }

  async pendingAppointments(date?: string) {
    const { start, end } = this.dayRange(date);
    const appointments = await (this.prisma as any).appointment.findMany({
      where: {
        status: 'ATTENDED',
        OR: [
          { completedAt: { gte: start, lte: end } },
          { completedAt: null, scheduledAt: { gte: start, lte: end } },
        ],
        cashMovements: { none: { type: { in: ['INCOME', 'DEBT_PAYMENT'] } } },
        sale: { is: null },
      },
      orderBy: { scheduledAt: 'asc' },
      include: {
        client: { select: { id: true, fullName: true, phone: true, email: true } },
        pet: { select: { id: true, name: true, species: true, breed: true } },
        service: { select: { id: true, name: true, category: true, condition: true, price: true, priceLabel: true } },
      },
    });

    return appointments.map((appointment: any) => ({
      ...appointment,
      suggestedAmount: appointment.quotedPrice !== null && appointment.quotedPrice !== undefined ? Number(appointment.quotedPrice) : appointment.service ? Number(appointment.service.price) : null,
    }));
  }

  async summary(date?: string) {
    const { start, end } = this.dayRange(date);
    const movements = await (this.prisma as any).cashMovement.findMany({
      where: { occurredAt: { gte: start, lte: end } },
      select: { type: true, category: true, paymentMethod: true, amount: true, affectsCash: true },
    });
    const closing = await (this.prisma as any).cashClosing.findUnique({ where: { businessDate: start } });

    const totals = {
      income: 0,
      expenses: 0,
      debtPayments: 0,
      adjustments: 0,
      net: 0,
      cashNet: 0,
      externalExpenses: 0,
      movementCount: movements.length,
      byPaymentMethod: [] as Array<{ key: string; total: number }>,
      byCategory: [] as Array<{ key: string; income: number; expenses: number; net: number }>,
      closing,
    };
    const byPayment = new Map<string, number>();
    const byCategory = new Map<string, { income: number; expenses: number }>();

    for (const movement of movements) {
      const amount = Number(movement.amount || 0);
      if (movement.type === CashMovementType.EXPENSE) {
        totals.expenses += amount;
        if (movement.affectsCash === false) totals.externalExpenses += amount;
      }
      else if (movement.type === CashMovementType.DEBT_PAYMENT) totals.debtPayments += amount;
      else if (movement.type === CashMovementType.ADJUSTMENT) totals.adjustments += amount;
      else totals.income += amount;

      const signedAmount = movement.type === CashMovementType.EXPENSE ? -amount : amount;
      if (movement.paymentMethod) byPayment.set(movement.paymentMethod, (byPayment.get(movement.paymentMethod) || 0) + signedAmount);
      if (movement.paymentMethod === 'CASH' && movement.affectsCash !== false) totals.cashNet += signedAmount;
      if (movement.category) {
        const category = byCategory.get(movement.category) || { income: 0, expenses: 0 };
        if (movement.type === CashMovementType.EXPENSE) category.expenses += amount;
        else category.income += amount;
        byCategory.set(movement.category, category);
      }
    }

    totals.net = totals.income + totals.debtPayments + totals.adjustments - totals.expenses;
    totals.byPaymentMethod = Array.from(byPayment.entries()).map(([key, total]) => ({ key, total }));
    totals.byCategory = Array.from(byCategory.entries()).map(([key, values]) => ({
      key,
      income: values.income,
      expenses: values.expenses,
      net: values.income - values.expenses,
    }));
    return totals;
  }

  async createMovement(dto: CreateCashMovementDto, userId?: string) {
    if (Number(dto.amount) <= 0) throw new BadRequestException('El monto debe ser mayor a cero.');
    if (dto.category === 'PAYROLL') throw new BadRequestException('Los pagos del personal se registran desde el módulo Personal.');
    if (dto.affectsCash === false && dto.type !== CashMovementType.EXPENSE) throw new BadRequestException('Solo un gasto puede marcarse como egreso fuera de caja.');
    await this.assertDayOpen(dto.occurredAt || new Date());

    if (dto.appointmentId && dto.type !== CashMovementType.EXPENSE) {
      const appointment = await (this.prisma as any).appointment.findUnique({
        where: { id: dto.appointmentId },
        select: { id: true, status: true, clientId: true, petId: true, sale: { select: { id: true, status: true } } },
      });
      if (!appointment) throw new BadRequestException('La atención seleccionada no existe.');
      if (appointment.status !== 'ATTENDED') throw new BadRequestException('Solo se puede cobrar una atención terminada.');
      if (dto.clientId && dto.clientId !== appointment.clientId) throw new BadRequestException('El cliente no corresponde a la atención.');
      if (dto.petId && dto.petId !== appointment.petId) throw new BadRequestException('La mascota no corresponde a la atención.');
      if (appointment.sale) throw new BadRequestException('Esta atención ya tiene una cuenta por cobrar. Registra el pago desde esa cuenta.');
      const existing = await (this.prisma as any).cashMovement.findFirst({
        where: {
          appointmentId: dto.appointmentId,
          type: { in: [CashMovementType.INCOME, CashMovementType.DEBT_PAYMENT] },
        },
      });
      if (existing) throw new BadRequestException('Esta atención ya fue cobrada.');
    }

    return (this.prisma as any).$transaction(async (tx: any) => {
      let product = null;
      const productQuantity = Number(dto.productQuantity || 0);
      if (dto.productId) {
        if (dto.type !== CashMovementType.INCOME || dto.category !== 'PRODUCT') {
          throw new BadRequestException('Los productos solo pueden registrarse como una venta de producto.');
        }
        product = await tx.product.findUnique({ where: { id: dto.productId } });
        if (!product || product.active === false) throw new BadRequestException('El producto no está disponible.');
        if (productQuantity < 1) throw new BadRequestException('Selecciona una cantidad válida.');
        if (Number(product.stock) < productQuantity) throw new BadRequestException(`Stock insuficiente. Solo quedan ${product.stock} unidades.`);
      }

      const movement = await tx.cashMovement.create({
        data: {
        type: dto.type,
        category: dto.category || 'OTHER',
        description: dto.description,
        counterparty: dto.counterparty || null,
        referenceCode: dto.referenceCode || null,
        amount: product ? Number(product.unitPrice) * productQuantity : dto.amount,
        paymentMethod: dto.paymentMethod || null,
        affectsCash: dto.affectsCash !== false,
        occurredAt: this.parseDateTime(dto.occurredAt),
        clientName: dto.clientName || null,
        petName: dto.petName || null,
        clientId: dto.clientId || null,
        petId: dto.petId || null,
        saleId: dto.saleId || null,
        appointmentId: dto.appointmentId || null,
        notes: dto.notes || null,
        registeredById: userId || null,
        productId: product?.id || null,
        productQuantity: product ? productQuantity : null,
        },
      });
      if (product) {
        const updated = await tx.product.updateMany({ where: { id: product.id, stock: { gte: productQuantity } }, data: { stock: { decrement: productQuantity } } });
        if (updated.count !== 1) throw new BadRequestException('El stock cambió mientras registrabas la venta. Revisa la cantidad disponible.');
        await tx.inventoryMovement.create({ data: { productId: product.id, type: 'SALE', quantity: productQuantity, reason: dto.description, referenceId: movement.id } });
      }
      return movement;
    });
  }

  async updateMovement(id: string, dto: Partial<CreateCashMovementDto>) {
    const current=await (this.prisma as any).cashMovement.findUnique({where:{id}});
    if(!current) throw new BadRequestException('Movimiento no encontrado.');
    if(current.category === 'PAYROLL') throw new BadRequestException('Los pagos del personal no se editan desde Caja.');
    if(dto.affectsCash === false && (dto.type || current.type) !== CashMovementType.EXPENSE) throw new BadRequestException('Solo un gasto puede marcarse como egreso fuera de caja.');
    await this.assertDayOpen(current.occurredAt);
    if(dto.occurredAt) await this.assertDayOpen(dto.occurredAt);
    return (this.prisma as any).cashMovement.update({
      where: { id },
      data: {
        ...dto,
        amount: dto.amount === undefined ? undefined : Number(dto.amount),
        occurredAt: dto.occurredAt ? this.parseDateTime(dto.occurredAt) : undefined,
      },
    });
  }

  async removeMovement(id: string) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const movement = await tx.cashMovement.findUnique({ where: { id } });
      if (!movement) throw new BadRequestException('Movimiento no encontrado.');
      if (movement.category === 'PAYROLL') throw new BadRequestException('Los pagos del personal no se eliminan desde Caja.');
      await this.assertDayOpen(movement.occurredAt,tx);
      if (movement.productId && movement.productQuantity) {
        await tx.product.update({ where: { id: movement.productId }, data: { stock: { increment: movement.productQuantity } } });
        await tx.inventoryMovement.create({ data: { productId: movement.productId, type: 'IN', quantity: movement.productQuantity, reason: 'Venta anulada', referenceId: movement.id } });
      }
      return tx.cashMovement.delete({ where: { id } });
    });
  }

  async closeDay(dto: CreateCashClosingDto, userId?: string) {
    const { start } = this.dayRange(dto.businessDate);
    const summary = await this.summary(dto.businessDate);
    const openingAmount = Number(dto.openingAmount || 0);
    const expectedAmount = openingAmount + summary.cashNet;
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

  async reopenDay(date:string){
    const {start}=this.dayRange(date);
    const closing=await (this.prisma as any).cashClosing.findUnique({where:{businessDate:start}});
    if(!closing) throw new BadRequestException('La caja de ese día ya está abierta.');
    return (this.prisma as any).cashClosing.delete({where:{businessDate:start}});
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
    if(initialPayment>0) await this.assertDayOpen(new Date());

    const [client, pet, appointment] = await Promise.all([
      (this.prisma as any).client.findUnique({ where: { id: dto.clientId } }),
      dto.petId ? (this.prisma as any).pet.findUnique({ where: { id: dto.petId } }) : null,
      dto.appointmentId ? (this.prisma as any).appointment.findUnique({
        where: { id: dto.appointmentId },
        include: { sale: { select: { id: true } }, cashMovements: { where: { type: { in: ['INCOME', 'DEBT_PAYMENT'] } }, select: { id: true } } },
      }) : null,
    ]);
    if (!client) throw new BadRequestException('El cliente seleccionado no existe.');
    if (dto.petId && (!pet || pet.clientId !== dto.clientId)) throw new BadRequestException('La mascota no pertenece al cliente seleccionado.');
    if (dto.appointmentId) {
      if (!appointment) throw new BadRequestException('La atención seleccionada no existe.');
      if (appointment.status !== 'ATTENDED') throw new BadRequestException('Solo se puede generar una cuenta para una atención terminada.');
      if (appointment.clientId !== dto.clientId) throw new BadRequestException('El cliente no corresponde a la atención.');
      if (dto.petId && appointment.petId !== dto.petId) throw new BadRequestException('La mascota no corresponde a la atención.');
      if (appointment.sale || appointment.cashMovements.length) throw new BadRequestException('Esta atención ya fue cobrada o ya tiene una cuenta pendiente.');
    }

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
    await this.assertDayOpen(new Date());
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
