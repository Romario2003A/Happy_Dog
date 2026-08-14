import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateObligationDto } from './dto/create-obligation.dto';
import { PayObligationDto } from './dto/pay-obligation.dto';
import { UpdateObligationDto } from './dto/update-obligation.dto';
import { OperationsService } from './operations.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.VETERINARIAN)
@Controller('operations')
export class OperationsController {
  constructor(private service: OperationsService) {}

  @Get('center')
  center(@Query('days') days?: string) { return this.service.center(Number(days || 30)); }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('obligations')
  createObligation(@Body() dto: CreateObligationDto) { return this.service.createObligation(dto); }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch('obligations/:id')
  updateObligation(@Param('id') id: string, @Body() dto: UpdateObligationDto) { return this.service.updateObligation(id, dto); }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Post('obligations/:id/pay')
  payObligation(@Param('id') id: string, @Body() dto: PayObligationDto, @CurrentUser('id') userId?: string) {
    return this.service.payObligation(id, dto, userId);
  }

  @Roles(Role.ADMIN, Role.RECEPTIONIST)
  @Patch('appointments/:id/picked-up')
  pickedUp(@Param('id') id: string) { return this.service.markPickedUp(id); }

  @Roles(Role.ADMIN, Role.RECEPTIONIST, Role.VETERINARIAN)
  @Patch('preventive/:id/call')
  preventiveCall(@Param('id') id: string, @Body('kind') kind: 'FOLLOW_UP' | 'STERILIZATION') {
    return this.service.markPreventiveCall(id, kind);
  }
}
