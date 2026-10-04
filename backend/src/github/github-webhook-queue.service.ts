import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';

import {
  GITHUB_WEBHOOK_QUEUE,
  PROCESS_GITHUB_WEBHOOK_JOB,
} from './github-queue.constants';

@Injectable()
export class GithubWebhookQueueService {
  constructor(
    @InjectQueue(GITHUB_WEBHOOK_QUEUE)
    private readonly queue: Queue,
  ) {}

  async enqueue(
    deliveryId: string,
  ): Promise<void> {
    await this.queue.add(
      PROCESS_GITHUB_WEBHOOK_JOB,
      {
        deliveryId,
      },
      {
        jobId: `webhook-${deliveryId}`,

        attempts: 5,

        backoff: {
          type: 'exponential',
          delay: 2000,
        },

        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 1000,
        },

        removeOnFail: {
          age: 7 * 24 * 60 * 60,
          count: 5000,
        },
      },
    );
  }
}