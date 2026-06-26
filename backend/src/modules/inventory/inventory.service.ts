import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).product.findMany({ orderBy:{createdAt:'desc'}, include: undefined }); }
  findOne(id:string){ return (this.prisma as any).product.findUnique({ where:{id}, include: undefined }); }
  async create(dto:CreateProductDto){ return (this.prisma as any).product.create({ data: dto as any }); }
  update(id:string, dto:Partial<CreateProductDto>){ return (this.prisma as any).product.update({ where:{id}, data:dto as any }); }
  remove(id:string){ return (this.prisma as any).product.delete({ where:{id} }); }
}
