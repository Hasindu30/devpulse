import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { ConnectGitHubInstallationDto } from './dto/connect-github-installation.dto';
import { GithubAppService } from './github-app/github-app.service';

@Injectable()
export class GithubInstallationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubAppService: GithubAppService,
  ) {}

  async connectInstallation(
    teamId: string,
    githubUsername: string,
    dto: ConnectGitHubInstallationDto,
  ) {
    const installation =
      await this.githubAppService.getInstallation(
        dto.installationId,
      );

    if (installation.account.type !== 'User') {
      throw new BadRequestException(
        'Organization installations are not supported yet',
      );
    }

    if (
      installation.account.login.toLowerCase() !==
      githubUsername.toLowerCase()
    ) {
      throw new ForbiddenException(
        'GitHub installation does not belong to the authenticated user',
      );
    }

    const githubInstallationId = String(
      installation.id,
    );

    const existing =
      await this.prisma.gitHubInstallation.findUnique({
        where: {
          githubInstallationId,
        },
      });

    if (existing && existing.teamId !== teamId) {
      throw new ConflictException(
        'GitHub installation is already connected to another team',
      );
    }

    if (existing) {
      return this.prisma.gitHubInstallation.update({
        where: {
          githubInstallationId,
        },

        data: {
          accountId: String(
            installation.account.id,
          ),
          accountLogin:
            installation.account.login,
          accountType:
            installation.account.type,
          repositorySelection:
            installation.repository_selection,
        },
      });
    }

    return this.prisma.gitHubInstallation.create({
      data: {
        teamId,
        githubInstallationId,
        accountId: String(
          installation.account.id,
        ),
        accountLogin:
          installation.account.login,
        accountType:
          installation.account.type,
        repositorySelection:
          installation.repository_selection,
      },
    });
  }

  async getRepositoriesForTeam(
    teamId: string,
  ) {
    const installations =
      await this.prisma.gitHubInstallation.findMany({
        where: {
          teamId,
        },
      });

    if (!installations.length) {
      throw new NotFoundException(
        'GitHub installation not found',
      );
    }

    const repositoryResponses =
      await Promise.all(
        installations.map(async (installation) => {
          const response =
            await this.githubAppService.listInstallationRepositories(
              installation.githubInstallationId,
            );

          return response.repositories.map(
            (repository) => ({
              installationId:
                installation.id,

              githubInstallationId:
                installation.githubInstallationId,

              githubRepositoryId:
                String(repository.id),

              name:
                repository.name,

              fullName:
                repository.full_name,

              ownerName:
                repository.owner.login,

              defaultBranch:
                repository.default_branch,

              isPrivate:
                repository.private,

              htmlUrl:
                repository.html_url,
            }),
          );
        }),
      );

    const repositories =
      repositoryResponses.flat();

    return Array.from(
      new Map(
        repositories.map((repository) => [
          repository.githubRepositoryId,
          repository,
        ]),
      ).values(),
    );
  }

  async connectRepository(
    teamId: string,
    githubRepositoryId: string,
  ) {
    const availableRepositories =
      await this.getRepositoriesForTeam(
        teamId,
      );

    const repository =
      availableRepositories.find(
        (item) =>
          item.githubRepositoryId ===
          githubRepositoryId,
      );

    if (!repository) {
      throw new NotFoundException(
        'GitHub repository is not available to this team installation',
      );
    }

    const now = new Date();

    return this.prisma.repository.upsert({
      where: {
        teamId_githubRepositoryId: {
          teamId,
          githubRepositoryId:
            repository.githubRepositoryId,
        },
      },

      update: {
        installationId:
          repository.installationId,

        fullName:
          repository.fullName,

        ownerName:
          repository.ownerName,

        name:
          repository.name,

        defaultBranch:
          repository.defaultBranch,

        isPrivate:
          repository.isPrivate,

        htmlUrl:
          repository.htmlUrl,

        lastSyncedAt: now,
      },

      create: {
        teamId,

        installationId:
          repository.installationId,

        githubRepositoryId:
          repository.githubRepositoryId,

        fullName:
          repository.fullName,

        ownerName:
          repository.ownerName,

        name:
          repository.name,

        defaultBranch:
          repository.defaultBranch,

        isPrivate:
          repository.isPrivate,

        htmlUrl:
          repository.htmlUrl,

        lastSyncedAt: now,
      },
    });
  }

  async getConnectedRepositories(
    teamId: string,
  ) {
    return this.prisma.repository.findMany({
      where: {
        teamId,
      },

      orderBy: {
        connectedAt: 'desc',
      },

      select: {
        id: true,
        githubRepositoryId: true,
        fullName: true,
        ownerName: true,
        name: true,
        defaultBranch: true,
        isPrivate: true,
        htmlUrl: true,
        connectedAt: true,
        lastSyncedAt: true,
      },
    });
  }
}