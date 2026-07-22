import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  async create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        category: dto.category,
        unitPrice: dto.unitPrice,
        stock: dto.stock,
        minStock: dto.minStock,
      },
    });
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    await this.prisma.product.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('Producto no encontrado.');
    });
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name      !== undefined && { name:      dto.name }),
        ...(dto.sku       !== undefined && { sku:       dto.sku }),
        ...(dto.category  !== undefined && { category:  dto.category }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.stock     !== undefined && { stock:     dto.stock }),
        ...(dto.minStock  !== undefined && { minStock:  dto.minStock }),
      },
    });
  }

  remove(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
