import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateStaffMemberDto {
  @IsString()
  fullName: string;

  @IsString()
  jobTitle: string;

  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() workSchedule?: string;
  @IsOptional() @IsString() bankAccount?: string;
  @IsOptional() @IsNumber() @Min(0) monthlySalary?: number;
  @IsOptional() @IsString() payDay?: string;
  @IsOptional() @IsString() payrollReminder?: string;
  @IsOptional() @IsString() userId?: string;
}
