import { Injectable } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { PullRequestState } from '../generated/prisma/enums';

type GitHubPullRequestPayload = {
  pull_request?: {
    id?: number;
    number?: number;
    title?: string;
    body?: string | null;
    state?: string;
    merged?: boolean;
    draft?: boolean;

    additions?: number;
    deletions?: number;
    changed_files?: number;

    html_url?: string;
    created_at?: string;
    closed_at?: string | null;
    merged_at?: string | null;

    user?: {
      id?: number;
      login?: string;
    };

    head?: {
      ref?: string;
    };

    base?: {
      ref?: string;
    };
  };

  number?: number;
};

@Injectable()
export class GithubPullRequestService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async syncFromWebhook(
    repositoryId: string,
    payload: Prisma.JsonValue,
  ) {
    const webhookPayload =
      payload as GitHubPullRequestPayload;

    const pullRequest =
      webhookPayload.pull_request;

    if (
      !pullRequest ||
      pullRequest.id === undefined ||
      !pullRequest.title ||
      !pullRequest.user?.id ||
      !pullRequest.user.login ||
      !pullRequest.head?.ref ||
      !pullRequest.base?.ref ||
      !pullRequest.html_url ||
      !pullRequest.created_at
    ) {
      throw new Error(
        'Invalid pull_request webhook payload',
      );
    }

    const githubNumber =
      webhookPayload.number ??
      pullRequest.number;

    if (githubNumber === undefined) {
      throw new Error(
        'GitHub pull request number is missing',
      );
    }

    const githubPullRequestId =
      String(pullRequest.id);

    const authorGithubId =
      String(pullRequest.user.id);

    const author =
      await this.prisma.user.findUnique({
        where: {
          githubId: authorGithubId,
        },

        select: {
          id: true,
        },
      });

    const state =
      this.mapPullRequestState(
        pullRequest.state,
        pullRequest.merged,
      );

    const now = new Date();

    return this.prisma.pullRequest.upsert({
      where: {
        repositoryId_githubPullRequestId: {
          repositoryId,
          githubPullRequestId,
        },
      },

      update: {
        githubNumber,

        authorId:
          author?.id ?? null,

        authorGithubId,
        authorLogin:
          pullRequest.user.login,

        title:
          pullRequest.title,

        body:
          pullRequest.body ?? null,

        state,

        isDraft:
          pullRequest.draft ?? false,

        additions:
          pullRequest.additions ?? 0,

        deletions:
          pullRequest.deletions ?? 0,

        changedFiles:
          pullRequest.changed_files ?? 0,

        headRef:
          pullRequest.head.ref,

        baseRef:
          pullRequest.base.ref,

        htmlUrl:
          pullRequest.html_url,

        openedAt:
          new Date(
            pullRequest.created_at,
          ),

        closedAt:
          pullRequest.closed_at
            ? new Date(
                pullRequest.closed_at,
              )
            : null,

        mergedAt:
          pullRequest.merged_at
            ? new Date(
                pullRequest.merged_at,
              )
            : null,

        lastSyncedAt: now,
      },

      create: {
        repositoryId,
        githubPullRequestId,
        githubNumber,

        authorId:
          author?.id ?? null,

        authorGithubId,
        authorLogin:
          pullRequest.user.login,

        title:
          pullRequest.title,

        body:
          pullRequest.body ?? null,

        state,

        isDraft:
          pullRequest.draft ?? false,

        additions:
          pullRequest.additions ?? 0,

        deletions:
          pullRequest.deletions ?? 0,

        changedFiles:
          pullRequest.changed_files ?? 0,

        headRef:
          pullRequest.head.ref,

        baseRef:
          pullRequest.base.ref,

        htmlUrl:
          pullRequest.html_url,

        openedAt:
          new Date(
            pullRequest.created_at,
          ),

        closedAt:
          pullRequest.closed_at
            ? new Date(
                pullRequest.closed_at,
              )
            : null,

        mergedAt:
          pullRequest.merged_at
            ? new Date(
                pullRequest.merged_at,
              )
            : null,

        lastSyncedAt: now,
      },
    });
  }

  private mapPullRequestState(
    state: string | undefined,
    merged: boolean | undefined,
  ): PullRequestState {
    if (merged) {
      return PullRequestState.MERGED;
    }

    if (state === 'open') {
      return PullRequestState.OPEN;
    }

    return PullRequestState.CLOSED;
  }
}