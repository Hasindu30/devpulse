import {
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('AuthGuard', () => {
  let authGuard: AuthGuard;

  const authServiceMock = {
    getUserFromSession: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn(() => 'devpulse_session'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          AuthGuard,
          {
            provide: AuthService,
            useValue: authServiceMock,
          },
          {
            provide: ConfigService,
            useValue: configServiceMock,
          },
        ],
      }).compile();

    authGuard = module.get<AuthGuard>(AuthGuard);
  });

  it('should authenticate a valid session and attach the user', async () => {
    const user = {
      id: 'user-id',
      githubId: '119030033',
      username: 'Hasindu30',
    };

    authServiceMock.getUserFromSession.mockResolvedValue(
      user,
    );

const request: {
  cookies: Record<string, string>;
  user?: typeof user;
} = {
  cookies: {
    devpulse_session: 'raw-session-token',
  },
};

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    const result =
      await authGuard.canActivate(context);

    expect(result).toBe(true);

    expect(
      authServiceMock.getUserFromSession,
    ).toHaveBeenCalledWith(
      'raw-session-token',
    );

    expect(request.user).toEqual(user);
  });

  it('should reject a request without a valid session', async () => {
    authServiceMock.getUserFromSession.mockRejectedValue(
      new UnauthorizedException(
        'Authentication required',
      ),
    );

    const request = {
      cookies: {},
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    await expect(
      authGuard.canActivate(context),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});