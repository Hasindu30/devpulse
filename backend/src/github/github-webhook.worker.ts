import {
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import type { Job } from 'bullmq';

import {
  GITHUB_WEBHOOK_QUEUE,
  PROCESS_GITHUB_WEBHOOK_JOB,
} from './github-queue.constants';
import { GithubWebhookProcessorService } from './github-webhook-processor.service';

type GithubWebhookJobData = {
  deliveryId: string;
};

@Processor(GITHUB_WEBHOOK_QUEUE)
export class GithubWebhookWorker extends WorkerHost {
  constructor(
    private readonly githubWebhookProcessorService:
      GithubWebhookProcessorService,
  ) {
    super();
  }

  async process(
    job: Job<GithubWebhookJobData>,
  ): Promise<void> {
    if (
      job.name !==
      PROCESS_GITHUB_WEBHOOK_JOB
    ) {
      return;
    }

    await this.githubWebhookProcessorService.processStoredEvent(
      job.data.deliveryId,
    );
  }
}