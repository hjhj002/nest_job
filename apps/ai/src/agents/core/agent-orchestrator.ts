import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MessageBus, MessageType, AgentMessage } from './message-bus';
import { BlockchainService, LoggerService, PrismaService } from '@shared';
import { BaseAgent } from './base-agent';
import { CollectionAgent } from '../collection-agent/collection.agent';
import { AssessmentAgent } from '../assessment-agent/assessment.agent';
import { DecisionAgent } from '../decision-agent/decision.agent';

export interface WorkflowResult {
  traceId: string;
  collected: boolean;
  assessed: boolean;
  decided: boolean;
  results: Record<string, any>;
  duration: number;
}

/**
 * AgentOrchestrator —— 多智能体编排器（核心调度中枢）
 *
 * 职责：
 *   1. 在 NestJS 模块初始化阶段完成三个核心智能体（采集、评估、决策）的实例化与注册；
 *   2. 订阅 MessageBus 上的关键事件（决策完成、告警触发、证据上链）并执行对应处理逻辑；
 *   3. 对外提供风险研判工作流 executeRiskWorkflow：
 *      按「采集 → 评估 → 决策」的顺序串联智能体，汇总结果并落库、上链；
 *   4. 将风险事件（RiskEvent）、告警记录（AlertRecord）等核心数据持久化到数据库，
 *      关键决策结果通过区块链服务完成存证，保证数据不可篡改。
 */
@Injectable()
export class AgentOrchestrator implements OnModuleInit {
  // 日志实例，用于输出编排器运行状态
  private readonly logger = new Logger(AgentOrchestrator.name);
  // 智能体注册表，key 为智能体名称，value 为智能体实例
  private agents = new Map<string, BaseAgent>();

  // 依赖注入：消息总线、区块链服务、日志服务、Prisma 数据库服务
  constructor(
    private messageBus: MessageBus,
    private blockchain: BlockchainService,
    private loggerService: LoggerService,
    private prisma: PrismaService,
  ) {}

  /**
   * NestJS 生命周期钩子：模块初始化完成后调用
   * 在此完成：
   *   1. 创建并初始化三个核心智能体；
   *   2. 将智能体注册到内部注册表；
   *   3. 订阅消息总线上的关键事件（决策完成、告警触发、证据上链）。
   */
  async onModuleInit() {
    // 实例化三个核心智能体
    const collectionAgent = new CollectionAgent(this.messageBus, this.loggerService);
    const assessmentAgent = new AssessmentAgent(this.messageBus, this.loggerService);
    const decisionAgent = new DecisionAgent(this.messageBus, this.loggerService);

    // 执行各智能体的初始化操作（如加载配置、连接 LLM 等）
    await collectionAgent.initialize();
    await assessmentAgent.initialize();
    await decisionAgent.initialize();

    // 统一注册到编排器
    this.registerAgent(collectionAgent);
    this.registerAgent(assessmentAgent);
    this.registerAgent(decisionAgent);

    // 订阅消息总线事件：仅订阅 DECISION_MADE（决策完成日志）。
    // 注意：ALERT_TRIGGERED 与 EVIDENCE_STORED 不再订阅，
    // 因为这两条消息会在 persistRiskEvent 完成 RiskEvent 写入之前到达，
    // 导致 AlertRecord / BlockchainLog 因外键约束（riskEventId 不存在）而写入失败。
    // AlertRecord 与区块链上链均改为在 persistRiskEvent 内部、RiskEvent 创建成功之后顺序执行。
    this.messageBus.subscribe(MessageType.DECISION_MADE, this.handleDecisionMade.bind(this));

    this.logger.log(`Orchestrator ready with ${this.agents.size} agents`);
  }

  /**
   * 将一个智能体注册到编排器内部注册表
   * @param agent 继承自 BaseAgent 的智能体实例
   */
  private registerAgent(agent: BaseAgent) {
    const { name } = agent.getStatus();
    this.agents.set(name, agent);
    this.logger.log(`Agent registered: ${name}`);
  }

  /**
   * 根据名称获取智能体实例
   * @param name 智能体注册名（如 'CollectionAgent'）
   */
  getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * 获取当前所有已注册智能体的状态快照
   */
  getAllAgentStatus() {
    return Array.from(this.agents.values()).map((a) => a.getStatus());
  }

