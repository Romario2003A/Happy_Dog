import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
@Injectable()
export class PetsService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).pet.findMany({ orderBy:{createdAt:'desc'}, include: { client:true } }); }
  findOne(id:string){ return (this.prisma as any).pet.findUnique({ where:{id}, include: { client:true } }); }
  async create(dto:CreatePetDto){ return (this.prisma as any).pet.create({ data: dto as any }); }
  update(id:string, dto:Partial<CreatePetDto>){ return (this.prisma as any).pet.update({ where:{id}, data:dto as any }); }
  remove(id:string){ return (this.prisma as any).pet.delete({ where:{id} }); }
}
