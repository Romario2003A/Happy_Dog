import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return (this.prisma as any).client.findMany({ orderBy:{createdAt:'desc'}, include: { pets:true } }); }
  findOne(id:string){ return (this.prisma as any).client.findUnique({ where:{id}, include: { pets:true } }); }
  async create(dto:CreateClientDto){
    const phone = String(dto.phone || '').replace(/\D/g, '') || undefined;
    const documentNumber = String(dto.documentNumber || '').replace(/\s/g, '') || undefined;
    const email = String(dto.email || '').trim().toLowerCase() || undefined;
    const identifiers = [
      ...(phone ? [{ phone }] : []),
      ...(documentNumber ? [{ documentNumber }] : []),
      ...(email ? [{ email: { equals: email, mode: 'insensitive' } }] : []),
    ];

    if (identifiers.length) {
      const existing = await (this.prisma as any).client.findFirst({ where: { OR: identifiers }, select: { id: true } });
      if (existing) {
        throw new ConflictException('Este teléfono, DNI o correo ya pertenece a un cliente registrado.');
      }
    }

    return (this.prisma as any).client.create({
      data: {
        ...dto,
        fullName: dto.fullName.trim(),
        phone,
        documentNumber,
        email,
      } as any,
    });
  }
  update(id:string, dto:Partial<CreateClientDto>){ return (this.prisma as any).client.update({ where:{id}, data:dto as any }); }
  remove(id: string) {
    return (this.prisma as any).$transaction(async (tx: any) => {
      const client = await tx.client.findUnique({
        where: { id },
        select: {
          id: true,
          pets: { select: { id: true } },
          appointments: { select: { id: true } },
          sales: { select: { id: true } },
        },
      });
      if (!client) throw new NotFoundException('Cliente no encontrado.');

      const petIds = client.pets.map((pet: { id: string }) => pet.id);
      const appointmentIds = client.appointments.map((appointment: { id: string }) => appointment.id);

      if (appointmentIds.length || petIds.length) {
        await tx.medicalRecord.deleteMany({
          where: {
            OR: [
              ...(appointmentIds.length ? [{ appointmentId: { in: appointmentIds } }] : []),
              ...(petIds.length ? [{ petId: { in: petIds } }] : []),
            ],
          },
        });
      }
      await tx.sale.deleteMany({ where: { clientId: id } });
      await tx.appointment.deleteMany({ where: { clientId: id } });
      await tx.pet.deleteMany({ where: { clientId: id } });
      await tx.client.delete({ where: { id } });

      return {
        deleted: true,
        clientId: id,
        pets: petIds.length,
        appointments: appointmentIds.length,
        sales: client.sales.length,
      };
    });
  }
}
