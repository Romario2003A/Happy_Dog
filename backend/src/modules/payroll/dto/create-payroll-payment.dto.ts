import { IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreatePayrollPaymentDto {
  @IsString()
  staffId: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'El periodo debe tener el formato AAAA-MM.' })
  period: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
