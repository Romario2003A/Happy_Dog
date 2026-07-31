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
    const quantity = Number(dto.quantity);
    if(!Number.isInteger(quantity) || quantity<0 || (dto.type!==MovementType.ADJUSTMENT && quantity===0)){
      throw new BadRequestException(dto.type===MovementType.ADJUSTMENT
        ? 'El conteo físico debe ser un número entero igual o mayor a cero.'
        : 'La cantidad debe ser un número entero mayor a cero.');
    }
    return (this.prisma as any).$transaction(async (tx:any) => {
      const product = await tx.product.findUnique({where:{id:productId}});
      if (!product) throw new BadRequestException('Producto no encontrado.');

      if(dto.type===MovementType.OUT || dto.type===MovementType.SALE || dto.type===MovementType.PRESCRIPTION){
        const updated=await tx.product.updateMany({
          where:{id:productId,stock:{gte:quantity}},
          data:{stock:{decrement:quantity}},
        });
        if(updated.count!==1) throw new BadRequestException('La salida supera el stock disponible.');
      }else if(dto.type===MovementType.IN){
        await tx.product.update({where:{id:productId},data:{stock:{increment:quantity}}});
      }else{
        await tx.product.update({where:{id:productId},data:{stock:quantity}});
      }

      return tx.inventoryMovement.create({data:{productId,type:dto.type,quantity,reason:dto.reason,referenceId:dto.referenceId}});
    });
  }
  remove(id:string){ return (this.prisma as any).product.delete({ where:{id} }); }
}
