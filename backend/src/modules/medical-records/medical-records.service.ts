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
      for (const item of dto.prescriptions ?? []) {
        const product = await tx.product.findUnique({ where:{ id:item.productId } });
        if (!product) throw new BadRequestException('Producto no encontrado');
        if (product.stock < item.quantity) throw new BadRequestException(`Stock insuficiente: ${product.name}`);
      }
      const record = await tx.medicalRecord.create({ data:{ appointmentId:dto.appointmentId, petId:dto.petId, veterinarianId:dto.veterinarianId, reason:dto.reason, weightKg:dto.weightKg, temperatureC:dto.temperatureC, diagnosis:dto.diagnosis, treatment:dto.treatment, observations:dto.observations, nextControlAt:dto.nextControlAt ? new Date(dto.nextControlAt) : undefined, prescriptions:{ create:(dto.prescriptions ?? []).map(i=>({productId:i.productId, quantity:i.quantity, dosage:i.dosage, instructions:i.instructions})) } }, include:{ prescriptions:true } });
      for (const item of dto.prescriptions ?? []) {
        await tx.product.update({ where:{ id:item.productId }, data:{ stock:{ decrement:item.quantity } } });
        await tx.inventoryMovement.create({ data:{ productId:item.productId, type:MovementType.PRESCRIPTION, quantity:-item.quantity, reason:'Receta médica', referenceId:record.id } });
      }
      await tx.appointment.update({ where:{ id:dto.appointmentId }, data:{ status: AppointmentStatus.ATTENDED } });
      return record;
    });
  }
}
