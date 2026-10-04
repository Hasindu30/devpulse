import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { WebhookStatus } from '../generated/prisma/enums';

@Injectable()
export class GithubWebhookService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  verifySignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): void {
    if (!signature) {
      throw new UnauthorizedException(
        'Missing GitHub webhook signature',
      );
    }

    const secret =
      this.configService.getOrThrow<string>(
        'GITHUB_WEBHOOK_SECRET',
      );

    const expectedSignature =
      `sha256=${createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex')}`;

    const receivedBuffer =
      Buffer.from(signature);

    const expectedBuffer =
      Buffer.from(expectedSignature);

    if (
      receivedBuffer.length !==
        expectedBuffer.length ||
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer,
      )
    ) {
      throw new UnauthorizedException(
        'Invalid GitHub webhook signature',
      );
    }
  }

  async recordWebhookEvent(
    deliveryId: string,
    eventName: string,
    rawBody: Buffer,
  ): Promise<{ duplicate: boolean }> {
    let payload: Record<string, unknown>;

    try {
      payload = JSON.parse(
        rawBody.toString('utf8'),
      ) as Record<string, unknown>;
    } catch {
      throw new BadRequestException(
        'Invalid GitHub webhook payload',
      );
    }

    const action =
      typeof payload.action === 'string'
        ? payload.action
        : undefined;

    const githubRepositoryId =
      this.getNestedId(
        payload,
        'repository',
      );

    const githubInstallationId =
      this.getNestedId(
        payload,
        'installation',
      );

    let repositoryId: string | undefined;

    if (githubRepositoryId) {
      const repository =
        await this.prisma.repository.findFirst({
          where: {
            githubRepositoryId,

            ...(githubInstallationId
              ? {
                  installation: {
                    is: {
                      githubInstallationId,
                    },
                  },
                }
              : {}),
          },

          select: {
            id: true,
          },
        });

      repositoryId = repository?.id;
    }

    try {
      await this.prisma.webhookEvent.create({
        data: {
          deliveryId,
          eventName,
          action,
          status: WebhookStatus.RECEIVED,
          repositoryId,
          payload:
            payload as Prisma.InputJsonValue,
        },
      });

      return {
        duplicate: false,
      };
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        return {
          duplicate: true,
        };
      }

      throw error;
    }
  }

  private getNestedId(
    payload: Record<string, unknown>,
    key: string,
  ): string | undefined {
    const value = payload[key];

    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return undefined;
    }

    const id = (
      value as Record<string, unknown>
    ).id;

    if (
      typeof id !== 'string' &&
      typeof id !== 'number'
    ) {
      return undefined;
    }

    return String(id);
  }

  private isUniqueConstraintError(
    error: unknown,
  ): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code ===
        'P2002'
    );
  }
}