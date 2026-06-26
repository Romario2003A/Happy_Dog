import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { PetSex } from '@prisma/client';
export class CreatePetDto { @IsString() name:string; @IsString() species:string; @IsOptional() @IsString() breed?:string; @IsOptional() @IsEnum(PetSex) sex?:PetSex; @IsOptional() @IsString() color?:string; @IsOptional() @IsString() age?:string; @IsOptional() @IsNumber() weightKg?:number; @IsOptional() @IsBoolean() sterilized?:boolean; @IsString() clientId:string; }
