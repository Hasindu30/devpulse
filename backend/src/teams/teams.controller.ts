import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { AuthGuard } from '../auth/auth.guard';
import { TeamRole } from '../generated/prisma/enums';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamMemberRoleDto } from './dto/update-team-member-role.dto';
import { TeamRoleGuard } from './team-role.guard';
import { TeamRoles } from './team-roles.decorator';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(
    @Req() request: Request,
    @Body() dto: CreateTeamDto,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    const team = await this.teamsService.createTeam(
      user.id,
      dto,
    );

    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      role: team.memberships[0]?.role,
      createdAt: team.createdAt,
    };
  }

  @Get()
  getTeams(@Req() request: Request) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    return this.teamsService.getTeamsForUser(
      user.id,
    );
  }

  @Get(':id')
  getTeam(
    @Req() request: Request,
    @Param('id') teamId: string,
  ) {
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication required',
      );
    }

    return this.teamsService.getTeamForUser(
      user.id,
      teamId,
    );
  }

  @Get(':id/members')
  @UseGuards(TeamRoleGuard)
  @TeamRoles(
    TeamRole.ADMIN,
    TeamRole.REVIEWER,
    TeamRole.DEVELOPER,
  )
  getTeamMembers(
    @Param('id') teamId: string,
  ) {
    return this.teamsService.getTeamMembers(
      teamId,
    );
  }

  @Post(':id/members')
  @UseGuards(TeamRoleGuard)
  @TeamRoles(TeamRole.ADMIN)
  addTeamMember(
    @Param('id') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addTeamMember(
      teamId,
      dto,
    );
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(TeamRoleGuard)
  @TeamRoles(TeamRole.ADMIN)
  updateTeamMemberRole(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateTeamMemberRoleDto,
  ) {
    return this.teamsService.updateTeamMemberRole(
      teamId,
      userId,
      dto,
    );
  }

  @Delete(':id/members/:userId')
  @UseGuards(TeamRoleGuard)
  @TeamRoles(TeamRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTeamMember(
    @Param('id') teamId: string,
    @Param('userId') userId: string,
  ) {
    await this.teamsService.removeTeamMember(
      teamId,
      userId,
    );
  }
}