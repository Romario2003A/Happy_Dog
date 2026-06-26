import { IsDateString, IsOptional, IsString } from 'class-validator';
export class CreateAppointmentDto { @IsDateString() scheduledAt:string; @IsString() reason:string; @IsString() clientId:string; @IsString() petId:string; @IsOptional() @IsString() veterinarianId?:string; @IsOptional() @IsString() serviceId?:string; @IsOptional() @IsString() notes?:string; }
