import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).appointment.findMany({ orderBy:{createdAt:'desc'}, include: { client:true, pet:true, veterinarian:true, service:true } }); }
  findOne(id:string){ return (this.prisma as any).appointment.findUnique({ where:{id}, include: { client:true, pet:true, veterinarian:true, service:true } }); }
  async create(dto:CreateAppointmentDto){ return (this.prisma as any).appointment.create({ data: dto as any }); }
  update(id:string, dto:Partial<CreateAppointmentDto>){ return (this.prisma as any).appointment.update({ where:{id}, data:dto as any, include: { client:true, pet:true, veterinarian:true, service:true } }); }
  remove(id:string){ return (this.prisma as any).appointment.delete({ where:{id} }); }
}
