import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  configureApp(app, config);

  const port = Number(config.get<string>('PORT') ?? 4000);
  const prefix = config.get<string>('API_PREFIX') ?? 'api';

  await app.listen(port);
  console.log(`getownly API listening on http://localhost:${port}/${prefix}`);
}

void bootstrap();
