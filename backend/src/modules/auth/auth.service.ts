import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterClientDto } from './dto/register-client.dto';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.active) throw new UnauthorizedException('Credenciales inválidas');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');
    const payload = { sub: user.id, email: user.email, role: user.role, fullName: user.fullName };
    return { accessToken: await this.jwt.signAsync(payload), user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } };
  }
  async clientLogin(dto: LoginDto) {
    const client = await this.prisma.client.findUnique({ where: { email: dto.email } });
    if (!client || !client.active || !client.passwordHash) throw new UnauthorizedException('Credenciales invalidas');
    const ok = await bcrypt.compare(dto.password, client.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales invalidas');
    const payload = { sub: client.id, email: client.email, role: 'CLIENT', fullName: client.fullName };
    return { accessToken: await this.jwt.signAsync(payload), user: { id: client.id, fullName: client.fullName, email: client.email, role: 'CLIENT' } };
  }
  async registerClient(dto: RegisterClientDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const email = dto.email.trim().toLowerCase();
    const phone = dto.phone?.replace(/\D/g, '') || undefined;
    const existingClient = await this.prisma.client.findUnique({ where: { email } });

    if (existingClient?.passwordHash) {
      throw new ConflictException('Ya existe una cuenta con este correo.');
    }

    const client = existingClient
      ? await this.prisma.client.update({
        where: { id: existingClient.id },
        data: {
          fullName: dto.fullName,
          documentNumber: dto.documentNumber,
          phone,
          email,
          passwordHash,
          address: dto.address,
          active: true,
        },
      })
      : await this.prisma.client.create({
        data: {
          fullName: dto.fullName,
          documentNumber: dto.documentNumber,
          phone,
          email,
          passwordHash,
          address: dto.address,
        },
      });
    const payload = { sub: client.id, email: client.email, role: 'CLIENT', fullName: client.fullName };
    return { accessToken: await this.jwt.signAsync(payload), user: { id: client.id, fullName: client.fullName, email: client.email, role: 'CLIENT' } };
  }
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id:true, fullName:true, email:true, role:true, active:true } });
    if (user) return user;
    const client = await this.prisma.client.findUnique({ where: { id: userId }, select: { id:true, fullName:true, email:true, active:true } });
    return client ? { ...client, role: 'CLIENT' } : null;
  }
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!ok) throw new UnauthorizedException('Contrasena actual incorrecta');
      const passwordHash = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
      return { message: 'Contrasena actualizada correctamente' };
    }

    const client = await this.prisma.client.findUnique({ where: { id: userId } });
    if (!client || !client.passwordHash) throw new NotFoundException('Usuario no encontrado');
    const ok = await bcrypt.compare(dto.currentPassword, client.passwordHash);
    if (!ok) throw new UnauthorizedException('Contrasena actual incorrecta');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.client.update({ where: { id: userId }, data: { passwordHash } });
    return { message: 'Contrasena actualizada correctamente' };
  }
}

