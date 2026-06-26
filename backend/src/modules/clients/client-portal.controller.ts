import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT)
@Controller('client-portal')
export class ClientPortalController {
  constructor(private prisma: PrismaService) {}

  @Get('me')
  me(@CurrentUser('id') clientId: string) {
    return this.prisma.client.findUnique({ where: { id: clientId }, include: { pets: true } });
  }

  @Get('pets')
  pets(@CurrentUser('id') clientId: string) {
    return this.prisma.pet.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  @Get('appointments')
  appointments(@CurrentUser('id') clientId: string) {
    return this.prisma.appointment.findMany({
      where: { clientId },
      orderBy: { scheduledAt: 'desc' },
      include: { pet: true, veterinarian: true, service: true },
    });
  }
}
