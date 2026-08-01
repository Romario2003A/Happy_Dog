import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CLINICAL_FILE_DIR, clinicalFileUploadOptions } from '../../common/upload/clinical-file-upload';
import { PrismaService } from '../../database/prisma.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.VETERINARIAN)
@Controller('files')
export class FilesController {
  constructor(private prisma: PrismaService) {}

  @Post('medical-record/:id')
  @UseInterceptors(FileInterceptor('file', clinicalFileUploadOptions))
  async upload(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecciona un archivo clinico.');
    const signature = readFileSync(file.path).subarray(0, 8);
    const validSignature = file.mimetype === 'application/pdf'
      ? signature.subarray(0, 4).toString() === '%PDF'
      : file.mimetype === 'image/jpeg'
        ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
        : signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!validSignature) {
      unlinkSync(file.path);
      throw new BadRequestException('El contenido del archivo no coincide con su formato.');
    }
    try {
      return await this.prisma.clinicalFile.create({
        data: {
          medicalRecordId: id,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: file.filename,
        },
      });
    } catch (error) {
      if (existsSync(file.path)) unlinkSync(file.path);
      throw error;
    }
  }

  @Get(':id')
  async download(@Param('id') id: string, @Res() res: Response) {
    const file = await this.prisma.clinicalFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('Archivo clinico no encontrado.');
    const filePath = join(CLINICAL_FILE_DIR, basename(file.url));
    if (!existsSync(filePath)) throw new NotFoundException('El archivo ya no esta disponible.');
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    return res.sendFile(filePath);
  }
}
