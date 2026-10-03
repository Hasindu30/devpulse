import { IsEnum } from 'class-validator';

import { TeamRole } from '../../generated/prisma/enums';

export class UpdateTeamMemberRoleDto {
  @IsEnum(TeamRole)
  role!: TeamRole;
}