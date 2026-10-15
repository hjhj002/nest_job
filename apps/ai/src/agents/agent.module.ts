import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MessageBus } from './core/message-bus';
import { AgentOrchestrator } from './core/agent-orchestrator';

@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [MessageBus, AgentOrchestrator],
  exports: [MessageBus, AgentOrchestrator],
})
export class AgentModule {}
