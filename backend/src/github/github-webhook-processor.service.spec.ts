import {
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../database/prisma.service';
import { WebhookStatus } from '../generated/prisma/enums';
import { GithubPullRequestService } from './github-pull-request.service';
import { GithubWebhookProcessorService } from './github-webhook-processor.service';

describe('GithubWebhookProcessorService', () => {
  let service: GithubWebhookProcessorService;

  const prismaMock = {
    webhookEvent: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const pullRequestServiceMock = {
    syncFromWebhook: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          GithubWebhookProcessorService,
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
          {
            provide: GithubPullRequestService,
            useValue: pullRequestServiceMock,
          },
        ],
      }).compile();

    service =
      module.get<GithubWebhookProcessorService>(
        GithubWebhookProcessorService,
      );
  });

  it('should process a pull_request event', async () => {
    const payload = {
      action: 'opened',
    };

    prismaMock.webhookEvent.findUnique.mockResolvedValue({
      deliveryId: 'delivery-1',
      eventName: 'pull_request',
      repositoryId: 'repository-id',
      payload,
      status: WebhookStatus.RECEIVED,
    });

    prismaMock.webhookEvent.update.mockResolvedValue({
      deliveryId: 'delivery-1',
    });

    pullRequestServiceMock.syncFromWebhook.mockResolvedValue(
      {},
    );

    await service.processStoredEvent(
      'delivery-1',
    );

    expect(
      pullRequestServiceMock.syncFromWebhook,
    ).toHaveBeenCalledWith(
      'repository-id',
      payload,
    );

    expect(
      prismaMock.webhookEvent.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WebhookStatus.PROCESSED,
        }),
      }),
    );
  });

  it('should ignore unsupported webhook events', async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue({
      deliveryId: 'delivery-2',
      eventName: 'push',
      repositoryId: 'repository-id',
      payload: {},
      status: WebhookStatus.RECEIVED,
    });

    prismaMock.webhookEvent.update.mockResolvedValue({
      deliveryId: 'delivery-2',
    });

    await service.processStoredEvent(
      'delivery-2',
    );

    expect(
      pullRequestServiceMock.syncFromWebhook,
    ).not.toHaveBeenCalled();

    expect(
      prismaMock.webhookEvent.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WebhookStatus.IGNORED,
        }),
      }),
    );
  });

  it('should not reprocess an already processed event', async () => {
    const event = {
      deliveryId: 'delivery-3',
      eventName: 'pull_request',
      repositoryId: 'repository-id',
      payload: {},
      status: WebhookStatus.PROCESSED,
    };

    prismaMock.webhookEvent.findUnique.mockResolvedValue(
      event,
    );

    const result =
      await service.processStoredEvent(
        'delivery-3',
      );

    expect(result).toEqual(event);

    expect(
      prismaMock.webhookEvent.update,
    ).not.toHaveBeenCalled();

    expect(
      pullRequestServiceMock.syncFromWebhook,
    ).not.toHaveBeenCalled();
  });

  it('should mark a failed pull request event as FAILED', async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue({
      deliveryId: 'delivery-4',
      eventName: 'pull_request',
      repositoryId: 'repository-id',
      payload: {},
      status: WebhookStatus.RECEIVED,
    });

    prismaMock.webhookEvent.update.mockResolvedValue({
      deliveryId: 'delivery-4',
    });

    pullRequestServiceMock.syncFromWebhook.mockRejectedValue(
      new Error('PR synchronization failed'),
    );

    await expect(
      service.processStoredEvent(
        'delivery-4',
      ),
    ).rejects.toThrow(
      'PR synchronization failed',
    );

    expect(
      prismaMock.webhookEvent.update,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: WebhookStatus.FAILED,
          errorMessage:
            'PR synchronization failed',
        }),
      }),
    );
  });

  it('should throw when webhook event does not exist', async () => {
    prismaMock.webhookEvent.findUnique.mockResolvedValue(
      null,
    );

    await expect(
      service.processStoredEvent(
        'missing-delivery',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});