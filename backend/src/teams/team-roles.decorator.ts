import { SetMetadata } from '@nestjs/common';
import { TeamRole } from '../generated/prisma/enums';

export const TEAM_ROLES_KEY = 'teamRoles';

export const TeamRoles = (...roles: TeamRole[]) =>
  SetMetadata(TEAM_ROLES_KEY, roles);