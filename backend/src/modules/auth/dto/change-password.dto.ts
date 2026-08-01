import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  currentPassword: string;

  @IsString()
  @MinLength(12)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message: 'La contrasena debe incluir mayuscula, minuscula y numero.' })
  newPassword: string;
}
