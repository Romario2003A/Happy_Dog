import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { ClientPortalController } from './client-portal.controller';
import { PublicController } from './public.controller';
import { AppointmentsModule } from '../appointments/appointments.module';
@Module({imports:[AppointmentsModule], controllers:[ClientsController, ClientPortalController, PublicController], providers:[ClientsService, PrismaService]}) export class ClientsModule {}
