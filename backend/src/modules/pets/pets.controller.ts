import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetsService } from './pets.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.VETERINARIAN) @Controller('pets')
export class PetsController { constructor(private service:PetsService){} @Get() findAll(){return this.service.findAll()} @Get(':id') findOne(@Param('id') id:string){return this.service.findOne(id)} @Post() create(@Body() dto:CreatePetDto){return this.service.create(dto)} @Patch(':id') update(@Param('id') id:string,@Body() dto:Partial<CreatePetDto>){return this.service.update(id,dto)} @Delete(':id') remove(@Param('id') id:string){return this.service.remove(id)} }
