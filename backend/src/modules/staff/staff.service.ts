import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';

const staffInclude = {
  user: { select: { id: true, fullName: true, email: true, role: true, active: true } },
} as const;

@Injectable()
export class StaffService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.staffMember.findMany({ orderBy: [{ active: 'desc' }, { fullName: 'asc' }], include: staffInclude });
  }

  async create(dto: CreateStaffMemberDto) {
    await this.validateAccessAccount(dto.userId);
    try {
      return await this.prisma.staffMember.create({ data: this.staffData(dto), include: staffInclude });
    } catch (error) {
      this.handleUniqueAccount(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateStaffMemberDto) {
    const current = await this.prisma.staffMember.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('El trabajador no existe.');
    if (dto.userId !== undefined && dto.userId !== current.userId) await this.validateAccessAccount(dto.userId);
    try {
      return await this.prisma.staffMember.update({ where: { id }, data: this.staffData(dto), include: staffInclude });
    } catch (error) {
      this.handleUniqueAccount(error);
      throw error;
    }
  }

  async setActive(id: string, active: boolean) {
    const current = await this.prisma.staffMember.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new NotFoundException('El trabajador no existe.');
    return this.prisma.staffMember.update({ where: { id }, data: { active }, include: staffInclude });
  }

  private staffData(dto: UpdateStaffMemberDto | CreateStaffMemberDto) {
    return {
      fullName: dto.fullName?.trim(),
      jobTitle: dto.jobTitle?.trim(),
      documentNumber: dto.documentNumber === undefined ? undefined : dto.documentNumber?.trim() || null,
      phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
      workSchedule: dto.workSchedule === undefined ? undefined : dto.workSchedule?.trim() || null,
      bankAccount: dto.bankAccount === undefined ? undefined : dto.bankAccount?.trim() || null,
      monthlySalary: dto.monthlySalary === undefined ? undefined : dto.monthlySalary,
      payDay: dto.payDay === undefined ? undefined : dto.payDay?.trim() || null,
      payrollReminder: dto.payrollReminder === undefined ? undefined : dto.payrollReminder?.trim() || null,
      userId: dto.userId === undefined ? undefined : dto.userId || null,
    };
  }

  private async validateAccessAccount(userId?: string) {
    if (!userId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (!user || user.role === Role.CLIENT) throw new BadRequestException('La cuenta de acceso seleccionada no es válida.');
    const linked = await this.prisma.staffMember.findUnique({ where: { userId }, select: { id: true } });
    if (linked) throw new BadRequestException('Esa cuenta de acceso ya está vinculada a otro trabajador.');
  }

  private handleUniqueAccount(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new BadRequestException('Esa cuenta de acceso ya está vinculada a otro trabajador.');
    }
  }
}
