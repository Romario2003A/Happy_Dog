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
    if (dto.durationMinutes !== undefined) data.durationMinutes = Number(dto.durationMinutes);
    if (dto.notes?.trim()) data.notes = dto.notes.trim();
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === 'WAITING') data.checkedInAt = new Date();
      if (dto.status === 'IN_CONSULTATION') data.startedAt = new Date();
      if (dto.status === 'ATTENDED') data.completedAt = new Date();
    }

    return data;
  }

  private async assertNoConflict(data:any, excludeId?:string){
    if(!data.scheduledAt || !data.petId) return;
    const start=new Date(data.scheduledAt);
    const duration=Math.max(5,Number(data.durationMinutes || 30));
    const end=new Date(start.getTime()+duration*60000);
    const dayStart=new Date(start); dayStart.setHours(0,0,0,0);
    const dayEnd=new Date(dayStart); dayEnd.setDate(dayEnd.getDate()+1);
    const candidates=await (this.prisma as any).appointment.findMany({where:{
      id:excludeId?{not:excludeId}:undefined,
      scheduledAt:{gte:dayStart,lt:dayEnd},
      status:{notIn:['CANCELLED','ATTENDED','NO_SHOW']},
      OR:[{petId:data.petId},...(data.veterinarianId?[{veterinarianId:data.veterinarianId}]:[])],
    },select:{scheduledAt:true,durationMinutes:true,petId:true,veterinarianId:true}});
    const conflict=candidates.some((item:any)=>{
      const otherStart=new Date(item.scheduledAt);
      const otherEnd=new Date(otherStart.getTime()+Math.max(5,Number(item.durationMinutes || 30))*60000);
      return start<otherEnd && end>otherStart;
    });
    if(conflict) throw new BadRequestException('Ese horario se cruza con otra cita de la mascota o del profesional. Elige una hora disponible.');
  }

  async create(dto:CreateAppointmentDto){
    const data=this.toAppointmentData(dto as any);
    if(data.serviceId && dto.durationMinutes === undefined){
      const service=await (this.prisma as any).service.findUnique({where:{id:data.serviceId},select:{durationMinutes:true}});
      data.durationMinutes=service?.durationMinutes || 30;
    }
    await this.assertNoConflict(data);
    return (this.prisma as any).appointment.create({ data, include: { client:true, pet:true, veterinarian:true, service:true } });
  }
  async update(id:string, dto:UpdateAppointmentDto){
    const current=await (this.prisma as any).appointment.findUnique({where:{id}});
    const changes=this.toAppointmentData(dto);
    const data={...current,...changes};
    if(changes.serviceId && dto.durationMinutes === undefined){
      const service=await (this.prisma as any).service.findUnique({where:{id:changes.serviceId},select:{durationMinutes:true}});
      changes.durationMinutes=service?.durationMinutes || 30;
      data.durationMinutes=changes.durationMinutes;
    }
    if(dto.scheduledAt !== undefined || dto.serviceId !== undefined || dto.durationMinutes !== undefined || dto.veterinarianId !== undefined || dto.petId !== undefined) await this.assertNoConflict(data,id);
    return (this.prisma as any).appointment.update({ where:{id}, data:changes, include: { client:true, pet:true, veterinarian:true, service:true } });
  }
  remove(id:string){ return (this.prisma as any).appointment.delete({ where:{id} }); }
}
