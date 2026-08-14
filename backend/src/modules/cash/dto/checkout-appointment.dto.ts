import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class CheckoutProductDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CheckoutAppointmentDto {
  @IsString()
  appointmentId: string;

  @IsNumber()
  @Min(0)
  serviceAmount: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutProductDto)
  products?: CheckoutProductDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}
