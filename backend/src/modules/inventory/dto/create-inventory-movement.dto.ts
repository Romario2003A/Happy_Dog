import { MovementType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryMovementDto {
  @IsEnum(MovementType) type: MovementType;
  @IsInt() @Min(0) quantity: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() referenceId?: string;
}
