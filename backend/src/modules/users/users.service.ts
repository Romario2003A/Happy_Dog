import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}
  findAll(){ return this.prisma.user.findMany({ select:{id:true, fullName:true, email:true, role:true, active:true, createdAt:true}, orderBy:{createdAt:'desc'} }); }
  async create(dto: CreateUserDto){ const passwordHash = await bcrypt.hash(dto.password, 10); return this.prisma.user.create({ data:{ fullName:dto.fullName, email:dto.email, passwordHash, role:dto.role }, select:{id:true, fullName:true, email:true, role:true, active:true} }); }
  setActive(id:string, active:boolean){ return this.prisma.user.update({ where:{id}, data:{active}, select:{id:true, fullName:true, email:true, role:true, active:true} }); }
}
