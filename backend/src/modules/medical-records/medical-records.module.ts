import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MedicalRecordsController } from './medical-records.controller';
import { MedicalRecordsService } from './medical-records.service';
@Module({controllers:[MedicalRecordsController], providers:[MedicalRecordsService, PrismaService]}) export class MedicalRecordsModule {}
