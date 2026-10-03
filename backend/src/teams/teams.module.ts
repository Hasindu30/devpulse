import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { TeamRoleGuard } from './team-role.guard';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [AuthModule],
  controllers: [TeamsController],
  providers: [
    TeamsService,
    TeamRoleGuard,
  ],
})
export class TeamsModule {}