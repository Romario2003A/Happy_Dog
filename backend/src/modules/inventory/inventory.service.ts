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

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado.');

    // Verificar si el producto tiene historial en la clínica
    // (recetas médicas, ventas o movimientos de inventario)
    const [recetas, ventas, movimientos] = await Promise.all([
      this.prisma.prescriptionItem.count({ where: { productId: id } }),
      this.prisma.saleItem.count({ where: { productId: id } }),
      this.prisma.inventoryMovement.count({ where: { productId: id } }),
    ]);

    const tieneHistorial = recetas > 0 || ventas > 0 || movimientos > 0;

    if (tieneHistorial) {
      // El producto tiene registros médicos o de ventas vinculados.
      // No se puede borrar porque rompería el historial clínico de las mascotas
      // y los registros financieros pasados. Se desactiva en su lugar.
      await this.prisma.product.update({
        where: { id },
        data: { active: false },
      });
      return {
        accion: 'desactivado',
        mensaje: `El producto "${product.name}" tiene historial en la clínica (${recetas} receta(s), ${ventas} venta(s), ${movimientos} movimiento(s)). Fue desactivado y ya no aparecerá en ventas ni recetas, pero los registros pasados se mantienen intactos.`,
      };
    }

    // El producto nunca fue usado: se elimina permanentemente
    await this.prisma.product.delete({ where: { id } });
    return {
      accion: 'eliminado',
      mensaje: `El producto "${product.name}" fue eliminado permanentemente.`,
    };
  }
}
