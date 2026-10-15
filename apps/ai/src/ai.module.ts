import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '@shared';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentModule } from './agents/agent.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/.env'],
    }),
    SharedModule,
    AgentModule,
  ],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
