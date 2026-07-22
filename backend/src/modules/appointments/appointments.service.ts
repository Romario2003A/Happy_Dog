import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).appointment.findMany({ orderBy:{createdAt:'desc'}, include: { client:true, pet:true, veterinarian:true, service:true } }); }
  findOne(id:string){ return (this.prisma as any).appointment.findUnique({ where:{id}, include: { client:true, pet:true, veterinarian:true, service:true } }); }

  private toAppointmentData(dto: UpdateAppointmentDto) {
    const data: any = {};

    if (dto.scheduledAt !== undefined) {
      const scheduledAt = new Date(dto.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new BadRequestException('Fecha de cita invalida.');
      }
      data.scheduledAt = scheduledAt;
    }

    if (dto.pickupAt !== undefined) {
      const pickupAt = new Date(dto.pickupAt);
      if (Number.isNaN(pickupAt.getTime())) {
        throw new BadRequestException('Hora de recojo invalida.');
      }
      data.pickupAt = pickupAt;
    }

    if (dto.reason !== undefined) data.reason = dto.reason.trim();
    if (dto.clientId !== undefined) data.clientId = dto.clientId;
    if (dto.petId !== undefined) data.petId = dto.petId;
    if (dto.veterinarianId?.trim()) data.veterinarianId = dto.veterinarianId.trim();
    if (dto.serviceId?.trim()) data.serviceId = dto.serviceId.trim();
    if (dto.quotedPrice !== undefined) data.quotedPrice = Number(dto.quotedPrice);
    if (dto.priceNote !== undefined) data.priceNote = dto.priceNote.trim() || null;
    if (dto.notes?.trim()) data.notes = dto.notes.trim();
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'WAITING') data.checkedInAt = new Date();
      if (dto.status === 'IN_CONSULTATION') data.startedAt = new Date();
      if (dto.status === 'ATTENDED') data.completedAt = new Date();
    }

    return data;
  }

  async create(dto:CreateAppointmentDto){ return (this.prisma as any).appointment.create({ data: this.toAppointmentData(dto), include: { client:true, pet:true, veterinarian:true, service:true } }); }
  update(id:string, dto:UpdateAppointmentDto){ return (this.prisma as any).appointment.update({ where:{id}, data:this.toAppointmentData(dto), include: { client:true, pet:true, veterinarian:true, service:true } }); }
  remove(id:string){ return (this.prisma as any).appointment.delete({ where:{id} }); }
}
