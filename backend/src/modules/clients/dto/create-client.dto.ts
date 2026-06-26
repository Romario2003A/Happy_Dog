import { IsEmail, IsOptional, IsString } from 'class-validator';
export class CreateClientDto { @IsString() fullName:string; @IsOptional() @IsString() documentNumber?:string; @IsOptional() @IsString() phone?:string; @IsOptional() @IsEmail() email?:string; @IsOptional() @IsString() address?:string; }
