import { ObligationRecurrence } from '@prisma/client';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateObligationDto {
  @IsString() name: string;
  @IsOptional() @IsString() payee?: string;
  @IsOptional() @IsString() category?: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsDateString() nextDueAt: string;
  @IsOptional() @IsEnum(ObligationRecurrence) recurrence?: ObligationRecurrence;
  @IsOptional() @IsString() referenceCode?: string;
  @IsOptional() @IsString() notes?: string;
}
