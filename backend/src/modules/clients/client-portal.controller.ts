import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PetSex, Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { petPhotoUploadOptions, uploadedFileDataUrl } from '../../common/upload/pet-photo-upload';
import { PrismaService } from '../../database/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT)
@Controller('client-portal')
export class ClientPortalController {
  constructor(private prisma: PrismaService, private appointmentsService: AppointmentsService) {}

  @Get('me')
  me(@CurrentUser('id') clientId: string) {
    return this.prisma.client.findUnique({ where: { id: clientId }, include: { pets: true } });
  }

  @Get('pets')
  pets(@CurrentUser('id') clientId: string) {
    return this.prisma.pet.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } });
  }

  @Post('pets')
  createPet(@CurrentUser('id') clientId: string, @Body() body: any) {
    const name = String(body.name || '').trim();
    const species = String(body.species || '').trim();
    if (!name || !species) {
      throw new BadRequestException('Completa nombre y especie de la mascota.');
    }

    const weightKg = body.weightKg === '' || body.weightKg === undefined || body.weightKg === null
      ? undefined
      : Number(body.weightKg);

    if (weightKg !== undefined && Number.isNaN(weightKg)) {
      throw new BadRequestException('El peso debe ser un numero valido.');
    }

    return this.prisma.pet.create({
      data: {
        name,
        species,
        breed: String(body.breed || '').trim() || undefined,
        sex: Object.values(PetSex).includes(body.sex) ? body.sex : PetSex.UNKNOWN,
        color: String(body.color || '').trim() || undefined,
        age: String(body.age || '').trim() || undefined,
        weightKg,
        sterilized: Boolean(body.sterilized),
        clientId,
      },
    });
  }

  @Get('appointments')
  appointments(@CurrentUser('id') clientId: string) {
    return this.prisma.appointment.findMany({
      where: { clientId },
      orderBy: { scheduledAt: 'desc' },
      include: { pet: true, veterinarian: true, service: true },
    });
  }

  @Get('services')
  services() {
    return this.prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  @Post('appointments')
  async createAppointment(@CurrentUser('id') clientId: string, @Body() body: any) {
    const petId = String(body.petId || '').trim();
    const reason = String(body.reason || '').trim();
    const scheduledAt = new Date(body.scheduledAt);
    const serviceId = String(body.serviceId || '').trim();

    if (!petId || !serviceId || !reason || Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Selecciona mascota, servicio, fecha y motivo de la cita.');
    }

    const pet = await this.prisma.pet.findFirst({ where: { id: petId, clientId } });
    if (!pet) throw new NotFoundException('Mascota no encontrada.');
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, active: true } });
    if (!service) throw new NotFoundException('Servicio no disponible.');

    return this.appointmentsService.create({
      clientId,
      petId,
      serviceId,
      reason,
      scheduledAt: scheduledAt.toISOString(),
      quotedPrice: body.quotedPrice === undefined ? Number(service.price) : Number(body.quotedPrice),
      priceNote: String(body.priceNote || service.priceLabel || '').trim() || undefined,
      durationMinutes: Number(service.durationMinutes || 30),
    });
  }

  @Post('pets/:id/photo')
  @UseInterceptors(FileInterceptor('photo', petPhotoUploadOptions))
  async uploadPetPhoto(
    @CurrentUser('id') clientId: string,
    @Param('id') petId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Selecciona una foto de la mascota.');
    const pet = await this.prisma.pet.findFirst({ where: { id: petId, clientId } });
    if (!pet) throw new NotFoundException('Mascota no encontrada.');
    const photoUrl = uploadedFileDataUrl(file);
    return this.prisma.pet.update({ where: { id: petId }, data: { photoUrl } });
  }
}
