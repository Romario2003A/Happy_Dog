import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';

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
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message: 'La contrasena debe incluir mayuscula, minuscula y numero.' })
  password: string;

  @IsOptional()
  @IsString()
  address?: string;
}
