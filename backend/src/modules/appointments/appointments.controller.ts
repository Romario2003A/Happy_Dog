import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { AppointmentsService } from './appointments.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.VETERINARIAN) @Controller('appointments')
export class AppointmentsController {
  constructor(private service:AppointmentsService){}

  @Get()
  findAll(){return this.service.findAll()}

  @Get(':id')
  findOne(@Param('id') id:string){return this.service.findOne(id)}

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post()
  create(@Body() dto:CreateAppointmentDto){return this.service.create(dto)}

  @Patch(':id')
  update(@Param('id') id:string,@Body() dto:UpdateAppointmentDto,@CurrentUser('role') role:Role){
    return this.service.update(id,dto,role);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id:string){return this.service.remove(id)}
}
