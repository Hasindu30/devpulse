import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('github')
  githubLogin(@Res() response: Response) {
    const state = this.authService.createOAuthState();

    response.cookie('devpulse_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/auth',
    });

    return response.redirect(
      this.authService.buildGitHubAuthorizationUrl(state),
    );
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const expectedState = request.cookies[
      'devpulse_oauth_state'
    ] as string | undefined;

    if (!code || !state || !expectedState || state !== expectedState) {
      throw new UnauthorizedException(
        'Invalid GitHub authentication state',
      );
    }

    response.clearCookie('devpulse_oauth_state', {
      path: '/auth',
    });

    const user =
      await this.authService.authenticateWithGitHub(code);

    const session =
      await this.authService.createSession(user.id);

    const cookieName =
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      'devpulse_session';

    response.cookie(cookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: session.expiresAt,
      path: '/',
    });

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') ??
      'http://localhost:3000';

    return response.redirect(frontendUrl);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  me(@Req() request: Request) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    return {
      id: user.id,
      githubId: user.githubId,
      username: user.username,
      avatarUrl: user.avatarUrl,
      email: user.email,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const cookieName =
      this.configService.get<string>('SESSION_COOKIE_NAME') ??
      'devpulse_session';

    const token = request.cookies[cookieName] as
      | string
      | undefined;

    await this.authService.revokeSession(token);

    response.clearCookie(cookieName, {
      path: '/',
    });

    return response.status(204).send();
  }
}