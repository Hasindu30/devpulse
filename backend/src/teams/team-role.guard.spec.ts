import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { TeamRole } from '../generated/prisma/enums';
import { TeamRoleGuard } from './team-role.guard';

describe('TeamRoleGuard', () => {
  let guard: TeamRoleGuard;

  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };

  const prismaMock = {
    teamMember: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          TeamRoleGuard,
          {
            provide: Reflector,
            useValue: reflectorMock,
          },
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    guard = module.get<TeamRoleGuard>(
      TeamRoleGuard,
    );
  });

  function createContext(
    request: {
      user?: {
        id: string;
      };
      params: Record<string, string>;
      teamMembership?: unknown;
    },
  ): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  }

  it('should allow requests when no team roles are required', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(
      undefined,
    );

    const context = createContext({
      params: {},
    });

    await expect(
      guard.canActivate(context),
    ).resolves.toBe(true);

    expect(
      prismaMock.teamMember.findUnique,
    ).not.toHaveBeenCalled();
  });

  it('should reject unauthenticated users', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      TeamRole.ADMIN,
    ]);

    const context = createContext({
      params: {
        id: 'team-id',
      },
    });

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('should reject requests without a team id', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      TeamRole.ADMIN,
    ]);

    const context = createContext({
      user: {
        id: 'user-id',
      },
      params: {},
    });

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('should return not found when the user is not a team member', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      TeamRole.ADMIN,
    ]);

    prismaMock.teamMember.findUnique.mockResolvedValue(
      null,
    );

    const context = createContext({
      user: {
        id: 'user-id',
      },
      params: {
        id: 'team-id',
      },
    });

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(
      prismaMock.teamMember.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        teamId_userId: {
          teamId: 'team-id',
          userId: 'user-id',
        },
      },
    });
  });

  it('should reject a team member with an insufficient role', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      TeamRole.ADMIN,
    ]);

    prismaMock.teamMember.findUnique.mockResolvedValue({
      id: 'membership-id',
      teamId: 'team-id',
      userId: 'user-id',
      role: TeamRole.DEVELOPER,
      joinedAt: new Date(),
    });

    const context = createContext({
      user: {
        id: 'user-id',
      },
      params: {
        id: 'team-id',
      },
    });

    await expect(
      guard.canActivate(context),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('should allow a member with the required role', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      TeamRole.ADMIN,
    ]);

    const membership = {
      id: 'membership-id',
      teamId: 'team-id',
      userId: 'user-id',
      role: TeamRole.ADMIN,
      joinedAt: new Date(),
    };

    prismaMock.teamMember.findUnique.mockResolvedValue(
      membership,
    );

    const request: {
      user: {
        id: string;
      };
      params: Record<string, string>;
      teamMembership?: unknown;
    } = {
      user: {
        id: 'user-id',
      },
      params: {
        id: 'team-id',
      },
    };

    const context = createContext(request);

    await expect(
      guard.canActivate(context),
    ).resolves.toBe(true);

    expect(request.teamMembership).toEqual(
      membership,
    );
  });

  it('should allow REVIEWER when REVIEWER is permitted', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue([
      TeamRole.ADMIN,
      TeamRole.REVIEWER,
      TeamRole.DEVELOPER,
    ]);

    prismaMock.teamMember.findUnique.mockResolvedValue({
      id: 'membership-id',
      teamId: 'team-id',
      userId: 'reviewer-id',
      role: TeamRole.REVIEWER,
      joinedAt: new Date(),
    });

    const context = createContext({
      user: {
        id: 'reviewer-id',
      },
      params: {
        id: 'team-id',
      },
    });

    await expect(
      guard.canActivate(context),
    ).resolves.toBe(true);
  });
});