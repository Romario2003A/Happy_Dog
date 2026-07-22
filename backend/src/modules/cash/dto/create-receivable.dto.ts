import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateReceivableDto {
  @IsString()
  clientId: string;

  @IsOptional()
  @IsString()
  petId?: string;

  @IsOptional()
  @IsString()
  appointmentId?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  total: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPayment?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;
}
