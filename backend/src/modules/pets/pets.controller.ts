import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { petPhotoUploadOptions, publicUploadUrl } from '../../common/upload/pet-photo-upload';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetsService } from './pets.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.RECEPTIONIST, Role.VETERINARIAN)
@Controller('pets')
export class PetsController {
  constructor(private service: PetsService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id/id-card')
  async idCard(@Param('id') id: string, @Res() res: Response) {
    const pdf = await this.service.generateIdCard(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="carnet-mascota-${id}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreatePetDto) {
    return this.service.create(dto);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', petPhotoUploadOptions))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('Selecciona una foto de la mascota.');
    const photoUrl = publicUploadUrl(req, `/uploads/pets/${file.filename}`);
    return this.service.updatePhoto(id, photoUrl);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePetDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
