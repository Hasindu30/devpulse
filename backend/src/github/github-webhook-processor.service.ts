import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { WebhookStatus } from '../generated/prisma/enums';
import { GithubPullRequestService } from './github-pull-request.service';

@Injectable()
export class GithubWebhookProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubPullRequestService: GithubPullRequestService,
  ) {}

  async processStoredEvent(
    deliveryId: string,
  ) {
    const event =
      await this.prisma.webhookEvent.findUnique({
        where: {
          deliveryId,
        },
      });

    if (!event) {
      throw new NotFoundException(
        'Webhook event not found',
      );
    }

    if (
      event.status === WebhookStatus.PROCESSED ||
      event.status === WebhookStatus.IGNORED
    ) {
      return event;
    }

    await this.markProcessing(deliveryId);

    try {
      if (
        event.eventName === 'pull_request' &&
        event.repositoryId
      ) {
        await this.githubPullRequestService.syncFromWebhook(
          event.repositoryId,
          event.payload,
        );

        return this.markProcessed(
          deliveryId,
        );
      }

      return this.markIgnored(
        deliveryId,
      );
    } catch (error) {
      await this.markFailed(
        deliveryId,
        error,
      );

      throw error;
    }
  }

  async markProcessing(
    deliveryId: string,
  ) {
    return this.prisma.webhookEvent.update({
      where: {
        deliveryId,
      },

      data: {
        status: WebhookStatus.PROCESSING,

        attempts: {
          increment: 1,
        },

        errorMessage: null,
      },
    });
  }

  async markProcessed(
    deliveryId: string,
  ) {
    return this.prisma.webhookEvent.update({
      where: {
        deliveryId,
      },

      data: {
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  async markFailed(
    deliveryId: string,
    error: unknown,
  ) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown webhook processing error';

    return this.prisma.webhookEvent.update({
      where: {
        deliveryId,
      },

      data: {
        status: WebhookStatus.FAILED,
        processedAt: new Date(),
        errorMessage: message,
      },
    });
  }

  async markIgnored(
    deliveryId: string,
  ) {
    return this.prisma.webhookEvent.update({
      where: {
        deliveryId,
      },

      data: {
        status: WebhookStatus.IGNORED,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  }
}