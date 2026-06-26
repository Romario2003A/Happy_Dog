import { IsArray, IsOptional, IsString } from 'class-validator';
export class CreateSaleDto { @IsString() clientId:string; @IsOptional() @IsString() appointmentId?:string; @IsArray() items:any[]; @IsOptional() @IsString() paymentMethod?:string; }
