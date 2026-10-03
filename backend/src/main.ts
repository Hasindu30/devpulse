import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
    new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.API_PORT ?? 4000;

  await app.listen(port);

  console.log(`DevPulse API running on http://localhost:${port}`);
}

void bootstrap();