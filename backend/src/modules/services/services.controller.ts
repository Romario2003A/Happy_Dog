import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateServiceDto } from './dto/create-service.dto';
import { ServicesService } from './services.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST)
@Controller('services')
export class ServicesController {
  constructor(private service: ServicesService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Post()
  create(@Body() dto: CreateServiceDto) { return this.service.create(dto); }

  @Post('import-happy-dog-tariff')
  importHappyDogTariff() { return this.service.importHappyDogTariff(); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateServiceDto>) { return this.service.update(id, dto); }
}
