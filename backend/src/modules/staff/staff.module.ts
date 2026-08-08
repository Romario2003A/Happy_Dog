import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({ controllers: [StaffController], providers: [StaffService, PrismaService] })
export class StaffModule {}
