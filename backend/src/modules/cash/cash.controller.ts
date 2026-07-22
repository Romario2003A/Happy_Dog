import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CashService } from './cash.service';
import { CreateCashClosingDto } from './dto/create-cash-closing.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { PayReceivableDto } from './dto/pay-receivable.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST)
@Controller('cash')
export class CashController {
  constructor(private service: CashService) {}

  @Get()
  findMovements(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.findMovements(from, to);
  }

  @Get('summary')
  summary(@Query('date') date?: string) {
    return this.service.summary(date);
  }

  @Get('pending')
  pendingAppointments(@Query('date') date?: string) {
    return this.service.pendingAppointments(date);
  }

  @Get('closings')
  closings() {
    return this.service.findClosings();
  }

  @Get('receivables')
  receivables() {
    return this.service.findReceivables();
  }

  @Post('receivables')
  createReceivable(@Body() dto: CreateReceivableDto, @CurrentUser('sub') userId?: string) {
    return this.service.createReceivable(dto, userId);
  }

  @Post('receivables/:id/payments')
  payReceivable(@Param('id') id: string, @Body() dto: PayReceivableDto, @CurrentUser('sub') userId?: string) {
    return this.service.payReceivable(id, dto, userId);
  }

  @Post('movements')
  createMovement(@Body() dto: CreateCashMovementDto, @CurrentUser('sub') userId?: string) {
    return this.service.createMovement(dto, userId);
  }

  @Patch('movements/:id')
  updateMovement(@Param('id') id: string, @Body() dto: Partial<CreateCashMovementDto>) {
    return this.service.updateMovement(id, dto);
  }

  @Delete('movements/:id')
  removeMovement(@Param('id') id: string) {
    return this.service.removeMovement(id);
  }

  @Post('closing')
  closeDay(@Body() dto: CreateCashClosingDto, @CurrentUser('sub') userId?: string) {
    return this.service.closeDay(dto, userId);
  }
}
