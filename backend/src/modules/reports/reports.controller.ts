import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST)
@Controller('reports')
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  @Get('summary')
  async summary() {
    const [clients, pets, appointments, products, lowStock] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.pet.count(),
      this.prisma.appointment.count(),
      this.prisma.product.count(),
      this.prisma.product.count({ where: { stock: { lte: 0 } } }),
    ]);

    return { clients, pets, appointments, products, lowStock };
  }
}
