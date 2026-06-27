import { Body, Controller, Post } from '@nestjs/common';
import { PetSex } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
@Controller('public')
export class PublicController { constructor(private prisma:PrismaService){} @Post('appointment-request') async request(@Body() body:any){ const client=await this.prisma.client.create({data:{fullName:body.fullName, phone:body.phone, email:body.email || undefined}}); const pet=await this.prisma.pet.create({data:{name:body.petName, species:body.species, breed:body.breed || undefined, sex:Object.values(PetSex).includes(body.sex) ? body.sex : PetSex.UNKNOWN, age:body.age || undefined, weightKg:body.weightKg === '' || body.weightKg === undefined ? undefined : Number(body.weightKg), clientId:client.id}}); return this.prisma.appointment.create({data:{clientId:client.id, petId:pet.id, reason:body.reason, scheduledAt:new Date(body.scheduledAt)}}); } }
