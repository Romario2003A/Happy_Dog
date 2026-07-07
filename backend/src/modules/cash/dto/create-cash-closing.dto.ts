import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCashClosingDto {
  @IsDateString()
  businessDate: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  openingAmount?: number;

  @IsNumber()
  @Min(0)
  countedAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
