import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.service.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] });
  }

  async create(dto: CreateServiceDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Escribe el nombre del servicio.');
    const duplicate = await this.prisma.service.findUnique({ where: { name } });
    if (duplicate) throw new BadRequestException('Ya existe un servicio con ese nombre.');
    return this.prisma.service.create({
      data: { name, description: dto.description?.trim() || null, price: dto.price, active: dto.active ?? true },
    });
  }

  async update(id: string, dto: Partial<CreateServiceDto>) {
    const name = dto.name?.trim();
    if (name) {
      const duplicate = await this.prisma.service.findFirst({ where: { name, id: { not: id } } });
      if (duplicate) throw new BadRequestException('Ya existe un servicio con ese nombre.');
    }
    return this.prisma.service.update({
      where: { id },
      data: {
        name: name || undefined,
        description: dto.description === undefined ? undefined : dto.description.trim() || null,
        price: dto.price === undefined ? undefined : Number(dto.price),
        active: dto.active,
      },
    });
  }
}
