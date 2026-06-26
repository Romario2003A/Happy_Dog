import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { PrismaService } from '../../database/prisma.service';
@Module({controllers:[FilesController], providers:[PrismaService]}) export class FilesModule {}
