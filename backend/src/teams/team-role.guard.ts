import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { PrismaService } from '../database/prisma.service';
import { TeamRole } from '../generated/prisma/enums';
import {
  TEAM_ROLES_KEY,
} from './team-roles.decorator';

@Injectable()
export class TeamRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<TeamRole[]>(
        TEAM_ROLES_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!requiredRoles?.length) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest<Request>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    const rawTeamId =
      request.params['teamId'] ??
      request.params['id'];

    const teamId = Array.isArray(rawTeamId)
      ? rawTeamId[0]
      : rawTeamId;

    if (!teamId) {
      throw new NotFoundException(
        'Team not found',
      );
    }

    const membership =
      await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: user.id,
          },
        },
      });

    if (!membership) {
      throw new NotFoundException(
        'Team not found',
      );
    }

    if (!requiredRoles.includes(membership.role)) {
      throw new ForbiddenException(
        'Insufficient team permissions',
      );
    }

    request.teamMembership = membership;

    return true;
  }
}