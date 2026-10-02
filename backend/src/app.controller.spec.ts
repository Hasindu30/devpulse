import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './database/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  const prismaMock = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return API health information', () => {
      const result = appController.getHealth();

      expect(result).toEqual({
        status: 'ok',
        service: 'devpulse-api',
        timestamp: expect.any(String),
      });

      expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
    });
  });

  describe('database health', () => {
    it('should return database health information', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await appController.getDatabaseHealth();

      expect(result).toEqual({
        status: 'ok',
        database: 'postgresql',
      });

      expect(prismaMock.$queryRaw).toHaveBeenCalled();
    });
  });
});