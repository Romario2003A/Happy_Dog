import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { petPhotoUploadOptions, uploadedFileDataUrl } from '../../common/upload/pet-photo-upload';
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

  @Post('id-cards-batch')
  async idCardsBatch(@Body('petIds') petIds: string[], @Res() res: Response) {
    if (!Array.isArray(petIds) || !petIds.length) {
      throw new BadRequestException('Selecciona al menos una mascota.');
    }
    const pdf = await this.service.generateIdCards(petIds);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="carnets-happy-dog.pdf"');
    res.setHeader('Content-Length', pdf.length);
    res.end(pdf);
  }

  @Post('mark-cards-printed')
  markCardsPrinted(@Body('petIds') petIds: string[], @Req() req: Request) {
    if (!Array.isArray(petIds) || !petIds.length) {
      throw new BadRequestException('Selecciona al menos una mascota.');
    }
    const user = (req as any).user;
    return this.service.markCardsPrinted(petIds, user?.fullName || user?.email || 'Usuario Happy Dog');
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
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Selecciona una foto de la mascota.');
    const photoUrl = uploadedFileDataUrl(file);
    return this.service.updatePhoto(id, photoUrl);
  }

  @Post(':id/request-card-reprint')
  requestCardReprint(@Param('id') id: string) {
    return this.service.requestCardReprint(id);
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
