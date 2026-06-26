import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).sale.findMany({ orderBy:{createdAt:'desc'}, include: { client:true, appointment:true, items:true } }); }
  findOne(id:string){ return (this.prisma as any).sale.findUnique({ where:{id}, include: { client:true, appointment:true, items:true } }); }
  async create(dto:CreateSaleDto){ return (this.prisma as any).sale.create({ data: dto as any }); }
  update(id:string, dto:Partial<CreateSaleDto>){ return (this.prisma as any).sale.update({ where:{id}, data:dto as any }); }
  remove(id:string){ return (this.prisma as any).sale.delete({ where:{id} }); }
}
