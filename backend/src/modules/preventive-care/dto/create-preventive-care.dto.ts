import { PreventiveCareType } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
export class CreatePreventiveCareDto {
  @IsEnum(PreventiveCareType) type: PreventiveCareType;
  @IsDateString() appliedAt: string;
  @IsString() productName: string;
  @IsOptional() @IsNumber() weightKg?: number;
  @IsOptional() @IsDateString() nextAppointmentAt?: string;
  @IsOptional() @IsString() notes?: string;
  @IsString() petId: string;
  @IsString() veterinarianId: string;
}
