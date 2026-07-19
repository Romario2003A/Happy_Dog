import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './database/prisma.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { PetsModule } from './modules/pets/pets.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { FilesModule } from './modules/files/files.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CashModule } from './modules/cash/cash.module';
import { PreventiveCareModule } from './modules/preventive-care/preventive-care.module';

@Module({ imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, UsersModule, ClientsModule, PetsModule, AppointmentsModule, MedicalRecordsModule, PreventiveCareModule, InventoryModule, SalesModule, FilesModule, ReportsModule, CashModule], providers: [PrismaService] })
export class AppModule {}
