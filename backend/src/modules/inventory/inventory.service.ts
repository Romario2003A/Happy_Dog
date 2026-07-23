import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { MovementType } from '@prisma/client';
@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).product.findMany({ orderBy:[{active:'desc'},{name:'asc'}] }); }
  findOne(id:string){ return (this.prisma as any).product.findUnique({ where:{id}, include:{movements:{orderBy:{createdAt:'desc'},take:50}} }); }
  findMovements(id:string){ return (this.prisma as any).inventoryMovement.findMany({ where:{productId:id}, orderBy:{createdAt:'desc'}, take:100 }); }
  async create(dto:CreateProductDto){
    const { expirationDate, ...data } = dto;
    return (this.prisma as any).$transaction(async (tx:any) => {
      const product = await tx.product.create({ data:{...data, expirationDate: expirationDate ? new Date(expirationDate) : null} });
      if (Number(dto.stock) > 0) await tx.inventoryMovement.create({data:{productId:product.id,type:MovementType.IN,quantity:Number(dto.stock),reason:'Stock inicial'}});
      return product;
    });
  }
  update(id:string, dto:Partial<CreateProductDto>){
    const { expirationDate, stock: _stock, ...data } = dto;
    return (this.prisma as any).product.update({ where:{id}, data:{...data, ...(expirationDate !== undefined ? {expirationDate: expirationDate ? new Date(expirationDate) : null} : {})} });
  }
  async addMovement(productId:string, dto:CreateInventoryMovementDto){
    const product = await (this.prisma as any).product.findUnique({where:{id:productId}});
    if (!product) throw new BadRequestException('Producto no encontrado.');
    const quantity = Number(dto.quantity);
    let nextStock = Number(product.stock);
    if (dto.type === MovementType.IN) nextStock += quantity;
    else if (dto.type === MovementType.ADJUSTMENT) nextStock = quantity;
    else nextStock -= quantity;
    if (nextStock < 0) throw new BadRequestException('La salida supera el stock disponible.');
    return (this.prisma as any).$transaction([
      (this.prisma as any).inventoryMovement.create({data:{productId,type:dto.type,quantity,reason:dto.reason,referenceId:dto.referenceId}}),
      (this.prisma as any).product.update({where:{id:productId},data:{stock:nextStock}}),
    ]);
  }
  remove(id:string){ return (this.prisma as any).product.delete({ where:{id} }); }
}
