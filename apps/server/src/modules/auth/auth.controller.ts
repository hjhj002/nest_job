import { Controller, Post, Get, Body, Request } from '@nestjs/common';
import { AuthService, LoginDto, RegisterDto } from './auth.service';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  getMe(@Request() req: any) {
    return this.authService.getUserInfo(req.user.id);
  }
}
