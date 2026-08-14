import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { StaffService } from './staff.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('staff')
export class StaffController {
  constructor(private service: StaffService) {}

  @Get()
  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  findAll() { return this.service.findAll(); }

  @Post()
  create(@Body() dto: CreateStaffMemberDto) { return this.service.create(dto); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStaffMemberDto) { return this.service.update(id, dto); }

  @Patch(':id/active')
  active(@Param('id') id: string, @Body('active') active: boolean) { return this.service.setActive(id, active); }
}
