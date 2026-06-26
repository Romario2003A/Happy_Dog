import { Controller, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../database/prisma.service';
@UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.ADMIN, Role.VETERINARIAN) @Controller('files')
export class FilesController { constructor(private prisma:PrismaService){} @Post('medical-record/:id') @UseInterceptors(FileInterceptor('file',{storage:diskStorage({destination:'uploads',filename:(req,file,cb)=>cb(null,`${Date.now()}-${Math.round(Math.random()*1e9)}${extname(file.originalname)}`)})})) async upload(@Param('id') id:string,@UploadedFile() file:Express.Multer.File){ return this.prisma.clinicalFile.create({data:{medicalRecordId:id, originalName:file.originalname, mimeType:file.mimetype, size:file.size, url:`/uploads/${file.filename}`}}); } }
