import { IsEnum, IsUUID } from 'class-validator';

import { TeamRole } from '../../generated/prisma/enums';

export class AddTeamMemberDto {
  @IsUUID()
  userId!: string;

  @IsEnum(TeamRole)
  role!: TeamRole;
}