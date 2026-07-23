import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateInventoryMovementDto } from './dto/create-inventory-movement.dto';
import { InventoryService } from './inventory.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.VETERINARIAN) @Controller('inventory')
export class InventoryController {
  constructor(private service: InventoryService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id/movements') movements(@Param('id') id: string) { return this.service.findMovements(id); }
  @Post(':id/movements') addMovement(@Param('id') id: string, @Body() dto: CreateInventoryMovementDto) { return this.service.addMovement(id, dto); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateProductDto) { return this.service.create(dto); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
