import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterClientDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  address?: string;
}
