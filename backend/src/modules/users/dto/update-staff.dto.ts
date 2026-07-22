import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateStaffDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsString() workSchedule?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?: number;
  @IsOptional() @IsString() payDay?: string;
  @IsOptional() @IsString() payrollReminder?: string;
}
