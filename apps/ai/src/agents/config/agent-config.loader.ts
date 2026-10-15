import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent 基础配置接口
 */
export interface AgentConfig {
  agent: {
    name: string;
    description: string;
    capabilities: string[];
  };
  prompts: {
    systemPrompt: string;
    [key: string]: string;
  };
}

/**
 * Collection Agent 配置
 */
export interface CollectionAgentConfig extends AgentConfig {
  thresholds: {
    voltage: {
      overvoltage: number;
      undervoltage: number;
      description: string;
    };
    current: {
      overcurrent: number;
      description: string;
    };
    powerFactor: {
      lowPowerFactor: number;
      description: string;
    };
    frequency: {
      min: number;
      max: number;
      description: string;
    };
    temperature: {
      transformerOilTemp: number;
      windingTemp: number;
      switchgearTemp: number;
      criticalTransformerOilTemp: number;
      criticalWindingTemp: number;
      description: string;
    };
    sf6Pressure: {
      lowPressure: number;
      description: string;
    };
    partialDischarge: {
      threshold: number;
      description: string;
    };
    loadRate: {
      overload: number;
      warning: number;
      description: string;
    };
  };
  anomalyCodes: Record<string, string>;
}

/**
 * 风险评估规则
 */
export interface AssessmentRule {
  code: string;
  name: string;
  riskType: string;
  condition: string;
  weight: number;
  description: string;
}

/**
 * Assessment Agent 配置
 */
export interface AssessmentAgentConfig extends AgentConfig {
  riskLevels: Record<string, {
    name: string;
    description: string;
    minScore: number;
    maxScore: number;
    recommendation: string;
  }>;
  riskTypes: Record<string, string>;
  rules: AssessmentRule[];
  scoring: {
    normalizationFactor: number;
    description: string;
  };
}

/**
 * 决策策略
 */
export interface DecisionStrategy {
  code: string;
  name: string;
  measures: string[];
  channels: string[];
  blockchainRequired: boolean;
  triggerAlert: boolean;
  requireManual: boolean;
}

/**
 * Decision Agent 配置
 */
export interface DecisionAgentConfig extends AgentConfig {
  riskTypes: Record<string, {
    name: string;
    description: string;
  }>;
  channels: Record<string, {
    name: string;
    description: string;
  }>;
  strategyMatrix: Record<string, Record<string, DecisionStrategy>>;
}

/**
 * Agent 配置加载器
 */
export class AgentConfigLoader {
  private static instance: AgentConfigLoader;
  private configs: Map<string, AgentConfig> = new Map();
  private configDir: string;

  private constructor() {
    // 配置文件目录 - 优先从源码目录加载，如果不存在则从dist目录加载
    const srcConfigDir = path.join(process.cwd(), 'apps/ai/src/agents/config');
    const distConfigDir = path.join(__dirname);

    // 检查源码目录是否存在配置文件
    if (fs.existsSync(path.join(srcConfigDir, 'collection-agent.config.json'))) {
      this.configDir = srcConfigDir;
    } else {
      this.configDir = distConfigDir;
    }
  }

  static getInstance(): AgentConfigLoader {
    if (!AgentConfigLoader.instance) {
      AgentConfigLoader.instance = new AgentConfigLoader();
    }
    return AgentConfigLoader.instance;
  }

  /**
   * 加载指定 Agent 的配置
   */
  loadConfig<T extends AgentConfig>(agentName: string): T {
    if (this.configs.has(agentName)) {
      return this.configs.get(agentName) as T;
    }

    const configPath = path.join(this.configDir, `${agentName}.config.json`);
    
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent) as T;
      this.configs.set(agentName, config);
      return config;
    } catch (error) {
      throw new Error(`Failed to load config for agent "${agentName}": ${error.message}`);
    }
  }

  /**
   * 重新加载配置（支持热更新）
   */
  reloadConfig<T extends AgentConfig>(agentName: string): T {
    this.configs.delete(agentName);
    return this.loadConfig<T>(agentName);
  }

  /**
   * 清除所有缓存的配置
   */
  clearCache(): void {
    this.configs.clear();
  }

  /**
   * 获取 Collection Agent 配置
   */
  getCollectionConfig(): CollectionAgentConfig {
    return this.loadConfig<CollectionAgentConfig>('collection-agent');
  }

  /**
   * 获取 Assessment Agent 配置
   */
  getAssessmentConfig(): AssessmentAgentConfig {
    return this.loadConfig<AssessmentAgentConfig>('assessment-agent');
  }

  /**
   * 获取 Decision Agent 配置
   */
  getDecisionConfig(): DecisionAgentConfig {
    return this.loadConfig<DecisionAgentConfig>('decision-agent');
  }
}

// 导出单例实例
export const agentConfigLoader = AgentConfigLoader.getInstance();
