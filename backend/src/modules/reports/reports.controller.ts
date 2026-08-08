import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST)
@Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  private reportRange(from?: string, to?: string) {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const defaultFrom = `${today.slice(0, 8)}01`;
    const fromValue = from || defaultFrom;
    const toValue = to || today;
    const validDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!validDate.test(fromValue) || !validDate.test(toValue)) {
      throw new BadRequestException('Usa fechas validas en formato AAAA-MM-DD.');
    }
    const start = new Date(`${fromValue}T00:00:00-05:00`);
    const end = new Date(`${toValue}T23:59:59.999-05:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException('El rango de fechas no es valido.');
    }
    if ((end.getTime() - start.getTime()) / 86_400_000 > 370) {
      throw new BadRequestException('El reporte puede abarcar como maximo un ano.');
    }
    return { start, end, from: fromValue, to: toValue };
  }

  @Get('summary')
  async summary() {
    const [clients, pets, appointments, products, lowStock] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.pet.count(),
      this.prisma.appointment.count(),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { stock: { lte: 0 } } }),
    ]);

    return { clients, pets, appointments, products, lowStock };
  }

  @Get('classic')
  async classic(@Query('from') from?: string, @Query('to') to?: string) {
    const range = this.reportRange(from, to);
    const [cashMovements, appointments, preventiveRecords, services, staff] = await Promise.all([
      (this.prisma as any).cashMovement.findMany({
        where: { occurredAt: { gte: range.start, lte: range.end } },
        orderBy: { occurredAt: 'desc' },
        include: {
          client: { select: { fullName: true, phone: true } },
          pet: { select: { name: true, species: true, breed: true } },
          registeredBy: { select: { fullName: true } },
        },
      }),
      (this.prisma as any).appointment.findMany({
        where: { scheduledAt: { gte: range.start, lte: range.end } },
        orderBy: { scheduledAt: 'desc' },
        include: {
          client: { select: { fullName: true, phone: true } },
          pet: { select: { name: true, species: true, breed: true, sex: true, color: true, age: true, weightKg: true } },
          veterinarian: { select: { fullName: true } },
          service: { select: { name: true, category: true, condition: true, price: true } },
          medicalRecord: { select: { visitDate: true, reason: true, weightKg: true, temperatureC: true, diagnosis: true, treatment: true, observations: true, nextControlAt: true } },
          cashMovements: { select: { type: true, amount: true } },
        },
      }),
      (this.prisma as any).preventiveCareRecord.findMany({
        where: { appliedAt: { gte: range.start, lte: range.end } },
        orderBy: { appliedAt: 'desc' },
        include: {
          pet: { select: { name: true, species: true, breed: true, sex: true, age: true, client: { select: { fullName: true, phone: true } } } },
          veterinarian: { select: { fullName: true } },
        },
      }),
      this.prisma.service.findMany({
        orderBy: [{ active: 'desc' }, { category: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, category: true, species: true, condition: true, description: true,
          price: true, maxPrice: true, socialPrice: true, priceLabel: true, requiresQuote: true,
          durationMinutes: true, active: true,
        },
      }),
      this.prisma.user.findMany({
        where: { role: { not: Role.CLIENT } },
        orderBy: [{ active: 'desc' }, { fullName: 'asc' }],
        select: { id: true, fullName: true, email: true, role: true, active: true, workSchedule: true },
      }),
    ]);

    const categoryTotals = new Map<string, { income: number; expenses: number }>();
    const paymentTotals = new Map<string, number>();
    let income = 0;
    let expenses = 0;
    let adjustments = 0;

    const cash = cashMovements.map((movement: any) => {
      const amount = Number(movement.amount || 0);
      const isExpense = movement.type === 'EXPENSE';
      if (isExpense) expenses += amount;
      else if (movement.type === 'ADJUSTMENT') adjustments += amount;
      else income += amount;
      const category = movement.category || 'OTHER';
      const categoryValue = categoryTotals.get(category) || { income: 0, expenses: 0 };
      if (isExpense) categoryValue.expenses += amount;
      else categoryValue.income += amount;
      categoryTotals.set(category, categoryValue);
      if (movement.paymentMethod) {
        paymentTotals.set(movement.paymentMethod, (paymentTotals.get(movement.paymentMethod) || 0) + (isExpense ? -amount : amount));
      }
      return {
        id: movement.id,
        occurredAt: movement.occurredAt,
        type: movement.type,
        category,
        description: movement.description,
        amount,
        paymentMethod: movement.paymentMethod,
        clientName: movement.clientName || movement.client?.fullName || '',
        petName: movement.petName || movement.pet?.name || '',
        counterparty: movement.counterparty || '',
        referenceCode: movement.referenceCode || '',
        responsible: movement.registeredBy?.fullName || '',
      };
    });

    const attentionRows = appointments.map((appointment: any) => {
      const paidAmount = (appointment.cashMovements || [])
        .filter((movement: any) => movement.type !== 'EXPENSE')
        .reduce((sum: number, movement: any) => sum + Number(movement.amount || 0), 0);
      return {
        id: appointment.id,
        scheduledAt: appointment.scheduledAt,
        status: appointment.status,
        reason: appointment.reason,
        pickupAt: appointment.pickupAt,
        quotedPrice: appointment.quotedPrice == null
          ? Number(appointment.service?.price || 0)
          : Number(appointment.quotedPrice),
        priceNote: appointment.priceNote || '',
        paidAmount,
        clientName: appointment.client?.fullName || '',
        phone: appointment.client?.phone || '',
        petName: appointment.pet?.name || '',
        species: appointment.pet?.species || '',
        breed: appointment.pet?.breed || '',
        sex: appointment.pet?.sex || 'UNKNOWN',
        color: appointment.pet?.color || '',
        age: appointment.pet?.age || '',
        weightKg: appointment.pet?.weightKg ?? null,
        serviceName: appointment.service?.name || '',
        serviceCategory: appointment.service?.category || '',
        serviceCondition: appointment.service?.condition || '',
        veterinarianName: appointment.veterinarian?.fullName || '',
        medicalVisitDate: appointment.medicalRecord?.visitDate || null,
        medicalReason: appointment.medicalRecord?.reason || '',
        medicalWeightKg: appointment.medicalRecord?.weightKg ?? null,
        temperatureC: appointment.medicalRecord?.temperatureC ?? null,
        diagnosis: appointment.medicalRecord?.diagnosis || '',
        treatment: appointment.medicalRecord?.treatment || '',
        observations: appointment.medicalRecord?.observations || '',
        nextControlAt: appointment.medicalRecord?.nextControlAt || null,
      };
    });

    const preventive = preventiveRecords.map((record: any) => ({
      id: record.id,
      appliedAt: record.appliedAt,
      type: record.type,
      productName: record.productName,
      nextProductName: record.nextProductName || '',
      weightKg: record.weightKg ?? null,
      amountCharged: Number(record.amountCharged || 0),
      nextAppointmentAt: record.nextAppointmentAt,
      dewormed: record.dewormed,
      followUpCalled: record.followUpCalled,
      sterilizationRecommended: record.sterilizationRecommended,
      sterilizationCallDone: record.sterilizationCallDone,
      notes: record.notes || '',
      clientName: record.pet?.client?.fullName || '',
      phone: record.pet?.client?.phone || '',
      petName: record.pet?.name || '',
      species: record.pet?.species || '',
      breed: record.pet?.breed || '',
      sex: record.pet?.sex || 'UNKNOWN',
      age: record.pet?.age || '',
      veterinarianName: record.veterinarian?.fullName || '',
    }));

    const tariff = services.map((service: any) => ({
      ...service,
      price: Number(service.price || 0),
      maxPrice: service.maxPrice == null ? null : Number(service.maxPrice),
      socialPrice: service.socialPrice == null ? null : Number(service.socialPrice),
    }));

    return {
      range: { from: range.from, to: range.to },
      summary: {
        income,
        expenses,
        adjustments,
        net: income + adjustments - expenses,
        movements: cash.length,
        appointments: attentionRows.length,
        attended: attentionRows.filter((row: any) => row.status === 'ATTENDED').length,
        preventive: preventive.length,
        services: tariff.length,
        staff: staff.length,
      },
      byCategory: Array.from(categoryTotals.entries()).map(([key, values]) => ({
        key,
        income: values.income,
        expenses: values.expenses,
        net: values.income - values.expenses,
      })),
      byPaymentMethod: Array.from(paymentTotals.entries()).map(([key, total]) => ({ key, total })),
      cashMovements: cash,
      appointments: attentionRows,
      preventiveRecords: preventive,
      services: tariff,
      staff,
    };
  }
}
