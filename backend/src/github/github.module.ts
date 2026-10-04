import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { TeamsModule } from '../teams/teams.module';

import { GithubAppService } from './github-app/github-app.service';
import { GithubInstallationsController } from './github-installations.controller';
import { GithubInstallationsService } from './github-installations.service';
import { GithubPullRequestService } from './github-pull-request.service';
import { GITHUB_WEBHOOK_QUEUE } from './github-queue.constants';
import { GithubWebhookController } from './github-webhook.controller';
import { GithubWebhookProcessorService } from './github-webhook-processor.service';
import { GithubWebhookQueueService } from './github-webhook-queue.service';
import { GithubWebhookService } from './github-webhook.service';
import { GithubWebhookWorker } from './github-webhook.worker';

@Module({
  imports: [
    AuthModule,
    TeamsModule,

    BullModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (
        configService: ConfigService,
      ) => {
        const redisUrl = new URL(
          configService.getOrThrow<string>(
            'REDIS_URL',
          ),
        );

        return {
          connection: {
            host: redisUrl.hostname,
            port: Number(
              redisUrl.port || 6379,
            ),

            username:
              redisUrl.username
                ? decodeURIComponent(
                    redisUrl.username,
                  )
                : undefined,

            password:
              redisUrl.password
                ? decodeURIComponent(
                    redisUrl.password,
                  )
                : undefined,

            ...(redisUrl.protocol === 'rediss:'
              ? {
                  tls: {},
                }
              : {}),
          },
        };
      },
    }),

    BullModule.registerQueue({
      name: GITHUB_WEBHOOK_QUEUE,
    }),
  ],

  controllers: [
    GithubInstallationsController,
    GithubWebhookController,
  ],

  providers: [
    GithubAppService,
    GithubInstallationsService,
    GithubPullRequestService,
    GithubWebhookService,
    GithubWebhookProcessorService,
    GithubWebhookQueueService,
    GithubWebhookWorker,
  ],

  exports: [
    GithubAppService,
  ],
})
export class GithubModule {}