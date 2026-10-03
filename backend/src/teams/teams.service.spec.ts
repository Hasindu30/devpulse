import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { TeamRole } from '../generated/prisma/enums';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  let service: TeamsService;

  const prismaMock = {
    team: {
      create: jest.fn(),
    },

    teamMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },

    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          TeamsService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service = module.get<TeamsService>(
      TeamsService,
    );
  });

  describe('createTeam', () => {
    it('should create a team and make the creator ADMIN', async () => {
      prismaMock.team.create.mockResolvedValue({
        id: 'team-id',
        name: 'DevPulse Team',
        slug: 'devpulse-team-abc123',
        ownerId: 'user-id',
        createdAt: new Date(),
        memberships: [
          {
            userId: 'user-id',
            role: TeamRole.ADMIN,
          },
        ],
      });

      const result = await service.createTeam(
        'user-id',
        {
          name: 'DevPulse Team',
        },
      );

      expect(
        prismaMock.team.create,
      ).toHaveBeenCalledWith({
        data: {
          name: 'DevPulse Team',
          slug: expect.stringMatching(
            /^devpulse-team-[a-f0-9]{6}$/,
          ),
          ownerId: 'user-id',

          memberships: {
            create: {
              userId: 'user-id',
              role: TeamRole.ADMIN,
            },
          },
        },

        include: {
          memberships: true,
        },
      });

      expect(
        result.memberships[0].role,
      ).toBe(TeamRole.ADMIN);
    });
  });

  describe('getTeamsForUser', () => {
    it('should return teams belonging to the user', async () => {
      const createdAt = new Date();

      prismaMock.teamMember.findMany.mockResolvedValue([
        {
          role: TeamRole.ADMIN,
          joinedAt: new Date(),

          team: {
            id: 'team-id',
            name: 'DevPulse Team',
            slug: 'devpulse-team-abc123',
            ownerId: 'user-id',
            createdAt,
          },
        },
      ]);

      const result =
        await service.getTeamsForUser(
          'user-id',
        );

      expect(
        prismaMock.teamMember.findMany,
      ).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
        },

        include: {
          team: true,
        },

        orderBy: {
          joinedAt: 'desc',
        },
      });

      expect(result).toEqual([
        {
          id: 'team-id',
          name: 'DevPulse Team',
          slug: 'devpulse-team-abc123',
          role: TeamRole.ADMIN,
          ownerId: 'user-id',
          createdAt,
        },
      ]);
    });
  });

  describe('getTeamForUser', () => {
    it('should return a team when the user is a member', async () => {
      const createdAt = new Date();

      prismaMock.teamMember.findUnique.mockResolvedValue({
        role: TeamRole.REVIEWER,

        team: {
          id: 'team-id',
          name: 'DevPulse Team',
          slug: 'devpulse-team-abc123',
          ownerId: 'owner-id',
          createdAt,
        },
      });

      const result =
        await service.getTeamForUser(
          'user-id',
          'team-id',
        );

      expect(result).toEqual({
        id: 'team-id',
        name: 'DevPulse Team',
        slug: 'devpulse-team-abc123',
        role: TeamRole.REVIEWER,
        ownerId: 'owner-id',
        createdAt,
      });
    });

    it('should throw NotFoundException for a non-member', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.getTeamForUser(
          'user-id',
          'team-id',
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getTeamMembers', () => {
    it('should return team members', async () => {
      const members = [
        {
          id: 'membership-id',
          teamId: 'team-id',
          userId: 'user-id',
          role: TeamRole.ADMIN,
          joinedAt: new Date(),
          user: {
            id: 'user-id',
            githubId: '123',
            username: 'Hasindu30',
            avatarUrl: null,
          },
        },
      ];

      prismaMock.teamMember.findMany.mockResolvedValue(
        members,
      );

      const result =
        await service.getTeamMembers(
          'team-id',
        );

      expect(result).toEqual(members);

      expect(
        prismaMock.teamMember.findMany,
      ).toHaveBeenCalledWith({
        where: {
          teamId: 'team-id',
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
    });
  });

  describe('addTeamMember', () => {
    it('should throw NotFoundException when the user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.addTeamMember(
          'team-id',
          {
            userId: 'missing-user-id',
            role: TeamRole.REVIEWER,
          },
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(
        prismaMock.teamMember.create,
      ).not.toHaveBeenCalled();
    });

    it('should reject an existing team member', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-id',
      });

      prismaMock.teamMember.findUnique.mockResolvedValue({
        id: 'membership-id',
      });

      await expect(
        service.addTeamMember(
          'team-id',
          {
            userId: 'user-id',
            role: TeamRole.REVIEWER,
          },
        ),
      ).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        prismaMock.teamMember.create,
      ).not.toHaveBeenCalled();
    });

    it('should add a new team member', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-id',
      });

      prismaMock.teamMember.findUnique.mockResolvedValue(
        null,
      );

      const createdMembership = {
        id: 'membership-id',
        teamId: 'team-id',
        userId: 'user-id',
        role: TeamRole.REVIEWER,
      };

      prismaMock.teamMember.create.mockResolvedValue(
        createdMembership,
      );

      const result =
        await service.addTeamMember(
          'team-id',
          {
            userId: 'user-id',
            role: TeamRole.REVIEWER,
          },
        );

      expect(
        prismaMock.teamMember.create,
      ).toHaveBeenCalledWith({
        data: {
          teamId: 'team-id',
          userId: 'user-id',
          role: TeamRole.REVIEWER,
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

      expect(result).toEqual(
        createdMembership,
      );
    });
  });

  describe('updateTeamMemberRole', () => {
    it('should prevent the owner from being demoted', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: 'owner-id',
        role: TeamRole.ADMIN,

        team: {
          ownerId: 'owner-id',
        },
      });

      await expect(
        service.updateTeamMemberRole(
          'team-id',
          'owner-id',
          {
            role: TeamRole.REVIEWER,
          },
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prismaMock.teamMember.update,
      ).not.toHaveBeenCalled();
    });

    it('should update a normal team member role', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: 'user-id',
        role: TeamRole.REVIEWER,

        team: {
          ownerId: 'owner-id',
        },
      });

      prismaMock.teamMember.update.mockResolvedValue({
        id: 'membership-id',
        userId: 'user-id',
        role: TeamRole.DEVELOPER,
      });

      const result =
        await service.updateTeamMemberRole(
          'team-id',
          'user-id',
          {
            role: TeamRole.DEVELOPER,
          },
        );

      expect(
        prismaMock.teamMember.update,
      ).toHaveBeenCalledWith({
        where: {
          teamId_userId: {
            teamId: 'team-id',
            userId: 'user-id',
          },
        },

        data: {
          role: TeamRole.DEVELOPER,
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

      expect(result.role).toBe(
        TeamRole.DEVELOPER,
      );
    });

    it('should throw NotFoundException when the member does not exist', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.updateTeamMemberRole(
          'team-id',
          'missing-user-id',
          {
            role: TeamRole.DEVELOPER,
          },
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('removeTeamMember', () => {
    it('should prevent the team owner from being removed', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: 'owner-id',

        team: {
          ownerId: 'owner-id',
        },
      });

      await expect(
        service.removeTeamMember(
          'team-id',
          'owner-id',
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prismaMock.teamMember.delete,
      ).not.toHaveBeenCalled();
    });

    it('should remove a normal team member', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        id: 'membership-id',
        userId: 'user-id',

        team: {
          ownerId: 'owner-id',
        },
      });

      prismaMock.teamMember.delete.mockResolvedValue({
        id: 'membership-id',
      });

      await service.removeTeamMember(
        'team-id',
        'user-id',
      );

      expect(
        prismaMock.teamMember.delete,
      ).toHaveBeenCalledWith({
        where: {
          teamId_userId: {
            teamId: 'team-id',
            userId: 'user-id',
          },
        },
      });
    });

    it('should throw NotFoundException when the member does not exist', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue(
        null,
      );

      await expect(
        service.removeTeamMember(
          'team-id',
          'missing-user-id',
        ),
      ).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});