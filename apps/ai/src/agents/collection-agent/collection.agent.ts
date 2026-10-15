import { LoggerService } from '@shared';
import { BaseAgent, AgentResult, AgentStatus } from '../core/base-agent';
import { MessageBus, MessageType, AgentType } from '../core/message-bus';
import { agentConfigLoader, CollectionAgentConfig } from '../config/agent-config.loader';

export class CollectionAgent extends BaseAgent {
  private collectionConfig: CollectionAgentConfig;

  constructor(messageBus: MessageBus, loggerService?: LoggerService) {
    const config = agentConfigLoader.getCollectionConfig();
    super(
      {
        name: AgentType.COLLECTION,
        description: config.agent.description,
        capabilities: config.agent.capabilities,
      },
      messageBus,
      loggerService,
    );
    this.collectionConfig = config;
  }

  protected subscribeToMessages() {
    // 流程起点，由 Orchestrator 直接驱动
  }

  async execute(input: string, context?: Record<string, any>): Promise<AgentResult> {
    const start = Date.now();
    this.status = AgentStatus.BUSY;

    try {
      const raw = context?.deviceData ?? {};
      const validation = this.validateData(raw);

      // ── 前置阈值检测（初筛异常信号）──────────────────────────────
      const anomalies: string[] = [];
      const thresholds = this.collectionConfig.thresholds;

      // 1. 电气参数异常
      if (raw.voltage !== undefined) {
        const rate = raw.voltage / (raw.ratedVoltage ?? raw.voltage);
        if (rate > thresholds.voltage.overvoltage)  anomalies.push('overvoltage');
        if (rate < thresholds.voltage.undervoltage)  anomalies.push('undervoltage');
      }
      if (raw.current !== undefined && raw.ratedCurrent !== undefined) {
        if (raw.current > raw.ratedCurrent * thresholds.current.overcurrent) anomalies.push('overcurrent');
      }
      if (raw.powerFactor !== undefined) {
        if (raw.powerFactor < thresholds.powerFactor.lowPowerFactor) anomalies.push('low_power_factor');
      }
      if (raw.frequency !== undefined) {
        if (raw.frequency < thresholds.frequency.min || raw.frequency > thresholds.frequency.max) {
          anomalies.push('frequency_deviation');
        }
      }

      // 2. 温度异常
      if (raw.transformerOilTemp !== undefined && raw.transformerOilTemp > thresholds.temperature.transformerOilTemp)
        anomalies.push('transformer_overheat');
      if (raw.windingTemp !== undefined && raw.windingTemp > thresholds.temperature.windingTemp)
        anomalies.push('winding_overheat');
      if (raw.switchgearTemp !== undefined && raw.switchgearTemp > thresholds.temperature.switchgearTemp)
        anomalies.push('switchgear_overheat');

      // 3. SF6 气体 / 气压
      if (raw.sf6Pressure !== undefined && raw.sf6Pressure < thresholds.sf6Pressure.lowPressure)
        anomalies.push('sf6_low_pressure');

      // 4. 局放检测
      if (raw.partialDischarge !== undefined && raw.partialDischarge > thresholds.partialDischarge.threshold)
        anomalies.push('partial_discharge');

      // 5. 负荷
      if (raw.loadRate !== undefined && raw.loadRate > thresholds.loadRate.overload)
        anomalies.push('overload');

      // 6. 设备状态位
      if (raw.circuitBreakerFault)  anomalies.push('circuit_breaker_fault');
      if (raw.isolatorFault)        anomalies.push('isolator_fault');
      if (raw.fireAlarm)            anomalies.push('fire_alarm');
      if (raw.unauthorizedAccess)   anomalies.push('unauthorized_access');
      if (raw.misoperation)         anomalies.push('misoperation');

      // ── 数据标准化 ────────────────────────────────────────────────
      const collected = {
        stationId:   raw.stationId   ?? 'STATION-UNKNOWN',
        deviceId:    raw.deviceId    ?? 'DEV-UNKNOWN',
        deviceType:  raw.deviceType  ?? 'transformer',
        timestamp:   new Date().toISOString(),
        metrics: {
          // 电气
          voltage:          raw.voltage,
          ratedVoltage:     raw.ratedVoltage,
          current:          raw.current,
          ratedCurrent:     raw.ratedCurrent,
          powerFactor:      raw.powerFactor,
          frequency:        raw.frequency,
          // 温度
          transformerOilTemp: raw.transformerOilTemp,
          windingTemp:        raw.windingTemp,
          switchgearTemp:     raw.switchgearTemp,
          // 气体
          sf6Pressure:      raw.sf6Pressure,
          // 局放
          partialDischarge:  raw.partialDischarge,
          // 负荷
          loadRate:          raw.loadRate,
          // 状态位
          circuitBreakerFault: raw.circuitBreakerFault ?? false,
          isolatorFault:       raw.isolatorFault       ?? false,
          fireAlarm:           raw.fireAlarm           ?? false,
          unauthorizedAccess:  raw.unauthorizedAccess  ?? false,
          misoperation:        raw.misoperation        ?? false,
        },
        isValid:   validation.valid,
        anomalies,
      };

      this.logger.log(
        `Station=${collected.stationId} Dev=${collected.deviceId} ` +
        `anomalies=[${anomalies.join(',')}]`,
      );

      const traceId = context?.traceId ?? this.messageBus.generateTraceId();
      const duration = Date.now() - start;

      await this.logStep({
        traceId,
        message: `Data collected: ${anomalies.length} anomalies found`,
        inputData: { raw },
        outputData: { collected, anomalies },
        duration,
      });

      this.sendMessage(
        MessageType.DATA_COLLECTED,
        AgentType.ASSESSMENT,
        { deviceId: collected.deviceId, data: collected, collectedAt: collected.timestamp },
        traceId,
      );

      this.status = AgentStatus.IDLE;
      return { success: true, data: collected, duration };
    } catch (err: any) {
      this.status = AgentStatus.ERROR;
      const duration = Date.now() - start;
      await this.logStep({
        traceId: context?.traceId ?? '', level: 'error',
        message: `Collection failed: ${err.message}`, duration,
      });
      return { success: false, error: err.message, duration };
    }
  }

  private validateData(data: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!data.stationId && !data.deviceId) errors.push('缺少 stationId / deviceId');
    return { valid: errors.length === 0, errors };
  }

  /**
   * 获取配置（支持运行时热更新）
   */
  getConfig(): CollectionAgentConfig {
    return this.collectionConfig;
  }

  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    this.collectionConfig = agentConfigLoader.reloadConfig<CollectionAgentConfig>('collection-agent');
    this.logger.log('Configuration reloaded');
  }
}
