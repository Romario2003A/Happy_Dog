import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterClientDto } from './dto/register-client.dto';
@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}
  @Post('login') login(@Body() dto: LoginDto) { return this.service.login(dto); }
  @Post('client/login') clientLogin(@Body() dto: LoginDto) { return this.service.clientLogin(dto); }
  @Post('client/register') clientRegister(@Body() dto: RegisterClientDto) { return this.service.registerClient(dto); }
  @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentUser('id') id: string) { return this.service.me(id); }
  @UseGuards(JwtAuthGuard) @Post('change-password') changePassword(@CurrentUser('id') id: string, @Body() dto: ChangePasswordDto) { return this.service.changePassword(id, dto); }
}
