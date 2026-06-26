import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).client.findMany({ orderBy:{createdAt:'desc'}, include: { pets:true } }); }
  findOne(id:string){ return (this.prisma as any).client.findUnique({ where:{id}, include: { pets:true } }); }
  async create(dto:CreateClientDto){ return (this.prisma as any).client.create({ data: dto as any }); }
  update(id:string, dto:Partial<CreateClientDto>){ return (this.prisma as any).client.update({ where:{id}, data:dto as any }); }
  remove(id:string){ return (this.prisma as any).client.delete({ where:{id} }); }
}
