import { IsNumberString } from 'class-validator';

export class ConnectGitHubInstallationDto {
  @IsNumberString()
  installationId!: string;
}