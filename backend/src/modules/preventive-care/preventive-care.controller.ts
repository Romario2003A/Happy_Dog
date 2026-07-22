import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePreventiveCareDto } from './dto/create-preventive-care.dto';
import { PreventiveCareService } from './preventive-care.service';
@UseGuards(JwtAuthGuard,RolesGuard) @Controller('preventive-care')
export class PreventiveCareController {
  constructor(private service:PreventiveCareService){}
  @Roles(Role.ADMIN,Role.VETERINARIAN,Role.RECEPTIONIST) @Get('follow-ups') followUps(){return this.service.findFollowUps()}
  @Roles(Role.ADMIN,Role.VETERINARIAN,Role.RECEPTIONIST) @Get('pet/:petId') byPet(@Param('petId') petId:string){return this.service.findByPet(petId)}
  @Roles(Role.ADMIN,Role.VETERINARIAN) @Post() create(@Body() dto:CreatePreventiveCareDto){return this.service.create(dto)}
  @Roles(Role.ADMIN,Role.VETERINARIAN) @Delete(':id') remove(@Param('id') id:string){return this.service.remove(id)}
}
