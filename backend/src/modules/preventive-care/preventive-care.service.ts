import { Injectable } from '@nestjs/common';
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
  create(dto:CreatePreventiveCareDto){ return this.prisma.preventiveCareRecord.create({ data:{...dto,appliedAt:new Date(dto.appliedAt),nextAppointmentAt:dto.nextAppointmentAt?new Date(dto.nextAppointmentAt):undefined}, include:{veterinarian:true} }); }
  remove(id:string){ return this.prisma.preventiveCareRecord.delete({where:{id}}); }
}
