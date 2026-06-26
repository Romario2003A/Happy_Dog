import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
export class CreateProductDto { @IsString() name:string; @IsOptional() @IsString() sku?:string; @IsOptional() @IsString() category?:string; @IsNumber() unitPrice:number; @IsInt() stock:number; @IsInt() minStock:number; }
