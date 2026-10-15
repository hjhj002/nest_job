import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { SharedModule } from '@shared';
import { AuthModule, JwtAuthGuard, PermissionsGuard } from './modules/auth';
import { RiskModule } from './modules/risk';
import { WebsocketModule } from './websocket/websocket.module';
import { BigscreenModule } from './modules/bigscreen/bigscreen.module';
import { AlertModule } from './modules/alert/alert.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { DecisionModule } from './modules/decision/decision.module';
import { AiProxyModule } from './modules/ai-proxy/ai-proxy.module';
import { LogModule } from './modules/log/log.module';
import { AgentConfigModule } from './modules/agent-config/agent-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/.env'],
    }),
    SharedModule,
    AuthModule,
    RiskModule,
    WebsocketModule,
    BigscreenModule,
    AlertModule,
    BlockchainModule,
    StatisticsModule,
    DecisionModule,
    AiProxyModule,
    LogModule,
    AgentConfigModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule {}
