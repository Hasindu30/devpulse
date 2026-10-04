import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { PullRequestState } from '../generated/prisma/enums';
import { GithubPullRequestService } from './github-pull-request.service';

describe('GithubPullRequestService', () => {
  let service: GithubPullRequestService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },

    pullRequest: {
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          GithubPullRequestService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service =
      module.get<GithubPullRequestService>(
        GithubPullRequestService,
      );
  });

  it('should upsert an open pull request', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'local-user-id',
    });

    prismaMock.pullRequest.upsert.mockResolvedValue({
      id: 'pull-request-id',
      state: PullRequestState.OPEN,
    });

    const payload = {
      number: 25,

      pull_request: {
        id: 987654,
        number: 25,
        title: 'Add GitHub integration',
        body: 'PR body',
        state: 'open',
        merged: false,
        draft: false,

        additions: 120,
        deletions: 20,
        changed_files: 5,

        html_url:
          'https://github.com/Hasindu30/devpulse/pull/25',

        created_at:
          '2026-10-04T10:00:00Z',

        closed_at: null,
        merged_at: null,

        user: {
          id: 119030033,
          login: 'Hasindu30',
        },

        head: {
          ref: 'feat/github-integration',
        },

        base: {
          ref: 'main',
        },
      },
    };

    await service.syncFromWebhook(
      'repository-id',
      payload,
    );

    expect(
      prismaMock.user.findUnique,
    ).toHaveBeenCalledWith({
      where: {
        githubId: '119030033',
      },

      select: {
        id: true,
      },
    });

    expect(
      prismaMock.pullRequest.upsert,
    ).toHaveBeenCalledWith({
      where: {
        repositoryId_githubPullRequestId: {
          repositoryId: 'repository-id',
          githubPullRequestId: '987654',
        },
      },

      update: expect.objectContaining({
        githubNumber: 25,
        authorId: 'local-user-id',
        authorGithubId: '119030033',
        authorLogin: 'Hasindu30',
        title: 'Add GitHub integration',
        state: PullRequestState.OPEN,
        headRef: 'feat/github-integration',
        baseRef: 'main',
        additions: 120,
        deletions: 20,
        changedFiles: 5,
      }),

      create: expect.objectContaining({
        repositoryId: 'repository-id',
        githubPullRequestId: '987654',
        githubNumber: 25,
        authorId: 'local-user-id',
        authorGithubId: '119030033',
        authorLogin: 'Hasindu30',
        title: 'Add GitHub integration',
        state: PullRequestState.OPEN,
      }),
    });
  });

  it('should map a merged pull request to MERGED', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      null,
    );

    prismaMock.pullRequest.upsert.mockResolvedValue({
      id: 'pull-request-id',
      state: PullRequestState.MERGED,
    });

    const payload = {
      number: 10,

      pull_request: {
        id: 123456,
        title: 'Merged feature',
        state: 'closed',
        merged: true,

        html_url:
          'https://github.com/Hasindu30/devpulse/pull/10',

        created_at:
          '2026-10-01T10:00:00Z',

        closed_at:
          '2026-10-04T10:00:00Z',

        merged_at:
          '2026-10-04T09:59:00Z',

        user: {
          id: 555,
          login: 'external-user',
        },

        head: {
          ref: 'feature',
        },

        base: {
          ref: 'main',
        },
      },
    };

    await service.syncFromWebhook(
      'repository-id',
      payload,
    );

    expect(
      prismaMock.pullRequest.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          state: PullRequestState.MERGED,
          authorId: null,
          mergedAt: expect.any(Date),
          closedAt: expect.any(Date),
        }),

        create: expect.objectContaining({
          state: PullRequestState.MERGED,
          authorId: null,
          mergedAt: expect.any(Date),
          closedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('should map a closed non-merged pull request to CLOSED', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      null,
    );

    prismaMock.pullRequest.upsert.mockResolvedValue({
      id: 'pull-request-id',
    });

    const payload = {
      number: 11,

      pull_request: {
        id: 777,
        title: 'Closed PR',
        state: 'closed',
        merged: false,

        html_url:
          'https://github.com/example/repo/pull/11',

        created_at:
          '2026-10-01T10:00:00Z',

        closed_at:
          '2026-10-04T10:00:00Z',

        user: {
          id: 999,
          login: 'someone',
        },

        head: {
          ref: 'feature',
        },

        base: {
          ref: 'main',
        },
      },
    };

    await service.syncFromWebhook(
      'repository-id',
      payload,
    );

    expect(
      prismaMock.pullRequest.upsert,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          state: PullRequestState.CLOSED,
        }),

        create: expect.objectContaining({
          state: PullRequestState.CLOSED,
        }),
      }),
    );
  });

  it('should reject an invalid pull request payload', async () => {
    await expect(
      service.syncFromWebhook(
        'repository-id',
        {
          pull_request: {
            id: 123,
          },
        },
      ),
    ).rejects.toThrow(
      'Invalid pull_request webhook payload',
    );

    expect(
      prismaMock.pullRequest.upsert,
    ).not.toHaveBeenCalled();
  });
});