import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() species?: string;
  @IsOptional() @IsString() condition?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional() @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @IsNumber() @Min(0) socialPrice?: number;
  @IsOptional() @IsString() priceLabel?: string;
  @IsOptional() @IsBoolean() requiresQuote?: boolean;
  @IsOptional() @IsNumber() @Min(5) durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
