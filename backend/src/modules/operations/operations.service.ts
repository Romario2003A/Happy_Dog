import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ObligationRecurrence } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { PayObligationDto } from './dto/pay-obligation.dto';

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  async center(requestedDays = 30) {
    const days = Math.min(60, Math.max(7, Number.isFinite(requestedDays) ? requestedDays : 30));
    const { todayStart, todayEnd, rangeEnd } = this.ranges(days);
    const [preventive, sutures, pickups, debts, obligations, unassigned, staff] = await Promise.all([
      this.prisma.preventiveCareRecord.findMany({
        where: {
          OR: [
            { nextAppointmentAt: { not: null, lte: rangeEnd }, followUpCalled: false },
            { sterilizationRecommended: true, sterilizationCallDone: false },
          ],
        },
        include: { pet: { include: { client: true } } },
        orderBy: { nextAppointmentAt: 'asc' },
      }),
      this.prisma.medicalRecord.findMany({
        where: { sutureRemovalAt: { not: null, lte: rangeEnd }, sutureRemovalCompletedAt: null },
        include: { pet: { include: { client: true } }, appointment: { include: { assignedStaff: true } } },
        orderBy: { sutureRemovalAt: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: { pickupAt: { not: null, lte: rangeEnd }, pickedUpAt: null, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
        include: { client: true, pet: true, service: true, assignedStaff: true },
        orderBy: { pickupAt: 'asc' },
      }),
      this.prisma.sale.findMany({
        where: { status: 'PENDING' },
        include: { client: true, appointment: { include: { pet: true } }, items: true, cashMovements: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.businessObligation.findMany({ where: { active: true, nextDueAt: { lte: rangeEnd } }, orderBy: { nextDueAt: 'asc' } }),
      this.prisma.appointment.findMany({
        where: { assignedStaffId: null, scheduledAt: { gte: todayStart, lte: rangeEnd }, status: { in: ['CONFIRMED', 'WAITING', 'IN_CONSULTATION'] } },
        include: { client: true, pet: true, service: true },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.staffMember.findMany({ where: { active: true }, orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, jobTitle: true } }),
    ]);

    const tasks: any[] = [];
    for (const record of preventive) {
      const common = { pet: record.pet.name, client: record.pet.client.fullName, phone: record.pet.client.phone, sourceId: record.id };
      if (record.nextAppointmentAt && !record.followUpCalled) tasks.push(this.task('PREVENTIVE_CALL', record.id, record.nextAppointmentAt, record.type === 'VACCINE' ? 'Recordar próxima vacuna' : 'Recordar desparasitación', `${record.pet.name} · ${record.nextProductName || record.productName}`, common, todayStart, todayEnd));
      if (record.sterilizationRecommended && !record.sterilizationCallDone) {
        const due = record.nextAppointmentAt || this.addDays(record.appliedAt, 30);
        if (due <= rangeEnd) tasks.push(this.task('STERILIZATION_CALL', `${record.id}:sterilization`, due, 'Contactar sobre esterilización', `${record.pet.name} · recomendación pendiente`, common, todayStart, todayEnd));
      }
    }
    for (const record of sutures) tasks.push(this.task('SUTURE', record.id, record.sutureRemovalAt!, 'Retiro de puntos', `${record.pet.name} · ${record.pet.client.fullName}`, { pet: record.pet.name, client: record.pet.client.fullName, phone: record.pet.client.phone, sourceId: record.id, appointmentId: record.appointmentId, responsible: record.appointment.assignedStaff }, todayStart, todayEnd));
    for (const appointment of pickups) tasks.push(this.task('PICKUP', appointment.id, appointment.pickupAt!, 'Mascota por recoger', `${appointment.pet.name} · ${appointment.service?.name || appointment.reason}`, { pet: appointment.pet.name, client: appointment.client.fullName, phone: appointment.client.phone, sourceId: appointment.id, appointmentId: appointment.id, responsible: appointment.assignedStaff }, todayStart, todayEnd));
    for (const sale of debts) {
      const paid = sale.cashMovements.reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
      const balance = Math.max(0, Number(sale.total) - paid);
      if (balance > 0.001) tasks.push(this.task('DEBT', sale.id, this.addDays(sale.createdAt, 1), 'Cobro pendiente', `${sale.client.fullName} · S/ ${balance.toFixed(2)}`, { client: sale.client.fullName, pet: sale.appointment?.pet?.name || null, phone: sale.client.phone, sourceId: sale.id, appointmentId: sale.appointmentId, amount: balance }, todayStart, todayEnd));
    }
    for (const obligation of obligations) tasks.push(this.task('OBLIGATION', obligation.id, obligation.nextDueAt, obligation.name, `${obligation.payee || 'Pago del negocio'} · S/ ${Number(obligation.amount).toFixed(2)}`, { sourceId: obligation.id, amount: Number(obligation.amount), referenceCode: obligation.referenceCode, recurrence: obligation.recurrence }, todayStart, todayEnd));
    for (const appointment of unassigned) tasks.push(this.task('UNASSIGNED', `assign:${appointment.id}`, appointment.scheduledAt, 'Asignar responsable', `${appointment.pet.name} · ${appointment.service?.name || appointment.reason}`, { pet: appointment.pet.name, client: appointment.client.fullName, phone: appointment.client.phone, sourceId: appointment.id, appointmentId: appointment.id }, todayStart, todayEnd));

    const rank: Record<string, number> = { overdue: 0, today: 1, upcoming: 2 };
    tasks.sort((a, b) => rank[a.priority] - rank[b.priority] || new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return {
      generatedAt: new Date(),
      summary: {
        total: tasks.length,
        overdue: tasks.filter(task => task.priority === 'overdue').length,
        today: tasks.filter(task => task.priority === 'today').length,
        upcoming: tasks.filter(task => task.priority === 'upcoming').length,
        unassigned: tasks.filter(task => task.type === 'UNASSIGNED').length,
      },
      tasks,
      staff,
      obligations,
    };
  }

  createObligation(dto: CreateObligationDto) {
    return this.prisma.businessObligation.create({ data: this.obligationData(dto) });
  }

  async updateObligation(id: string, dto: Partial<CreateObligationDto>) {
    const current = await this.prisma.businessObligation.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException('El pago programado no existe.');
    return this.prisma.businessObligation.update({ where: { id }, data: this.obligationData(dto) });
  }

  async payObligation(id: string, dto: PayObligationDto, userId?: string) {
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    return this.prisma.$transaction(async tx => {
      const obligation = await tx.businessObligation.findUnique({ where: { id } });
      if (!obligation || !obligation.active) throw new BadRequestException('El pago programado ya no está disponible.');
      await this.assertDayOpen(paidAt, tx);
      const amount = Number(dto.amount || obligation.amount);
      const movement = await tx.cashMovement.create({ data: {
        type: 'EXPENSE', category: 'OTHER', description: obligation.name, counterparty: obligation.payee,
        referenceCode: obligation.referenceCode, amount, paymentMethod: dto.paymentMethod, occurredAt: paidAt,
        notes: dto.notes?.trim() || obligation.notes, obligationId: obligation.id, registeredById: userId || null,
      } });
      const recurring = obligation.recurrence === ObligationRecurrence.MONTHLY;
      await tx.businessObligation.update({ where: { id }, data: {
        lastPaidAt: paidAt,
        nextDueAt: recurring ? this.addMonth(obligation.nextDueAt) : obligation.nextDueAt,
        active: recurring,
      } });
      return movement;
    });
  }

  async markPickedUp(id: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id }, select: { id: true, pickupAt: true, pickedUpAt: true } });
    if (!appointment?.pickupAt) throw new BadRequestException('La cita no tiene una hora de recojo registrada.');
    if (appointment.pickedUpAt) throw new BadRequestException('La mascota ya fue marcada como entregada.');
    return this.prisma.appointment.update({ where: { id }, data: { pickedUpAt: new Date() } });
  }

  async markPreventiveCall(id: string, kind: 'FOLLOW_UP' | 'STERILIZATION') {
    const record = await this.prisma.preventiveCareRecord.findUnique({ where: { id }, select: { id: true } });
    if (!record) throw new NotFoundException('El seguimiento preventivo no existe.');
    return this.prisma.preventiveCareRecord.update({ where: { id }, data: kind === 'STERILIZATION' ? { sterilizationCallDone: true } : { followUpCalled: true } });
  }

  private obligationData(dto: Partial<CreateObligationDto>) {
    return {
      name: dto.name?.trim(), payee: dto.payee === undefined ? undefined : dto.payee?.trim() || null,
      category: dto.category === undefined ? undefined : dto.category?.trim() || null,
      amount: dto.amount === undefined ? undefined : Number(dto.amount),
      nextDueAt: dto.nextDueAt === undefined ? undefined : new Date(dto.nextDueAt),
      recurrence: dto.recurrence, referenceCode: dto.referenceCode === undefined ? undefined : dto.referenceCode?.trim() || null,
      notes: dto.notes === undefined ? undefined : dto.notes?.trim() || null,
    };
  }

  private task(type: string, id: string, dueAt: Date, title: string, detail: string, extra: any, todayStart: Date, todayEnd: Date) {
    const due = new Date(dueAt);
    const priority = due < todayStart ? 'overdue' : due <= todayEnd ? 'today' : 'upcoming';
    return { id, type, dueAt: due, priority, title, detail, ...extra };
  }

  private ranges(days: number) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
    const todayStart = new Date(`${day}T00:00:00.000-05:00`);
    const todayEnd = new Date(`${day}T23:59:59.999-05:00`);
    return { todayStart, todayEnd, rangeEnd: this.addDays(todayEnd, days) };
  }

  private addDays(value: Date, days: number) { const result = new Date(value); result.setDate(result.getDate() + days); return result; }
  private addMonth(value: Date) {
    const source = new Date(value); const day = source.getDate();
    const target = new Date(source); target.setDate(1); target.setMonth(target.getMonth() + 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(day, lastDay)); return target;
  }
  private async assertDayOpen(value: Date, db: any) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(value);
    const businessDate = new Date(`${day}T00:00:00.000-05:00`);
    const closing = await db.cashClosing.findUnique({ where: { businessDate }, select: { id: true } });
    if (closing) throw new BadRequestException('La caja de ese día está cerrada. Reábrela antes de registrar el pago.');
  }
}
