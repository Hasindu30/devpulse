import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { WebhookStatus } from '../generated/prisma/enums';
import { GithubWebhookService } from './github-webhook.service';

describe('GithubWebhookService', () => {
  let service: GithubWebhookService;

  const webhookSecret = 'test-webhook-secret';

  const configMock = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'GITHUB_WEBHOOK_SECRET') {
        return webhookSecret;
      }

      throw new Error(`Missing config: ${key}`);
    }),
  };

  const prismaMock = {
    repository: {
      findFirst: jest.fn(),
    },

    webhookEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          GithubWebhookService,
          {
            provide: ConfigService,
            useValue: configMock,
          },
          {
            provide: PrismaService,
            useValue: prismaMock,
          },
        ],
      }).compile();

    service = module.get<GithubWebhookService>(
      GithubWebhookService,
    );
  });

  describe('verifySignature', () => {
    it('should accept a valid GitHub signature', () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          action: 'opened',
        }),
      );

      const signature =
        `sha256=${createHmac(
          'sha256',
          webhookSecret,
        )
          .update(rawBody)
          .digest('hex')}`;

      expect(() =>
        service.verifySignature(
          rawBody,
          signature,
        ),
      ).not.toThrow();
    });

    it('should reject a missing signature', () => {
      const rawBody = Buffer.from('{}');

      expect(() =>
        service.verifySignature(
          rawBody,
          undefined,
        ),
      ).toThrow(UnauthorizedException);
    });

    it('should reject an invalid signature', () => {
      const rawBody = Buffer.from('{}');

      expect(() =>
        service.verifySignature(
          rawBody,
          'sha256=invalid',
        ),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('recordWebhookEvent', () => {
    it('should record a new webhook event', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          action: 'opened',

          repository: {
            id: 123456,
          },

          installation: {
            id: 167869995,
          },
        }),
      );

      prismaMock.repository.findFirst.mockResolvedValue({
        id: 'repository-id',
      });

      prismaMock.webhookEvent.create.mockResolvedValue({
        id: 'event-id',
      });

      const result =
        await service.recordWebhookEvent(
          'delivery-id-1',
          'pull_request',
          rawBody,
        );

      expect(result).toEqual({
        duplicate: false,
      });

      expect(
        prismaMock.repository.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          githubRepositoryId: '123456',

          installation: {
            is: {
              githubInstallationId:
                '167869995',
            },
          },
        },

        select: {
          id: true,
        },
      });

      expect(
        prismaMock.webhookEvent.create,
      ).toHaveBeenCalledWith({
        data: {
          deliveryId: 'delivery-id-1',
          eventName: 'pull_request',
          action: 'opened',
          status: WebhookStatus.RECEIVED,
          repositoryId: 'repository-id',
          payload: expect.objectContaining({
            action: 'opened',
          }),
        },
      });
    });

    it('should allow webhook events without a known repository', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          action: 'opened',

          repository: {
            id: 999999,
          },
        }),
      );

      prismaMock.repository.findFirst.mockResolvedValue(
        null,
      );

      prismaMock.webhookEvent.create.mockResolvedValue({
        id: 'event-id',
      });

      const result =
        await service.recordWebhookEvent(
          'delivery-id-2',
          'pull_request',
          rawBody,
        );

      expect(result).toEqual({
        duplicate: false,
      });

      expect(
        prismaMock.webhookEvent.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          repositoryId: undefined,
        }),
      });
    });

    it('should return duplicate when delivery id already exists', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          action: 'opened',
        }),
      );

      prismaMock.webhookEvent.create.mockRejectedValue({
        code: 'P2002',
      });

      const result =
        await service.recordWebhookEvent(
          'duplicate-delivery',
          'pull_request',
          rawBody,
        );

      expect(result).toEqual({
        duplicate: true,
      });
    });

    it('should reject invalid JSON payload', async () => {
      const rawBody = Buffer.from(
        'this-is-not-json',
      );

      await expect(
        service.recordWebhookEvent(
          'delivery-id-3',
          'pull_request',
          rawBody,
        ),
      ).rejects.toBeInstanceOf(
        BadRequestException,
      );

      expect(
        prismaMock.webhookEvent.create,
      ).not.toHaveBeenCalled();
    });

    it('should rethrow unexpected database errors', async () => {
      const rawBody = Buffer.from(
        JSON.stringify({
          action: 'opened',
        }),
      );

      const databaseError =
        new Error('Database unavailable');

      prismaMock.webhookEvent.create.mockRejectedValue(
        databaseError,
      );

      await expect(
        service.recordWebhookEvent(
          'delivery-id-4',
          'pull_request',
          rawBody,
        ),
      ).rejects.toBe(databaseError);
    });
  });
});