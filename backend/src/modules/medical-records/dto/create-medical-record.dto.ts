import { IsArray, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';
export class CreateMedicalRecordDto {
  @IsOptional() @IsString() appointmentId?:string; @IsString() petId:string; @IsString() veterinarianId:string; @IsString() reason:string; @IsOptional() @IsNumber() weightKg?:number; @IsOptional() @IsNumber() temperatureC?:number; @IsString() diagnosis:string; @IsOptional() @IsString() treatment?:string; @IsOptional() @IsString() observations?:string; @IsOptional() @IsDateString() nextControlAt?:string; @IsOptional() @IsArray() prescriptions?: { productId:string; quantity:number; dosage?:string; instructions?:string }[];
}
