import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus, MovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';

@Injectable()
export class MedicalRecordsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.medicalRecord.findMany({
      include: { pet: { include: { client: true } }, veterinarian: true, prescriptions: { include: { product: true } }, files: true },
      orderBy: { visitDate: 'desc' },
    });
  }

  findByPet(petId: string) {
    return this.prisma.medicalRecord.findMany({
      where: { petId },
      include: { veterinarian: true, prescriptions: { include: { product: true } }, files: true },
      orderBy: { visitDate: 'desc' },
    });
  }

  async create(dto: CreateMedicalRecordDto) {
    return this.prisma.$transaction(async (tx) => {
      // --- Pre-check: validate stock before creating any record ---
      for (const item of dto.prescriptions ?? []) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) throw new BadRequestException('Producto no encontrado.');
        if (product.stock <= 0) throw new BadRequestException(`Sin stock: ${product.name}.`);
        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Stock insuficiente: ${product.name} (disponible: ${product.stock}, solicitado: ${item.quantity}).`,
          );
        }
      }

      // --- Create medical record ---
      const record = await tx.medicalRecord.create({
        data: {
          appointmentId: dto.appointmentId,
          petId: dto.petId,
          veterinarianId: dto.veterinarianId,
          reason: dto.reason,
          weightKg: dto.weightKg,
          temperatureC: dto.temperatureC,
          diagnosis: dto.diagnosis,
          treatment: dto.treatment,
          observations: dto.observations,
          nextControlAt: dto.nextControlAt ? new Date(dto.nextControlAt) : undefined,
          prescriptions: {
            create: (dto.prescriptions ?? []).map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              dosage: i.dosage,
              instructions: i.instructions,
            })),
          },
        },
        include: { prescriptions: true },
      });

      // --- Update pet weight if provided ---
      if (dto.weightKg !== undefined) {
        await tx.pet.update({ where: { id: dto.petId }, data: { weightKg: dto.weightKg } });
      }

      // --- Atomic stock decrement ---
      // Uses updateMany with a WHERE stock >= quantity condition.
      // If another concurrent request already consumed the stock, the count will be 0
      // and we throw before any further changes, keeping the transaction consistent.
      for (const item of dto.prescriptions ?? []) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });

        if (updated.count === 0) {
          // Stock was taken by a concurrent request between pre-check and decrement.
          throw new BadRequestException(
            `Stock insuficiente al intentar descontar "${item.productId}". ` +
            `Otro proceso redujo el stock disponible. Revisa el inventario e intenta nuevamente.`,
          );
        }

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: MovementType.PRESCRIPTION,
            quantity: -item.quantity,
            reason: 'Receta médica',
            referenceId: record.id,
          },
        });
      }

      // --- Mark appointment as attended ---
      await tx.appointment.update({
        where: { id: dto.appointmentId },
        data: { status: AppointmentStatus.ATTENDED },
      });

      return record;
    });
  }
}
