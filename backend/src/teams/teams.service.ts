import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { TeamRole } from '../generated/prisma/enums';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTeam(userId: string, dto: CreateTeamDto) {
    const slug = this.createSlug(dto.name);

    return this.prisma.team.create({
      data: {
        name: dto.name.trim(),
        slug,
        ownerId: userId,

        memberships: {
          create: {
            userId,
            role: TeamRole.ADMIN,
          },
        },
      },

      include: {
        memberships: true,
      },
    });
  }

  async getTeamsForUser(userId: string) {
    const memberships = await this.prisma.teamMember.findMany({
      where: {
        userId,
      },

      include: {
        team: true,
      },

      orderBy: {
        joinedAt: 'desc',
      },
    });

    return memberships.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      slug: membership.team.slug,
      role: membership.role,
      ownerId: membership.team.ownerId,
      createdAt: membership.team.createdAt,
    }));
  }

  async getTeamForUser(userId: string, teamId: string) {
    const membership = await this.prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },

      include: {
        team: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Team not found');
    }

    return {
      id: membership.team.id,
      name: membership.team.name,
      slug: membership.team.slug,
      role: membership.role,
      ownerId: membership.team.ownerId,
      createdAt: membership.team.createdAt,
    };
  }

  async getTeamMembers(teamId: string) {
    return this.prisma.teamMember.findMany({
      where: {
        teamId,
      },

      include: {
        user: {
          select: {
            id: true,
            githubId: true,
            username: true,
            avatarUrl: true,
          },
        },
      },

      orderBy: {
        joinedAt: 'asc',
      },
    });
  }

  async addTeamMember(
    teamId: string,
    dto: AddTeamMemberDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: dto.userId,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingMembership =
      await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId: dto.userId,
          },
        },
      });

    if (existingMembership) {
      throw new ConflictException(
        'User is already a team member',
      );
    }

    return this.prisma.teamMember.create({
      data: {
        teamId,
        userId: dto.userId,
        role: dto.role,
      },

      include: {
        user: {
          select: {
            id: true,
            githubId: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async updateTeamMemberRole(
    teamId: string,
    userId: string,
    dto: UpdateTeamMemberRoleDto,
  ) {
    const membership =
      await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },

        include: {
          team: {
            select: {
              ownerId: true,
            },
          },
        },
      });

    if (!membership) {
      throw new NotFoundException(
        'Team member not found',
      );
    }

    if (
      membership.team.ownerId === userId &&
      dto.role !== TeamRole.ADMIN
    ) {
      throw new BadRequestException(
        'Team owner must remain an ADMIN',
      );
    }

    return this.prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },

      data: {
        role: dto.role,
      },

      include: {
        user: {
          select: {
            id: true,
            githubId: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async removeTeamMember(
    teamId: string,
    userId: string,
  ) {
    const membership =
      await this.prisma.teamMember.findUnique({
        where: {
          teamId_userId: {
            teamId,
            userId,
          },
        },

        include: {
          team: {
            select: {
              ownerId: true,
            },
          },
        },
      });

    if (!membership) {
      throw new NotFoundException(
        'Team member not found',
      );
    }

    if (membership.team.ownerId === userId) {
      throw new BadRequestException(
        'Team owner cannot be removed',
      );
    }

    await this.prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });
  }

  private createSlug(name: string): string {
    const base = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const suffix = randomBytes(3).toString('hex');

    return `${base || 'team'}-${suffix}`;
  }
}