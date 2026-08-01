import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterClientDto } from './dto/register-client.dto';
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login') login(@Body() dto: LoginDto) { return this.service.login(dto); }
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('client/login') clientLogin(@Body() dto: LoginDto) { return this.service.clientLogin(dto); }
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('client/register') clientRegister(@Body() dto: RegisterClientDto) { return this.service.registerClient(dto); }
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('client/google') async googleClient(@Res() res: Response) { return res.redirect(await this.service.googleClientUrl()); }
  @Get('client/google/callback')
  async googleClientCallback(@Query('code') code: string, @Query('state') state: string, @Query('error') googleError: string, @Res() res: Response) {
    if (googleError) return res.redirect(this.service.frontendGoogleErrorRedirect('No se completo el acceso con Google.'));
    try {
      const session = await this.service.googleClientLogin(code, state);
      return res.redirect(this.service.frontendGoogleRedirect(session));
    } catch (error) {
      return res.redirect(this.service.frontendGoogleErrorRedirect(error?.message || 'No se pudo iniciar sesion con Google.'));
    }
  }
  @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentUser('id') id: string) { return this.service.me(id); }
  @UseGuards(JwtAuthGuard) @Post('change-password') changePassword(@CurrentUser('id') id: string, @Body() dto: ChangePasswordDto) { return this.service.changePassword(id, dto); }
}
