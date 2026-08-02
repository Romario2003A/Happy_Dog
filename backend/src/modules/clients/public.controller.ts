import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { AppointmentStatus, PetSex } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Controller('public')
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Get('services')
  services() {
    return this.prisma.service.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        category: true,
        species: true,
        condition: true,
        price: true,
        maxPrice: true,
        socialPrice: true,
        priceLabel: true,
        requiresQuote: true,
        durationMinutes: true,
      },
    });
  }

  @Post('appointment-request')
  async request(@Body() body: any) {
    const email = String(body.email || '').trim() || undefined;
    const phone = String(body.phone || '').replace(/\D+/g, '') || undefined;
    const fullName = String(body.fullName || '').trim();
    const petName = String(body.petName || '').trim();
    const reason = String(body.reason || '').trim();
    const scheduledAt = new Date(body.scheduledAt);
    const serviceId = String(body.serviceId || '').trim();
    const service = serviceId
      ? await this.prisma.service.findFirst({ where: { id: serviceId, active: true } })
      : null;

    if (serviceId && !service) throw new BadRequestException('El servicio seleccionado ya no está disponible.');
    if (!fullName || !phone || !petName || (!reason && !service) || Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Completa nombre, WhatsApp, mascota, fecha y servicio solicitado.');
    }

    let client = await this.prisma.client.findFirst({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: { pets: true },
    });

    if (!client) {
      client = await this.prisma.client.create({
        data: {
          fullName,
          phone,
          email,
        },
        include: { pets: true },
      });
    }

    let pet = client.pets.find(item => item.name.toLowerCase() === petName.toLowerCase());

    if (!pet) {
      pet = await this.prisma.pet.create({
        data: {
          name: petName,
          species: String(body.species || '').trim() || 'No especificada',
          breed: body.breed || undefined,
          sex: Object.values(PetSex).includes(body.sex) ? body.sex : PetSex.UNKNOWN,
          age: body.age || undefined,
          weightKg: body.weightKg === '' || body.weightKg === undefined ? undefined : Number(body.weightKg),
          clientId: client.id,
        },
      });
    }

    return this.prisma.appointment.create({
      data: {
        clientId: client.id,
        petId: pet.id,
        reason,
        scheduledAt,
        status: AppointmentStatus.PENDING,
        notes: 'CLIENT_REQUESTED_DATE_ONLY',
        serviceId: service?.id,
        quotedPrice: service && !service.requiresQuote ? Number(service.price) : undefined,
        priceNote: service?.priceLabel || undefined,
        durationMinutes: service?.durationMinutes || undefined,
      },
    });
  }
}
