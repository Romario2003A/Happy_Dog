import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreatePreventiveCareDto } from './dto/create-preventive-care.dto';
@Injectable()
export class PreventiveCareService {
  constructor(private prisma: PrismaService) {}
  findFollowUps(){
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);
    return this.prisma.preventiveCareRecord.findMany({
      where: {
        OR: [
          { nextAppointmentAt: { gte: today, lte: limit } },
          { sterilizationRecommended: true },
        ],
      },
      include: { veterinarian:true, pet:{ include:{ client:true } } },
      orderBy: [{ nextAppointmentAt:'asc' }, { appliedAt:'desc' }],
      take: 50,
    });
  }
  findByPet(petId:string){ return this.prisma.preventiveCareRecord.findMany({ where:{petId}, include:{veterinarian:true}, orderBy:{appliedAt:'desc'} }); }
  create(dto:CreatePreventiveCareDto){
    const { appointmentId, ...recordData } = dto;
    return this.prisma.$transaction(async tx => {
      if (appointmentId) {
        const appointment = await tx.appointment.findUnique({ where:{id:appointmentId}, select:{petId:true} });
        if (!appointment) throw new BadRequestException('Cita no encontrada.');
        if (appointment.petId !== dto.petId) throw new BadRequestException('La cita no pertenece a esta mascota.');
      }
      const record = await tx.preventiveCareRecord.create({
        data:{...recordData,appliedAt:new Date(dto.appliedAt),nextAppointmentAt:dto.nextAppointmentAt?new Date(dto.nextAppointmentAt):undefined},
        include:{veterinarian:true},
      });
      if (appointmentId) {
        await tx.appointment.update({where:{id:appointmentId},data:{status:AppointmentStatus.ATTENDED}});
      }
      return record;
    });
  }
  remove(id:string){ return this.prisma.preventiveCareRecord.delete({where:{id}}); }
}
