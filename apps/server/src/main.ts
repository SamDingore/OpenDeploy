import './env-bootstrap';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function parseExtraOrigins(): string[] {
  const raw = process.env.WEB_APP_URLS?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isLocalLoopbackOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    return (
      u.protocol === 'http:' &&
      (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const webOrigin = process.env.WEB_APP_URL?.trim() || 'http://localhost:3000';
  const allowList = new Set<string>([webOrigin, ...parseExtraOrigins()]);
  const isProd = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowList.has(origin)) {
        callback(null, true);
        return;
      }
      if (!isProd && isLocalLoopbackOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
