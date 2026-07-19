import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePreventiveCareDto } from './dto/create-preventive-care.dto';
@Injectable()
export class PreventiveCareService {
  constructor(private prisma: PrismaService) {}
  findByPet(petId:string){ return this.prisma.preventiveCareRecord.findMany({ where:{petId}, include:{veterinarian:true}, orderBy:{appliedAt:'desc'} }); }
  create(dto:CreatePreventiveCareDto){ return this.prisma.preventiveCareRecord.create({ data:{...dto,appliedAt:new Date(dto.appliedAt),nextAppointmentAt:dto.nextAppointmentAt?new Date(dto.nextAppointmentAt):undefined}, include:{veterinarian:true} }); }
  remove(id:string){ return this.prisma.preventiveCareRecord.delete({where:{id}}); }
}
