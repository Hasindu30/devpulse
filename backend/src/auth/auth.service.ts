import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  email: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  createOAuthState(): string {
    return randomBytes(32).toString('base64url');
  }

  buildGitHubAuthorizationUrl(state: string): string {
    const clientId =
      this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');

    const callbackUrl =
      this.configService.getOrThrow<string>('GITHUB_CALLBACK_URL');

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async authenticateWithGitHub(code: string) {
    const accessToken = await this.exchangeCodeForToken(code);
    const githubUser = await this.fetchGitHubUser(accessToken);

    return this.prisma.user.upsert({
      where: {
        githubId: String(githubUser.id),
      },
      update: {
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email: githubUser.email,
      },
      create: {
        githubId: String(githubUser.id),
        username: githubUser.login,
        avatarUrl: githubUser.avatar_url,
        email: githubUser.email,
      },
    });
  }

  async createSession(userId: string) {
    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(rawToken);

    const ttlDays = Number(
      this.configService.get<string>('SESSION_TTL_DAYS') ?? '7',
    );

    const expiresAt = new Date(
      Date.now() + ttlDays * 24 * 60 * 60 * 1000,
    );

    await this.prisma.authSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token: rawToken,
      expiresAt,
    };
  }

  async getUserFromSession(rawToken?: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Authentication required');
    }

    const tokenHash = this.hashToken(rawToken);

    const session = await this.prisma.authSession.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.expiresAt <= new Date()) {
      await this.prisma.authSession.delete({
        where: {
          id: session.id,
        },
      });

      throw new UnauthorizedException('Session expired');
    }

    return session.user;
  }

  async revokeSession(rawToken?: string) {
    if (!rawToken) {
      return;
    }

    const tokenHash = this.hashToken(rawToken);

    await this.prisma.authSession.deleteMany({
      where: {
        tokenHash,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const clientId =
      this.configService.getOrThrow<string>('GITHUB_CLIENT_ID');

    const clientSecret =
      this.configService.getOrThrow<string>('GITHUB_CLIENT_SECRET');

    const callbackUrl =
      this.configService.getOrThrow<string>('GITHUB_CALLBACK_URL');

    const response = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException(
        'GitHub authentication failed',
      );
    }

    const data = (await response.json()) as GitHubTokenResponse;

    if (!data.access_token) {
      throw new UnauthorizedException(
        data.error_description ?? 'GitHub token exchange failed',
      );
    }

    return data.access_token;
  }

  private async fetchGitHubUser(
    accessToken: string,
  ): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException(
        'Unable to retrieve GitHub user',
      );
    }

    return (await response.json()) as GitHubUser;
  }
}