  /**
   * 执行风险研判工作流（核心对外接口）
   *
   * 执行流程：
   *   1. 生成全局链路追踪 ID（traceId），用于串联本次工作流所有日志与消息；
   *   2. 调用「采集代理」对设备原始数据进行采集与预处理；
   *   3. 并行等待「评估代理」输出的 RISK_ASSESSED 消息与「决策代理」输出的 DECISION_MADE 消息；
   *   4. 汇总评估结果与决策建议，写入 RiskEvent 表；
   *   5. 记录工作流耗时并写入日志服务，返回 WorkflowResult。
   *
   * @param deviceData 设备上报的原始数据（键值对形式）
   * @returns 工作流执行结果（包含 traceId、风险等级、评分、决策建议等）
   */
  async executeRiskWorkflow(deviceData: Record<string, any>): Promise<WorkflowResult> {
    const start = Date.now();
    // 生成全局唯一的链路追踪 ID，串联本次工作流所有步骤
    const traceId = this.messageBus.generateTraceId();
    this.logger.log(`Starting risk workflow: ${traceId}`);

    // 记录工作流开始步骤到日志服务
    await this.loggerService.logStep({
      traceId, agentName: 'Orchestrator', agentType: 'orchestrator',
      message: 'Workflow started', inputData: { deviceData },
    });

    // 初始化工作流结果对象
    const result: WorkflowResult = {
      traceId,
      collected: false,
      assessed: false,
      decided: false,
      results: {},
      duration: 0,
    };

    try {
      // 获取采集代理，不存在则抛出错误
      const collectionAgent = this.agents.get('CollectionAgent');
      if (!collectionAgent) throw new Error('CollectionAgent not found');

      // 提前注册消息监听：等待评估完成与决策完成，10 秒超时
      const decidedPromise  = this.waitForMessage(MessageType.DECISION_MADE,  traceId, 10000);
      const assessedPromise = this.waitForMessage(MessageType.RISK_ASSESSED,  traceId, 10000);

      // 调用采集代理执行数据采集，携带 traceId 用于链路追踪
      const collectionResult = await collectionAgent.execute('collect', { deviceData, traceId });
      result.results.collection = collectionResult;
      result.collected = collectionResult.success;

      // 采集失败：记录警告日志并提前返回
      if (!collectionResult.success) {
        result.duration = Date.now() - start;
        await this.loggerService.logStep({
          traceId, agentName: 'Orchestrator', agentType: 'orchestrator',
          level: 'warn', message: 'Collection failed', outputData: collectionResult, duration: result.duration,
        });
        return result;
      }

      // 并行等待评估与决策两条消息（由消息总线异步触发）
      const [assessed, decided] = await Promise.all([assessedPromise, decidedPromise]);
      const assessmentPayload = assessed.payload;
      const decisionPayload   = decided.payload;

      result.assessed = true;
      result.decided  = true;

      // 汇总评估与决策的关键字段到 result.results
      result.results = {
        ...result.results,
        riskId:          assessmentPayload.riskId,
        riskLevel:       assessmentPayload.riskLevel,
        riskScore:       assessmentPayload.riskScore,
        primaryRiskType: assessmentPayload.primaryRiskType,
        matchedRules:    assessmentPayload.matchedRules,
        anomalies:       assessmentPayload.anomalies,
        recommendation:  assessmentPayload.recommendation,
        decision: decisionPayload,
        _assessment: assessmentPayload,
      };

      // 将风险事件（RiskEvent）持久化到数据库
      await this.persistRiskEvent(assessmentPayload, decisionPayload, traceId);

      // 标记是否需要人工复核
      result.results.reviewRequired = decisionPayload.requireManual || false;

    } catch (err: any) {
      // 工作流异常处理：记录错误日志并将错误信息写入结果
      this.logger.error(`Risk workflow failed: ${traceId} — ${err.message}`);
      result.results.error = err.message;
      await this.loggerService.logStep({
        traceId, agentName: 'Orchestrator', agentType: 'orchestrator',
        level: 'error', message: `Workflow failed: ${err.message}`, outputData: result.results,
      });
    }

    // 记录工作流总耗时并输出完成日志
    result.duration = Date.now() - start;
    this.logger.log(`Risk workflow done: ${traceId} (${result.duration}ms)`);
    await this.loggerService.logStep({
      traceId, agentName: 'Orchestrator', agentType: 'orchestrator',
      message: `Workflow completed in ${result.duration}ms`,
      outputData: { riskLevel: result.results.riskLevel, riskScore: result.results.riskScore },
      duration: result.duration,
      riskId: result.results.riskId,
    });
    return result;
  }

