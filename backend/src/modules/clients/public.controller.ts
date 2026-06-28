import { Body, Controller, Post } from '@nestjs/common';
import { AppointmentStatus, PetSex } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Controller('public')
export class PublicController {
  constructor(private prisma: PrismaService) {}

  @Post('appointment-request')
  async request(@Body() body: any) {
    const email = String(body.email || '').trim() || undefined;
    const phone = String(body.phone || '').trim() || undefined;
    const petName = String(body.petName || '').trim();

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
          fullName: body.fullName,
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
          species: body.species,
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
        reason: body.reason,
        scheduledAt: new Date(body.scheduledAt),
        status: AppointmentStatus.PENDING,
      },
    });
  }
}
