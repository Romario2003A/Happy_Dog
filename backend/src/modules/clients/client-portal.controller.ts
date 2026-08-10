import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PetSex } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientAccountGuard } from '../../common/guards/client-account.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { petPhotoUploadOptions, uploadedFileDataUrl } from '../../common/upload/pet-photo-upload';
import { PrismaService } from '../../database/prisma.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { clientServiceOptions, suggestClientAppointmentService } from './client-appointment-service';

@UseGuards(JwtAuthGuard, ClientAccountGuard)
@Controller('client-portal')
export class ClientPortalController {
  constructor(private prisma: PrismaService, private appointmentsService: AppointmentsService) {}

  @Get('me')
  me(@CurrentUser('id') clientId: string) {
    return this.prisma.client.findUnique({ where: { id: clientId }, include: { pets: true } });
  }

  @Patch('me')
  updateMe(@CurrentUser('id') clientId: string, @Body() body: any) {
    const phone = String(body.phone || '').replace(/\D+/g, '');
    if (!/^9\d{8}$/.test(phone)) {
      throw new BadRequestException('Ingresa un celular peruano válido de 9 dígitos.');
    }
    return this.prisma.client.update({ where: { id: clientId }, data: { phone } });
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

  @Get('service-options')
  async serviceOptions() {
    const services = await this.prisma.service.findMany({
      where: { active: true },
      select: { id: true, name: true, category: true, condition: true },
    });
    return clientServiceOptions(services);
  }

  @Post('appointments')
  async createAppointment(@CurrentUser('id') clientId: string, @Body() body: any) {
    const petId = String(body.petId || '').trim();
    const reason = String(body.reason || '').trim();
    const scheduledAt = new Date(body.scheduledAt);
    const serviceId = String(body.serviceId || '').trim();
    const requestType = String(body.requestType || '').trim().toUpperCase();
    const requestSubtype = String(body.requestSubtype || '').trim().toUpperCase();
    const requestedServiceName = String(body.serviceName || '').trim().slice(0, 160);
    const allowedRequestTypes = new Set(['MEDICAL', 'VACCINE', 'GROOMING', 'SURGERY', 'LABORATORY', 'IMAGING', 'TREATMENT', 'OTHER']);
    const weightEstimate = Number(body.weightEstimate);

    if (!petId || !reason || Number.isNaN(scheduledAt.getTime()) || (!serviceId && !allowedRequestTypes.has(requestType))) {
      throw new BadRequestException('Selecciona mascota, tipo de atención y fecha para solicitar la cita.');
    }

    const pet = await this.prisma.pet.findFirst({ where: { id: petId, clientId } });
    if (!pet) throw new NotFoundException('Mascota no encontrada.');
    let service = serviceId
      ? await this.prisma.service.findFirst({ where: { id: serviceId, active: true } })
      : null;
    if (serviceId && !service) throw new NotFoundException('Servicio no disponible.');
    const effectiveWeight = Number(pet.weightKg) > 0
      ? Number(pet.weightKg)
      : Number.isFinite(weightEstimate) && weightEstimate > 0 ? weightEstimate : undefined;
    if (!service && requestType !== 'OTHER') {
      const activeServices = await this.prisma.service.findMany({ where: { active: true } });
      service = suggestClientAppointmentService(activeServices, requestType, requestSubtype, effectiveWeight, requestedServiceName);
    }

    const notes = [
      'CLIENT_REQUESTED_DATE_ONLY',
      requestType ? `CLIENT_REQUEST_TYPE:${requestType}` : '',
      requestSubtype ? `CLIENT_REQUEST_SUBTYPE:${requestSubtype}` : '',
      requestedServiceName ? `CLIENT_REQUESTED_SERVICE:${requestedServiceName}` : '',
      Number.isFinite(weightEstimate) && weightEstimate > 0 ? `CLIENT_WEIGHT_ESTIMATE:${weightEstimate}` : '',
      service && !serviceId ? 'CLIENT_SERVICE_AUTO_ASSIGNED' : '',
      !service ? 'CLIENT_SERVICE_REVIEW_REQUIRED' : '',
    ].filter(Boolean).join(';');

    return this.appointmentsService.create({
      clientId,
      petId,
      ...(service ? { serviceId: service.id } : {}),
      reason,
      scheduledAt: scheduledAt.toISOString(),
      ...(service ? {
        quotedPrice: Number(service.price),
        priceNote: String(service.priceLabel || '').trim() || undefined,
        durationMinutes: Number(service.durationMinutes || 30),
      } : {}),
      notes,
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
