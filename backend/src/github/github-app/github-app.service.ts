import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign } from 'jsonwebtoken';

type GitHubInstallation = {
  id: number;
  account: {
    login: string;
    id: number;
    type: string;
  };
  repository_selection: 'all' | 'selected';
};

type GitHubInstallationTokenResponse = {
  token: string;
  expires_at: string;
};

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: {
    login: string;
  };
};

type GitHubRepositoriesResponse = {
  total_count: number;
  repositories: GitHubRepository[];
};

@Injectable()
export class GithubAppService {
  constructor(
    private readonly configService: ConfigService,
  ) {}

  createAppJwt(): string {
    const clientId =
      this.configService.getOrThrow<string>(
        'GITHUB_CLIENT_ID',
      );

    const privateKeyBase64 =
      this.configService.getOrThrow<string>(
        'GITHUB_PRIVATE_KEY_BASE64',
      );

    const privateKey = Buffer.from(
      privateKeyBase64,
      'base64',
    ).toString('utf8');

    const now = Math.floor(Date.now() / 1000);

    return sign(
      {
        iat: now - 60,
        exp: now + 9 * 60,
        iss: clientId,
      },
      privateKey,
      {
        algorithm: 'RS256',
      },
    );
  }

  async getInstallation(
    installationId: string,
  ): Promise<GitHubInstallation> {
    const appJwt = this.createAppJwt();

    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}`,
      {
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException(
        'Unable to access GitHub App installation',
      );
    }

    return response.json() as Promise<GitHubInstallation>;
  }

  async createInstallationToken(
    installationId: string,
  ): Promise<string> {
    const appJwt = this.createAppJwt();

    const response = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appJwt}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException(
        'Unable to create GitHub installation token',
      );
    }

    const data =
      (await response.json()) as GitHubInstallationTokenResponse;

    return data.token;
  }

  async listInstallationRepositories(
    installationId: string,
  ): Promise<GitHubRepositoriesResponse> {
    const installationToken =
      await this.createInstallationToken(
        installationId,
      );

    const response = await fetch(
      'https://api.github.com/installation/repositories?per_page=100',
      {
        headers: {
          Authorization: `Bearer ${installationToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!response.ok) {
      throw new UnauthorizedException(
        'Unable to fetch GitHub repositories',
      );
    }

    return response.json() as Promise<GitHubRepositoriesResponse>;
  }
}