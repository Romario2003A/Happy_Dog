import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
export class CreateUserDto {
  @IsString() fullName:string;
  @IsEmail() email:string;
  @IsString() @MinLength(6) password:string;
  @IsEnum(Role) role:Role;
  @IsOptional() @IsString() workSchedule?:string;
  @IsOptional() @IsString() bankAccount?:string;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?:number;
  @IsOptional() @IsString() payDay?:string;
  @IsOptional() @IsString() payrollReminder?:string;
}
