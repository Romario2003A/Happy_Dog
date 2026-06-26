import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
import { MedicalRecordsService } from './medical-records.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Controller('medical-records')
export class MedicalRecordsController { constructor(private service:MedicalRecordsService){} @Roles(Role.ADMIN, Role.VETERINARIAN) @Get() all(){return this.service.findAll()} @Roles(Role.ADMIN, Role.VETERINARIAN, Role.RECEPTIONIST) @Get('pet/:petId') byPet(@Param('petId') petId:string){return this.service.findByPet(petId)} @Roles(Role.ADMIN, Role.VETERINARIAN) @Post() create(@Body() dto:CreateMedicalRecordDto){return this.service.create(dto)} }
