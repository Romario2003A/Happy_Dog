import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../database/prisma.service';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private prisma: PrismaService) {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: config.getOrThrow<string>('JWT_SECRET') });
  }
  async validate(payload: any) {
    const account = payload.role === 'CLIENT'
      ? await this.prisma.client.findUnique({ where: { id: payload.sub }, select: { active: true } })
      : await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { active: true, role: true } });
    if (!account?.active || ('role' in account && account.role !== payload.role)) {
      throw new UnauthorizedException('La sesion ya no es valida.');
    }
    return { id: payload.sub, email: payload.email, role: payload.role, fullName: payload.fullName };
  }
}
