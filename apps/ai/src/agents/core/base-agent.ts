import { Logger } from '@nestjs/common';
import { LoggerService } from '@shared';
import { MessageBus, MessageType, AgentMessage } from './message-bus';

export enum AgentStatus {
  IDLE  = 'idle',
  BUSY  = 'busy',
  ERROR = 'error',
}

export interface AgentConfig {
  name: string;
  description: string;
  capabilities: string[];
}

export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
}

export abstract class BaseAgent {
  protected logger: Logger;
  protected status: AgentStatus = AgentStatus.IDLE;

  constructor(
    protected config: AgentConfig,
    protected messageBus: MessageBus,
    protected loggerService?: LoggerService,
  ) {
    this.logger = new Logger(config.name);
  }

  async initialize() {
    this.subscribeToMessages();
    this.logger.log(`${this.config.name} initialized`);
  }

  abstract execute(input: string, context?: Record<string, any>): Promise<AgentResult>;
  protected abstract subscribeToMessages(): void;

  protected sendMessage(
    type: MessageType,
    receiver: string,
    payload: any,
    traceId: string,
  ) {
    this.messageBus.publish({ type, sender: this.config.name, receiver, payload, traceId });
  }

  protected async logStep(params: {
    traceId: string;
    level?: string;
    message: string;
    inputData?: any;
    outputData?: any;
    duration?: number;
    riskId?: string;
  }) {
    if (!this.loggerService) return;
    await this.loggerService.logStep({
      traceId: params.traceId,
      agentName: this.config.name,
      agentType: this.config.name.replace('Agent', '').toLowerCase(),
      level: params.level || 'info',
      message: params.message,
      inputData: params.inputData,
      outputData: params.outputData,
      duration: params.duration,
      riskId: params.riskId,
    });
  }

  getStatus() {
    return {
      name: this.config.name,
      status: this.status,
      capabilities: this.config.capabilities,
    };
  }

  async stop() {
    this.status = AgentStatus.IDLE;
    this.logger.log(`${this.config.name} stopped`);
  }
}
