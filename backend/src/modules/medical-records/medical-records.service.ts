import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus, MovementType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateMedicalRecordDto } from './dto/create-medical-record.dto';
@Injectable()
export class MedicalRecordsService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return this.prisma.medicalRecord.findMany({ include:{ pet:{include:{client:true}}, veterinarian:true, prescriptions:{include:{product:true}}, files:true }, orderBy:{visitDate:'desc'} }); }
  findByPet(petId:string){ return this.prisma.medicalRecord.findMany({ where:{petId}, include:{veterinarian:true, prescriptions:{include:{product:true}}, files:true}, orderBy:{visitDate:'desc'} }); }
  async create(dto:CreateMedicalRecordDto){
    return this.prisma.$transaction(async tx => {
      let appointmentId = dto.appointmentId;
      if (!appointmentId) {
        const pet = await tx.pet.findUnique({ where:{ id:dto.petId }, select:{ clientId:true } });
        if (!pet) throw new BadRequestException('Paciente no encontrado');
        const directAppointment = await tx.appointment.create({
          data:{
            scheduledAt:new Date(), reason:dto.reason, status:AppointmentStatus.ATTENDED,
            clientId:pet.clientId, petId:dto.petId, veterinarianId:dto.veterinarianId,
            notes:'Atención directa registrada por el veterinario',
          },
        });
        appointmentId = directAppointment.id;
      }
      for (const item of dto.prescriptions ?? []) {
        const product = await tx.product.findUnique({ where:{ id:item.productId } });
        if (!product) throw new BadRequestException('Producto no encontrado');
        if (product.stock < item.quantity) throw new BadRequestException(`Stock insuficiente: ${product.name}`);
      }
      const record = await tx.medicalRecord.create({ data:{ appointmentId, petId:dto.petId, veterinarianId:dto.veterinarianId, reason:dto.reason, weightKg:dto.weightKg, temperatureC:dto.temperatureC, diagnosis:dto.diagnosis, treatment:dto.treatment, observations:dto.observations, nextControlAt:dto.nextControlAt ? new Date(dto.nextControlAt) : undefined, prescriptions:{ create:(dto.prescriptions ?? []).map(i=>({productId:i.productId, quantity:i.quantity, dosage:i.dosage, instructions:i.instructions})) } }, include:{ prescriptions:true } });
      if (dto.weightKg !== undefined) {
        await tx.pet.update({ where:{ id:dto.petId }, data:{ weightKg:dto.weightKg } });
      }
      for (const item of dto.prescriptions ?? []) {
        await tx.product.update({ where:{ id:item.productId }, data:{ stock:{ decrement:item.quantity } } });
        await tx.inventoryMovement.create({ data:{ productId:item.productId, type:MovementType.PRESCRIPTION, quantity:-item.quantity, reason:'Receta médica', referenceId:record.id } });
      }
      if (dto.appointmentId) await tx.appointment.update({ where:{ id:dto.appointmentId }, data:{ status: AppointmentStatus.ATTENDED } });
      return record;
    });
  }
}
