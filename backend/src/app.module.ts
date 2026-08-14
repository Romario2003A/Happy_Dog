import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { SensitiveFieldsInterceptor } from './common/interceptors/sensitive-fields.interceptor';
import { validateEnvironment } from './config/env.validation';
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
import { ServicesModule } from './modules/services/services.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { StaffModule } from './modules/staff/staff.module';
import { OperationsModule } from './modules/operations/operations.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    UsersModule,
    ClientsModule,
    PetsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    PreventiveCareModule,
    InventoryModule,
    ServicesModule,
    SalesModule,
    FilesModule,
    ReportsModule,
    CashModule,
    PayrollModule,
    StaffModule,
    OperationsModule,
  ],
  providers: [
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SensitiveFieldsInterceptor },
  ],
})
export class AppModule {}