  /**
   * 等待消息总线上指定类型且匹配 traceId 的消息
   * 采用 Promise + 超时机制，超时未收到则拒绝
   *
   * @param type    消息类型（如 RISK_ASSESSED / DECISION_MADE）
   * @param traceId 链路追踪 ID，用于筛选本次工作流相关消息
   * @param timeout 超时时间（毫秒）
   */
  private waitForMessage(
    type: MessageType,
    traceId: string,
    timeout: number,
  ): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      // 超时定时器，超时后 reject 并抛出错误
      const timer = setTimeout(
        () => reject(new Error(`Timeout waiting for ${type} (traceId=${traceId})`)),
        timeout,
      );

      // 消息匹配回调：traceId 一致则取消超时、取消订阅并 resolve
      const handler = async (msg: AgentMessage) => {
        if (msg.traceId === traceId) {
          clearTimeout(timer);
          this.messageBus.unsubscribe(type, handler);
          resolve(msg);
        }
      };

      this.messageBus.subscribe(type, handler);
    });
  }

  /**
   * 处理「决策完成」事件（MessageType.DECISION_MADE）
   * 记录决策结果日志，供后续审计使用
   */
  private async handleDecisionMade(message: AgentMessage) {
    this.logger.log(
      `[Orchestrator] Decision made — traceId=${message.traceId}, strategy=${message.payload?.strategyCode}`,
    );
  }

  /**
   * 将风险事件（RiskEvent）持久化到数据库
   *
   * 流程：
   *   1. 生成当日自增的风险编号 riskNo；
   *   2. 根据设备编号（code）或 ID 反查数据库设备记录，获取数据库主键；
   *   3. 将评估结果与决策信息组装后写入 riskEvent 表；
   *   4. 若决策要求人工复核，则将 reviewStatus 置为 PENDING_REVIEW。
   *
   * @param assessment 评估代理输出的评估载荷
   * @param decision   决策代理输出的决策载荷
   * @param traceId    链路追踪 ID
   */
  private async persistRiskEvent(
    assessment: any,
    decision: any,
    traceId: string,
  ) {
    this.logger.log(`[persistRiskEvent] Starting persistence for traceId: ${traceId}`);
    const riskId = assessment.riskId;
    if (!riskId) {
      this.logger.warn(`[persistRiskEvent] Missing riskId, skip persistence (traceId=${traceId})`);
      return;
    }

    try {
      // 生成当日风险编号（如 RISK-20260505-0001）
      const riskNo = await this.generateRiskNo();
      // 根据设备编号/ID 反查数据库设备主键
      // assessment.deviceId 可能为设备编号（如 TX_001）而非数据库主键
      let dbDeviceId: string | null = null;
      const rawDeviceId = assessment.deviceId;
      if (rawDeviceId && rawDeviceId !== 'UNKNOWN' && rawDeviceId !== 'DEV-UNKNOWN') {
        const device = await this.prisma.device.findFirst({
          where: { OR: [{ code: rawDeviceId }, { id: rawDeviceId }] },
          select: { id: true },
        });
        if (device) {
          dbDeviceId = device.id;
        } else {
          this.logger.warn(`Device not found for code/id: ${rawDeviceId}, risk will have no device`);
        }
      }
      const requireManual = decision.requireManual || false;
      // 写入风险事件记录（带 riskNo 唯一冲突重试机制）
      // 在高并发或同一秒内多次触发时，generateRiskNo 仅依赖 count 自增可能产生重复，
      // 这里捕获 Prisma P2002 错误后递增序号最多重试 5 次，避免外层工作流整体失败
      let riskEvent: { id: string } | null = null;
      let currentRiskNo = riskNo;
      const maxRetry = 5;
      for (let attempt = 0; attempt < maxRetry; attempt++) {
        try {
          riskEvent = await this.prisma.riskEvent.create({
            data: {
              id: riskId,
              riskNo: currentRiskNo,
              deviceId: dbDeviceId,
              riskType: assessment.primaryRiskType || '未分类',
              riskLevel: assessment.riskLevel ?? 1,
              riskScore: assessment.riskScore != null ? assessment.riskScore : undefined,
              title: decision.strategyName
                ? `${decision.strategyName}-${currentRiskNo}`
                : `AI风险研判-${currentRiskNo}`,
              // 描述信息：优先使用匹配规则名称，其次使用评估建议
              description: (assessment.matchedRules || []).length > 0
                ? (assessment.matchedRules || []).map((r: any) => r.name).join(', ')
                : (assessment.recommendation || '常规监测'),
              status: 0,
              reviewStatus: requireManual ? 'PENDING_REVIEW' : null,
              occurredAt: new Date(),
            },
          });
          break;
        } catch (err: any) {
          // Prisma 唯一约束冲突错误码 P2002：递增序号 + 追加随机后缀重试
          const isUniqueViolation =
            err?.code === 'P2002' || /Unique constraint/i.test(err?.message || '');
          if (!isUniqueViolation || attempt === maxRetry - 1) {
            throw err;
          }
          currentRiskNo = await this.generateRiskNo(attempt + 1);
          this.logger.warn(
            `riskNo conflict, retry attempt=${attempt + 1}, newRiskNo=${currentRiskNo}`,
          );
        }
      }
      if (!riskEvent) {
        throw new Error('Failed to create RiskEvent after retries');
      }

      if (requireManual) {
        this.logger.log(`RiskEvent ${currentRiskNo} requires manual review, pending operator approval`);
      }
      this.logger.log(
        `RiskEvent persisted: ${currentRiskNo} (level=${assessment.riskLevel}, type=${assessment.primaryRiskType})`,
      );

      // 中风险及以上：在 RiskEvent 落库成功之后顺序写入 AlertRecord，
      // 替代原 ALERT_TRIGGERED 消息订阅，避免外键约束竞态
      const riskLevel = assessment.riskLevel ?? 1;
      const riskScore = assessment.riskScore;
      if (riskLevel >= 2) {
        try {
          const existingAlert = await this.prisma.alertRecord.findFirst({
            where: { riskEventId: riskEvent.id },
          });
          if (!existingAlert) {
            await this.prisma.alertRecord.create({
              data: {
                riskEventId: riskEvent.id,
                alertLevel: riskLevel,
                title: `[${riskLevel >= 3 ? '高风险' : '中风险'}] ${decision?.strategyName || '设备异常'}`,
                content: `风险评分: ${riskScore}, 策略: ${decision?.strategyCode || 'N/A'}，请及时处理`,
                channels: riskLevel >= 3 ? ['system', 'sms', 'email'] : ['system'],
                status: 0,
              },
            });
            this.logger.log(`AlertRecord created for RiskEvent: ${riskEvent.id}`);
          }
        } catch (err: any) {
          this.logger.error(`Failed to create AlertRecord fallback: ${err.message}`);
        }
      }

      // 区块链上链：在 RiskEvent 落库后顺序触发，替代原 EVIDENCE_STORED 消息订阅，
      // 避免 BlockchainLog 因 riskEventId 外键约束（事件尚未入库）而写入失败
      const blockchainRequired =
        decision?.blockchainRequired === true || decision?.blockchainStored === true;
      if (blockchainRequired) {
        if (!this.blockchain.isEnabled()) {
          this.logger.warn(`Blockchain disabled, skip on-chain storage for riskId=${riskEvent.id}`);
        } else {
          try {
            const result = await this.blockchain.storeWithLog(
              {
                riskEventNo: currentRiskNo,
                data: {
                  assessment,
                  decision,
                  storedAt: new Date().toISOString(),
                },
                dataType: 'risk_event',
                operator: 'DecisionAgent',
              },
              riskEvent.id,
            );
            this.logger.log(
              `Evidence stored on-chain: tx=${result.txHash}, block=${result.blockNumber}`,
            );
          } catch (err: any) {
            this.logger.error(`Blockchain evidence store failed: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to persist RiskEvent (riskId=${riskId}): ${err.message}`,
      );
    }
  }

  /**
   * 生成当日自增的风险事件编号
   * 格式：RISK-YYYYMMDD-XXXX（如 RISK-20260505-0001）
   * 当传入 retryAttempt > 0 时，附加一个 4 位随机后缀以打破唯一冲突
   *
   * @param retryAttempt 重试序号，0 表示首次生成；>0 时启用随机后缀
   */
  private async generateRiskNo(retryAttempt = 0): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // 统计当日已生成的风险事件数量，用于序号自增
    const count = await this.prisma.riskEvent.count({
      where: { occurredAt: { gte: startOfDay } },
    });
    const seq = String(count + 1 + retryAttempt).padStart(4, '0');
    if (retryAttempt > 0) {
      // 重试时追加随机后缀，确保唯一
      const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `RISK-${dateStr}-${seq}-${suffix}`;
    }
    return `RISK-${dateStr}-${seq}`;
  }

  // 注：原 handleAlertTriggered / handleEvidenceStored 消息订阅处理器已被移除，
  // 相关写入逻辑（AlertRecord、BlockchainLog）已合并到 persistRiskEvent 中按顺序执行，
  // 以解决 RiskEvent 尚未入库时外键约束（riskEventId）违反的问题。
}
