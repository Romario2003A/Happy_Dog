import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
export class CreateUserDto {
  @IsString() fullName:string;
  @IsEmail() email:string;
  @IsString() @MinLength(12) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, { message:'La contrasena debe incluir mayuscula, minuscula y numero.' }) password:string;
  @IsEnum(Role) role:Role;
  @IsOptional() @IsString() workSchedule?:string;
  @IsOptional() @IsString() bankAccount?:string;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?:number;
  @IsOptional() @IsString() payDay?:string;
  @IsOptional() @IsString() payrollReminder?:string;
}
