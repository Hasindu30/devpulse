import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let authService: AuthService;

  const prismaMock = {
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      upsert: jest.fn(),
    },
  };

  const configMock = {
    get: jest.fn((key: string) => {
      const values: Record<string, string> = {
        SESSION_TTL_DAYS: '7',
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL:
          'http://localhost:4000/auth/github/callback',
      };

      return values[key];
    }),

    getOrThrow: jest.fn((key: string) => {
      const values: Record<string, string> = {
        GITHUB_CLIENT_ID: 'test-client-id',
        GITHUB_CLIENT_SECRET: 'test-client-secret',
        GITHUB_CALLBACK_URL:
          'http://localhost:4000/auth/github/callback',
      };

      const value = values[key];

      if (!value) {
        throw new Error(`Missing config: ${key}`);
      }

      return value;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
          {
            provide: ConfigService,
            useValue: configMock,
          },
        ],
      }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  describe('createOAuthState', () => {
    it('should generate different secure state values', () => {
      const first = authService.createOAuthState();
      const second = authService.createOAuthState();

      expect(first).toBeTruthy();
      expect(second).toBeTruthy();
      expect(first).not.toBe(second);
    });
  });

  describe('buildGitHubAuthorizationUrl', () => {
    it('should build the GitHub authorization URL', () => {
      const url =
        authService.buildGitHubAuthorizationUrl(
          'test-state',
        );

      expect(url).toContain(
        'https://github.com/login/oauth/authorize',
      );

      expect(url).toContain(
        'client_id=test-client-id',
      );

      expect(url).toContain(
        'state=test-state',
      );
    });
  });

  describe('createSession', () => {
    it('should create a hashed database session', async () => {
      prismaMock.authSession.create.mockResolvedValue({
        id: 'session-id',
      });

      const result =
        await authService.createSession('user-id');

      expect(result.token).toBeTruthy();
      expect(result.expiresAt).toBeInstanceOf(Date);

      expect(
        prismaMock.authSession.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        },
      });

      const createCall =
        prismaMock.authSession.create.mock.calls[0][0];

      expect(createCall.data.tokenHash).not.toBe(
        result.token,
      );

      expect(createCall.data.tokenHash).toHaveLength(64);
    });
  });

  describe('getUserFromSession', () => {
    it('should reject when a session token is missing', async () => {
      await expect(
        authService.getUserFromSession(undefined),
      ).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should reject an invalid session', async () => {
      prismaMock.authSession.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        authService.getUserFromSession(
          'invalid-token',
        ),
      ).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should delete and reject an expired session', async () => {
      prismaMock.authSession.findUnique.mockResolvedValue({
        id: 'session-id',
        expiresAt: new Date(Date.now() - 1000),
        user: {
          id: 'user-id',
          githubId: '119030033',
          username: 'Hasindu30',
        },
      });

      prismaMock.authSession.delete.mockResolvedValue({
        id: 'session-id',
      });

      await expect(
        authService.getUserFromSession(
          'expired-token',
        ),
      ).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(
        prismaMock.authSession.delete,
      ).toHaveBeenCalledWith({
        where: {
          id: 'session-id',
        },
      });
    });

    it('should return the user for a valid session', async () => {
      const user = {
        id: 'user-id',
        githubId: '119030033',
        username: 'Hasindu30',
        avatarUrl: null,
        email: null,
      };

      prismaMock.authSession.findUnique.mockResolvedValue({
        id: 'session-id',
        expiresAt: new Date(
          Date.now() + 60_000,
        ),
        user,
      });

      const result =
        await authService.getUserFromSession(
          'valid-token',
        );

      expect(result).toEqual(user);
    });
  });

  describe('revokeSession', () => {
    it('should revoke the session when a token exists', async () => {
      prismaMock.authSession.deleteMany.mockResolvedValue({
        count: 1,
      });

      await authService.revokeSession(
        'valid-token',
      );

      expect(
        prismaMock.authSession.deleteMany,
      ).toHaveBeenCalledWith({
        where: {
          tokenHash: expect.any(String),
        },
      });
    });

    it('should do nothing when no token exists', async () => {
      await authService.revokeSession(undefined);

      expect(
        prismaMock.authSession.deleteMany,
      ).not.toHaveBeenCalled();
    });
  });
});