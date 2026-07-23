import { IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString() name: string;
  @IsOptional() @IsString() sku?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() presentation?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsDateString() expirationDate?: string | null;
  @IsOptional() @IsNumber() @Min(0) purchasePrice?: number | null;
  @IsNumber() @Min(0) unitPrice: number;
  @IsInt() @Min(0) stock: number;
  @IsInt() @Min(0) minStock: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
