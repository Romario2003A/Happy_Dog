import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return this.prisma.user.findMany({ select:{id:true, fullName:true, email:true, role:true, active:true, workSchedule:true, bankAccount:true, monthlySalary:true, payDay:true, payrollReminder:true, createdAt:true}, orderBy:{createdAt:'desc'} }); }
  async create(dto: CreateUserDto){ const passwordHash = await bcrypt.hash(dto.password, 10); return this.prisma.user.create({ data:{ fullName:dto.fullName, email:dto.email, passwordHash, role:dto.role, workSchedule:dto.workSchedule || null, bankAccount:dto.bankAccount || null, monthlySalary:dto.monthlySalary ?? null, payDay:dto.payDay || null, payrollReminder:dto.payrollReminder || null }, select:{id:true, fullName:true, email:true, role:true, active:true, workSchedule:true, bankAccount:true, monthlySalary:true, payDay:true, payrollReminder:true} }); }
  updateStaff(id:string, dto:UpdateStaffDto){ return this.prisma.user.update({ where:{id}, data:{ fullName:dto.fullName, email:dto.email, role:dto.role, workSchedule:dto.workSchedule === undefined ? undefined : dto.workSchedule || null, bankAccount:dto.bankAccount === undefined ? undefined : dto.bankAccount || null, monthlySalary:dto.monthlySalary === undefined ? undefined : dto.monthlySalary, payDay:dto.payDay === undefined ? undefined : dto.payDay || null, payrollReminder:dto.payrollReminder === undefined ? undefined : dto.payrollReminder || null }, select:{id:true, fullName:true, email:true, role:true, active:true, workSchedule:true, bankAccount:true, monthlySalary:true, payDay:true, payrollReminder:true} }); }
  setActive(id:string, active:boolean){ return this.prisma.user.update({ where:{id}, data:{active}, select:{id:true, fullName:true, email:true, role:true, active:true} }); }
}
