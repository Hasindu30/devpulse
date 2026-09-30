import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
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
});