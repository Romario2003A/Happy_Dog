import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PreventiveCareController } from './preventive-care.controller';
import { PreventiveCareService } from './preventive-care.service';
@Module({controllers:[PreventiveCareController],providers:[PreventiveCareService,PrismaService]})
export class PreventiveCareModule {}
