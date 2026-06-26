import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { SalesService } from './sales.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.RECEPTIONIST) @Controller('sales')
export class SalesController { constructor(private service:SalesService){} @Get() findAll(){return this.service.findAll()} @Get(':id') findOne(@Param('id') id:string){return this.service.findOne(id)} @Post() create(@Body() dto:CreateSaleDto){return this.service.create(dto)} @Patch(':id') update(@Param('id') id:string,@Body() dto:Partial<CreateSaleDto>){return this.service.update(id,dto)} @Delete(':id') remove(@Param('id') id:string){return this.service.remove(id)} }
