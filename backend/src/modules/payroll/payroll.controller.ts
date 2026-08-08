import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreatePayrollPaymentDto } from './dto/create-payroll-payment.dto';
import { PayPayrollPaymentDto } from './dto/pay-payroll-payment.dto';
import { PayrollService } from './payroll.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}

  @Get()
  findAll(@Query('period') period?: string) {
    return this.service.findAll(period);
  }

  @Post()
  create(@Body() dto: CreatePayrollPaymentDto, @CurrentUser('id') userId?: string) {
    return this.service.create(dto, userId);
  }

  @Patch(':id/pay')
  pay(@Param('id') id: string, @Body() dto: PayPayrollPaymentDto, @CurrentUser('id') userId?: string) {
    return this.service.pay(id, dto, userId);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
