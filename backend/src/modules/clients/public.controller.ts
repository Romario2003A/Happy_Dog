import { Body, Controller, Post } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
@Controller('public')
export class PublicController { constructor(private prisma:PrismaService){} @Post('appointment-request') async request(@Body() body:any){ const client=await this.prisma.client.create({data:{fullName:body.fullName, phone:body.phone, email:body.email}}); const pet=await this.prisma.pet.create({data:{name:body.petName, species:body.species, breed:body.breed, clientId:client.id}}); return this.prisma.appointment.create({data:{clientId:client.id, petId:pet.id, reason:body.reason, scheduledAt:new Date(body.scheduledAt)}}); } }
