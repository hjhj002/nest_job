import { LoggerService } from '@shared';
import { BaseAgent, AgentResult, AgentStatus } from '../core/base-agent';
import { MessageBus, MessageType, AgentMessage, AgentType } from '../core/message-bus';
import { agentConfigLoader, AssessmentAgentConfig, AssessmentRule } from '../config/agent-config.loader';

/**
 * 变电站风险评估规则（运行时从配置加载）
 * weight: 风险权重（累加后换算成 riskScore 0-100）
 * riskType: 归属风险大类
 */
interface StationRule {
  code: string;
  name: string;
  riskType: string;
  condition: (metrics: any, anomalies: string[]) => boolean;
  weight: number;
}

export class AssessmentAgent extends BaseAgent {
  private assessmentConfig: AssessmentAgentConfig;
  private stationRules: StationRule[] = [];
  private maxWeight: number = 0;

  constructor(messageBus: MessageBus, loggerService?: LoggerService) {
    const config = agentConfigLoader.getAssessmentConfig();
    super(
      {
        name: AgentType.ASSESSMENT,
        description: config.agent.description,
        capabilities: config.agent.capabilities,
      },
      messageBus,
      loggerService,
    );
    this.assessmentConfig = config;
    this.buildRulesFromConfig();
  }

  /**
   * 从配置构建规则引擎
   */
  private buildRulesFromConfig(): void {
    this.stationRules = this.assessmentConfig.rules.map((rule: AssessmentRule) => ({
      code: rule.code,
      name: rule.name,
      riskType: rule.riskType,
      weight: rule.weight,
      condition: this.compileCondition(rule.condition),
    }));

    this.maxWeight = this.stationRules.reduce((sum, rule) => sum + rule.weight, 0);
    this.logger.log(`Loaded ${this.stationRules.length} assessment rules, maxWeight=${this.maxWeight}`);
  }

  /**
   * 编译条件字符串为函数
   */
  private compileCondition(conditionStr: string): (metrics: any, anomalies: string[]) => boolean {
    // 简单的条件编译器
    return (metrics: any, anomalies: string[]) => {
      try {
        // 使用 Function 构造器创建条件判断函数
        const fn = new Function('metrics', 'anomalies', `return ${conditionStr}`);
        return fn(metrics, anomalies);
      } catch (e) {
        this.logger.warn(`Failed to evaluate condition: ${conditionStr}`);
        return false;
      }
    };
  }

  protected subscribeToMessages() {
    this.messageBus.subscribe(MessageType.DATA_COLLECTED, this.handleDataCollected.bind(this));
  }

  private async handleDataCollected(message: AgentMessage) {
    this.logger.log(`Received DATA_COLLECTED, traceId=${message.traceId}`);
    const start = Date.now();
    const assessment = this.assessRisk(message.payload.data, message.traceId);
    await this.logStep({
      traceId: message.traceId,
      message: `Assessment: level=${assessment.riskLevel}, score=${assessment.riskScore}`,
      inputData: { data: message.payload.data },
      outputData: assessment,
      duration: Date.now() - start,
      riskId: assessment.riskId,
    });
    this.sendMessage(MessageType.RISK_ASSESSED, AgentType.DECISION, assessment, message.traceId);
  }

  async execute(input: string, context?: Record<string, any>): Promise<AgentResult> {
    const start = Date.now();
    this.status = AgentStatus.BUSY;
    try {
      const data = context?.data ?? {};
      const assessment = this.assessRisk(data, context?.traceId ?? '');
      this.status = AgentStatus.IDLE;
      return { success: true, data: assessment, duration: Date.now() - start };
    } catch (err: any) {
      this.status = AgentStatus.ERROR;
      return { success: false, error: err.message, duration: Date.now() - start };
    }
  }

  private assessRisk(data: any, traceId: string) {
    const metrics   = data.metrics  ?? data;
    const anomalies: string[] = data.anomalies ?? [];

    const matchedRules: { code: string; name: string; riskType: string; weight: number }[] = [];
    let   totalWeight = 0;

    for (const rule of this.stationRules) {
      if (rule.condition(metrics, anomalies)) {
        matchedRules.push({ code: rule.code, name: rule.name, riskType: rule.riskType, weight: rule.weight });
        totalWeight += rule.weight;
      }
    }

    // 归一化评分 0-100
    const normalizationFactor = this.assessmentConfig.scoring.normalizationFactor;
    const riskScore = Math.min(100, Math.round((totalWeight / this.maxWeight) * 100 * normalizationFactor));

    // 风险分级
    let riskLevel = 1;
    const riskLevels = this.assessmentConfig.riskLevels;
    for (const [level, config] of Object.entries(riskLevels)) {
      if (riskScore >= config.minScore && riskScore <= config.maxScore) {
        riskLevel = parseInt(level);
        break;
      }
    }

    // 主要风险类型（命中权重最大的规则）
    const primaryRule = matchedRules.sort((a, b) => b.weight - a.weight)[0];
    const primaryRiskType = primaryRule?.riskType ?? 'normal';

    this.logger.log(
      `Assessment done: level=${riskLevel} score=${riskScore} rules=[${matchedRules.map(r=>r.code).join(',')}]`,
    );

    return {
      riskId:          `risk-station-${Date.now()}`,
      stationId:       data.stationId ?? 'UNKNOWN',
      deviceId:        data.deviceId  ?? 'UNKNOWN',
      riskLevel,
      riskScore,
      primaryRiskType,
      matchedRules,
      anomalies,
      recommendation:  riskLevels[riskLevel.toString()]?.recommendation ?? '未知风险等级',
      timestamp:       new Date().toISOString(),
      traceId,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): AssessmentAgentConfig {
    return this.assessmentConfig;
  }

  /**
   * 获取所有规则
   */
  getRules(): StationRule[] {
    return this.stationRules;
  }

  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    this.assessmentConfig = agentConfigLoader.reloadConfig<AssessmentAgentConfig>('assessment-agent');
    this.buildRulesFromConfig();
    this.logger.log('Configuration reloaded');
  }
}
