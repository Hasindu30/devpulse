import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../auth/auth.guard';
import { TeamRole } from '../generated/prisma/enums';
import { TeamRoleGuard } from '../teams/team-role.guard';
import { TeamRoles } from '../teams/team-roles.decorator';

import { ConnectGitHubInstallationDto } from './dto/connect-github-installation.dto';
import { ConnectGitHubRepositoryDto } from './dto/connect-github-repository.dto';
import { GithubInstallationsService } from './github-installations.service';

@Controller('teams/:teamId/github')
@UseGuards(AuthGuard, TeamRoleGuard)
export class GithubInstallationsController {
  constructor(
    private readonly githubInstallationsService: GithubInstallationsService,
  ) {}

  @Post('installations')
  @TeamRoles(TeamRole.ADMIN)
  connectInstallation(
    @Param('teamId') teamId: string,
    @Req() request: Request,
    @Body() dto: ConnectGitHubInstallationDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    return this.githubInstallationsService.connectInstallation(
      teamId,
      user.username,
      dto,
    );
  }

  @Get('repositories')
  @TeamRoles(TeamRole.ADMIN)
  getRepositories(
    @Param('teamId') teamId: string,
  ) {
    return this.githubInstallationsService.getRepositoriesForTeam(
      teamId,
    );
  }

  @Post('repositories')
  @TeamRoles(TeamRole.ADMIN)
  connectRepository(
    @Param('teamId') teamId: string,
    @Body() dto: ConnectGitHubRepositoryDto,
  ) {
    return this.githubInstallationsService.connectRepository(
      teamId,
      dto.githubRepositoryId,
    );
  }

  @Get('connected-repositories')
  @TeamRoles(
    TeamRole.ADMIN,
    TeamRole.REVIEWER,
    TeamRole.DEVELOPER,
  )
  getConnectedRepositories(
    @Param('teamId') teamId: string,
  ) {
    return this.githubInstallationsService.getConnectedRepositories(
      teamId,
    );
  }
}