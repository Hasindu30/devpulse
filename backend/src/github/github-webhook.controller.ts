import {
  BadRequestException,
  Controller,
  Headers,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

import { GithubWebhookQueueService } from './github-webhook-queue.service';
import { GithubWebhookService } from './github-webhook.service';

@Controller('github/webhooks')
export class GithubWebhookController {
  constructor(
    private readonly githubWebhookService:
      GithubWebhookService,

    private readonly githubWebhookQueueService:
      GithubWebhookQueueService,
  ) {}

  @Post()
  async receiveWebhook(
    @Req()
    request: RawBodyRequest<Request>,

    @Headers('x-hub-signature-256')
    signature: string | undefined,

    @Headers('x-github-delivery')
    deliveryId: string | undefined,

    @Headers('x-github-event')
    eventName: string | undefined,
  ) {
    if (!request.rawBody) {
      throw new BadRequestException(
        'Webhook raw body is unavailable',
      );
    }

    if (!deliveryId || !eventName) {
      throw new BadRequestException(
        'Missing GitHub webhook headers',
      );
    }

    this.githubWebhookService.verifySignature(
      request.rawBody,
      signature,
    );

    const result =
      await this.githubWebhookService.recordWebhookEvent(
        deliveryId,
        eventName,
        request.rawBody,
      );

    await this.githubWebhookQueueService.enqueue(
      deliveryId,
    );

    return {
      received: true,
      queued: true,
      duplicate: result.duplicate,
      deliveryId,
      eventName,
    };
  }
}