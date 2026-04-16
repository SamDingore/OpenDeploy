import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded, type Request } from 'express';
import { AppModule } from './app.module';

type RawRequest = Request & { rawBody?: Buffer };

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(
    json({
      limit: '2mb',
      verify: (req: RawRequest, _res, buf) => {
        req.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(urlencoded({ extended: true }));

  app.enableCors({
    origin: process.env['APP_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port);
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
