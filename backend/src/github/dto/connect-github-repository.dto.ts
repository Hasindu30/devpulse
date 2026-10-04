import { IsNumberString } from 'class-validator';

export class ConnectGitHubRepositoryDto {
  @IsNumberString()
  githubRepositoryId!: string;
}