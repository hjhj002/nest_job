import { Injectable } from '@nestjs/common';
import { ConsoleLogger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LogStepParams {
  traceId: string;
  agentName: string;
  agentType: string;
  level?: string;
  message: string;
  inputData?: any;
  outputData?: any;
  duration?: number;
  riskId?: string;
  metadata?: any;
}

@Injectable()
export class LoggerService extends ConsoleLogger {
  constructor(private prisma: PrismaService) {
    super();
  }

  async logStep(params: LogStepParams) {
    const level = params.level || 'info';
    const prefix = `[${params.agentName}]`;

    if (level === 'error') super.error(`${prefix} ${params.message}`);
    else if (level === 'warn') super.warn(`${prefix} ${params.message}`);
    else super.log(`${prefix} ${params.message}`);

    try {
      await this.prisma.agentLog.create({
        data: {
          traceId: params.traceId,
          agentName: params.agentName,
          agentType: params.agentType,
          level,
          message: params.message,
          inputData: params.inputData,
          outputData: params.outputData,
          duration: params.duration,
          riskId: params.riskId,
          metadata: params.metadata,
        },
      });
    } catch {
      // DB write failure should not crash the caller
    }
  }

  // Fire-and-forget DB write (for high-frequency logs)
  logStepAsync(params: LogStepParams) {
    this.logStep(params).catch(() => {});
  }
}
