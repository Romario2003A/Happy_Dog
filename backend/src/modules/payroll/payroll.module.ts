import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({ controllers: [PayrollController], providers: [PayrollService, PrismaService] })
export class PayrollModule {}
