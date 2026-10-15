import { LoggerService } from '@shared';
import { BaseAgent, AgentResult, AgentStatus } from '../core/base-agent';
import { MessageBus, MessageType, AgentMessage, AgentType } from '../core/message-bus';
import { agentConfigLoader, DecisionAgentConfig, DecisionStrategy } from '../config/agent-config.loader';

/** 变电站风险类型 */
type RiskType = 'device_fault' | 'grid_operation' | 'outage_risk' | 'safety_work' | 'unknown';

/**
 * 策略接口（内部使用）
 */
interface Strategy {
  code: string;
  name: string;
  measures: string[];
  channels: string[];
  blockchainRequired: boolean;
  triggerAlert: boolean;
  requireManual: boolean;
}

export class DecisionAgent extends BaseAgent {
  private decisionConfig: DecisionAgentConfig;
  private strategyMatrix: Record<RiskType, Record<number, Strategy>> = {
    device_fault: {},
    grid_operation: {},
    outage_risk: {},
    safety_work: {},
    unknown: {},
  } as Record<RiskType, Record<number, Strategy>>;

  constructor(messageBus: MessageBus, loggerService?: LoggerService) {
    const config = agentConfigLoader.getDecisionConfig();
    super(
      {
        name: AgentType.DECISION,
        description: config.agent.description,
        capabilities: config.agent.capabilities,
      },
      messageBus,
      loggerService,
    );
    this.decisionConfig = config;
    this.buildStrategyMatrixFromConfig();
  }

  /**
   * 从配置构建策略矩阵
   */
  private buildStrategyMatrixFromConfig(): void {
    const matrix = this.decisionConfig.strategyMatrix;
    
    for (const [riskType, levels] of Object.entries(matrix)) {
      const typedRiskType = riskType as RiskType;
      this.strategyMatrix[typedRiskType] = {};
      
      for (const [level, strategy] of Object.entries(levels)) {
        const levelNum = parseInt(level);
        this.strategyMatrix[typedRiskType][levelNum] = {
          code: strategy.code,
          name: strategy.name,
          measures: strategy.measures,
          channels: strategy.channels,
          blockchainRequired: strategy.blockchainRequired,
          triggerAlert: strategy.triggerAlert,
          requireManual: strategy.requireManual,
        };
      }
    }

    const strategyCount = Object.values(matrix).reduce(
      (sum, levels) => sum + Object.keys(levels).length, 
      0
    );
    this.logger.log(`Loaded ${strategyCount} decision strategies`);
  }

  protected subscribeToMessages() {
    this.messageBus.subscribe(MessageType.RISK_ASSESSED, this.handleRiskAssessed.bind(this));
  }

  private async handleRiskAssessed(message: AgentMessage) {
    this.logger.log(`Received RISK_ASSESSED, traceId=${message.traceId}`);
    const start = Date.now();
    const assessment = message.payload;
    const decision = this.makeDecision(assessment);

    await this.logStep({
      traceId: message.traceId,
      message: `Decision: strategy=${decision.strategyCode}, alert=${decision.triggerAlert}, blockchain=${decision.blockchainStored}`,
      inputData: { assessment },
      outputData: decision,
      duration: Date.now() - start,
      riskId: decision.riskId,
    });

    this.sendMessage(MessageType.DECISION_MADE, AgentType.COLLECTION, decision, message.traceId);

    if (decision.triggerAlert) {
      this.sendMessage(
        MessageType.ALERT_TRIGGERED,
        'all',
        {
          riskId: decision.riskId,
          riskLevel: assessment.riskLevel,
          primaryRiskType: assessment.primaryRiskType,
          strategyCode: decision.strategyCode,
          requireManual: decision.requireManual,
          timestamp: new Date().toISOString(),
        },
        message.traceId,
      );
    }

    if (decision.blockchainStored) {
      this.sendMessage(
        MessageType.EVIDENCE_STORED,
        'all',
        {
          riskId: decision.riskId,
          riskEventNo: assessment.riskEventNo || `RISK-${decision.riskId}`,
          assessment,
          decision,
          timestamp: new Date().toISOString(),
        },
        message.traceId,
      );
    }
  }

  async execute(input: string, context?: Record<string, any>): Promise<AgentResult> {
    const start = Date.now();
    this.status = AgentStatus.BUSY;
    try {
      const assessment = context?.assessment ?? {};
      const decision = this.makeDecision(assessment);
      this.status = AgentStatus.IDLE;
      return { success: true, data: decision, duration: Date.now() - start };
    } catch (err: any) {
      this.status = AgentStatus.ERROR;
      return { success: false, error: err.message, duration: Date.now() - start };
    }
  }

  private makeDecision(assessment: any) {
    const riskLevel: number = Math.min(Math.max(assessment.riskLevel ?? 1, 1), 4);
    const primaryRiskType: RiskType = (assessment.primaryRiskType as RiskType) ?? 'unknown';

    const typeMatrix = this.strategyMatrix[primaryRiskType] ?? this.strategyMatrix['unknown'];
    const strategy: Strategy = typeMatrix[riskLevel] ?? typeMatrix[1] ?? {
      code: 'GEN-L1',
      name: '通用策略',
      measures: ['记录日志'],
      channels: ['system_log'],
      blockchainRequired: false,
      triggerAlert: false,
      requireManual: false,
    };

    this.logger.log(
      `Decision: riskId=${assessment.riskId}, type=${primaryRiskType}, level=${riskLevel}, strategy=${strategy.code}`,
    );

    return {
      riskId: assessment.riskId,
      strategyCode: strategy.code,
      strategyName: strategy.name,
      measures: strategy.measures,
      channels: strategy.channels,
      blockchainStored: strategy.blockchainRequired,
      triggerAlert: strategy.triggerAlert,
      requireManual: strategy.requireManual,
      decidedAt: new Date().toISOString(),
      // 兼容旧字段名
      alertSent: strategy.triggerAlert,
      actions: strategy.measures,
    };
  }

  /**
   * 获取所有策略（供 API 展示）
   */
  getAllStrategies(): Strategy[] {
    const result: Strategy[] = [];
    for (const typeMap of Object.values(this.strategyMatrix)) {
      for (const s of Object.values(typeMap)) {
        result.push(s);
      }
    }
    return result;
  }

  /**
   * 获取配置
   */
  getConfig(): DecisionAgentConfig {
    return this.decisionConfig;
  }

  /**
   * 获取风险类型定义
   */
  getRiskTypes(): Record<string, { name: string; description: string }> {
    return this.decisionConfig.riskTypes;
  }

  /**
   * 获取通知渠道定义
   */
  getChannels(): Record<string, { name: string; description: string }> {
    return this.decisionConfig.channels;
  }

  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    this.decisionConfig = agentConfigLoader.reloadConfig<DecisionAgentConfig>('decision-agent');
    this.buildStrategyMatrixFromConfig();
    this.logger.log('Configuration reloaded');
  }
}
