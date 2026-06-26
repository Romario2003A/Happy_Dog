import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
@Module({ imports: [PassportModule, JwtModule.registerAsync({ inject:[ConfigService], useFactory:(config:ConfigService)=>({ secret: config.get('JWT_SECRET') || 'dev_secret', signOptions:{ expiresIn: config.get('JWT_EXPIRES_IN') || '8h' }})})], controllers:[AuthController], providers:[AuthService, JwtStrategy, PrismaService] })
export class AuthModule {}
