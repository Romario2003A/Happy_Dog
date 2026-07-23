import { PreventiveCareType } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
export class CreatePreventiveCareDto {
  @IsEnum(PreventiveCareType) type: PreventiveCareType;
  @IsDateString() appliedAt: string;
  @IsString() productName: string;
  @IsOptional() @IsString() nextProductName?: string;
  @IsOptional() @IsNumber() weightKg?: number;
  @IsOptional() @IsNumber() amountCharged?: number;
  @IsOptional() @IsDateString() nextAppointmentAt?: string;
  @IsOptional() @IsBoolean() sterilizationRecommended?: boolean;
  @IsOptional() @IsBoolean() dewormed?: boolean;
  @IsOptional() @IsBoolean() followUpCalled?: boolean;
  @IsOptional() @IsBoolean() sterilizationCallDone?: boolean;
  @IsOptional() @IsString() notes?: string;
  @IsString() petId: string;
  @IsString() veterinarianId: string;
}
