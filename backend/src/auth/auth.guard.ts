import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const cookieName =
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      'devpulse_session';

    const token = request.cookies[cookieName] as
      | string
      | undefined;

    const user =
      await this.authService.getUserFromSession(token);

    request.user = user;

    return true;
  }
}