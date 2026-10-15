import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AiModule } from './ai.module';

async function bootstrap() {
  const app = await NestFactory.create(AiModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();

  const port = process.env.AI_PORT ?? 3001;
  await app.listen(port);
  console.log(`[AI] Running on http://localhost:${port}`);
}

void bootstrap();
