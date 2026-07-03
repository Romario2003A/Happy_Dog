import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../database/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterClientDto } from './dto/register-client.dto';
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}
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
  googleClientUrl() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const redirectUri = this.googleCallbackUrl();
    if (!clientId) throw new BadRequestException('Google Login aun no esta configurado.');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  async googleClientLogin(code: string) {
    if (!code) throw new BadRequestException('Google no envio codigo de acceso.');
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.googleCallbackUrl();
    if (!clientId || !clientSecret) throw new BadRequestException('Google Login aun no esta configurado.');

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenResponse.ok) throw new UnauthorizedException('No se pudo validar la cuenta de Google.');
    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) throw new UnauthorizedException('Google no devolvio acceso valido.');

    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!profileResponse.ok) throw new UnauthorizedException('No se pudo leer el perfil de Google.');
    const profile = await profileResponse.json() as { email?: string; email_verified?: boolean; name?: string };
    const email = String(profile.email || '').trim().toLowerCase();
    if (!email || !profile.email_verified) throw new UnauthorizedException('Google no confirmo el correo del cliente.');

    const fullName = String(profile.name || email.split('@')[0] || 'Cliente Happy Dog').trim();
    const existingClient = await this.prisma.client.findUnique({ where: { email } });
    const client = existingClient
      ? await this.prisma.client.update({
        where: { id: existingClient.id },
        data: { fullName: existingClient.fullName || fullName, active: true },
      })
      : await this.prisma.client.create({
        data: { fullName, email, active: true },
      });

    const payload = { sub: client.id, email: client.email, role: 'CLIENT', fullName: client.fullName };
    return { accessToken: await this.jwt.signAsync(payload), user: { id: client.id, fullName: client.fullName, email: client.email, role: 'CLIENT' } };
  }
  frontendGoogleRedirect(data: { accessToken: string; user: any }) {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || this.config.get<string>('CORS_ORIGIN')?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '');
    const params = new URLSearchParams({
      googleToken: data.accessToken,
      googleUser: JSON.stringify(data.user),
    });
    return `${frontendUrl}/cliente/login?${params.toString()}`;
  }
  frontendGoogleErrorRedirect(message: string) {
    const frontendUrl = (this.config.get<string>('FRONTEND_URL') || this.config.get<string>('CORS_ORIGIN')?.split(',')[0] || 'http://localhost:5173').replace(/\/$/, '');
    const params = new URLSearchParams({ googleError: message });
    return `${frontendUrl}/cliente/login?${params.toString()}`;
  }
  private googleCallbackUrl() {
    return this.config.get<string>('GOOGLE_CALLBACK_URL') || `${this.config.get<string>('BACKEND_URL') || 'http://localhost:3000'}/api/auth/client/google/callback`;
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

