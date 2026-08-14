import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateSutureRemovalDto {
  @IsOptional()
  @IsDateString()
  sutureRemovalAt?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
