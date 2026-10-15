import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AgentOrchestrator } from './agents/core/agent-orchestrator';

const INTENT_CLASSIFIER_PROMPT = `你是一个意图分类器。判断用户消息属于哪种类型，只返回 JSON。

## 分类规则
- "chat": 闲聊、问候、自我介绍、帮助询问、感谢、与电力风险分析无关的话题
- "analyze": 用户提供了设备数据要求分析（含 JSON、数值指标、或自然语言描述的设备异常）

## 输出格式
如果 intent=chat:  {"intent":"chat"}
如果 intent=analyze: {"intent":"analyze","deviceData":{"stationId":"...","deviceId":"...","deviceType":"...","voltage":...,"current":...,"temperature":...,"transformerOilTemp":...,"windingTemp":...,"switchgearTemp":...,"sf6Pressure":...,"partialDischarge":...,"loadRate":...,"powerFactor":...,"frequency":...,"ratedVoltage":...,"ratedCurrent":...}}

从消息中提取所有你能识别的数值，字段名使用英文 camelCase。未提及的字段不要包含。
只返回 JSON，不要有任何其他文字。`;

type AgentRole = 'collection' | 'assessment' | 'decision' | 'general';

const AGENT_PROMPTS: Record<AgentRole, string> = {
  general: `你是**电力设备风险智能分析系统**的协调员。

系统由三个专业 Agent 组成：
- **数据采集Agent** — 解析设备数据，检测电压/电流/温度/局放等异常指标
- **风险评估Agent** — 加权评分、规则匹配、风险等级判定
- **决策Agent** — 策略匹配、告警触发、区块链存证

当用户需要具体分析时，引导他们选择对应的 Agent 或直接发送设备数据。
保持专业、简洁，回复控制在200字以内。`,

  collection: `你是**数据采集 Agent**，负责电力设备数据的解析与异常初筛。

## 职责
- 解析用户输入的设备数据（JSON 或自然语言描述均可）
- 检测以下维度的异常：电气参数（电压/电流/功率因数/频率）、温度（变压器油温/绕组温度/开关柜温度）、SF6 气压、局放、负荷率、状态位（断路器故障/隔离刀闸故障/火灾报警/非法闯入/误操作）
- 将数据标准化后交给风险评估 Agent

## 阈值参考
- 过电压 > 1.1pu，欠电压 < 0.9pu；过电流 > 1.2 倍额定值
- 变压器油温 > 85°C，绕组温度 > 105°C，开关柜温度 > 75°C
- SF6 压力 < 0.4 MPa；局放 > 100 pC；负荷率 > 90%

## 回答风格
- 细致、严谨，关注数据完整性和异常信号
- 如果用户给的数据不完整，主动询问缺失的关键指标
- 回复控制在200字以内`,

  assessment: `你是**风险评估 Agent**，负责对采集到的设备数据进行风险评估。

## 职责
- 基于18条评估规则，对异常数据进行加权评分（0-100分）
- 判定风险等级：1级（低风险）— 2级（中风险）— 3级（高风险）— 4级（紧急）
- 匹配风险类型：device_fault（设备故障）、grid_operation（电网运行）、outage_risk（停电风险）、safety_work（安全作业）
- 给出初步建议措施

## 评估维度
电气安全、热故障、绝缘状态、机械状态、环境因素、操作安全、保护装置

## 回答风格
- 分析性强，善于解释风险成因和评分逻辑
- 用数据说话，引用具体指标和阈值
- 回复控制在200字以内`,

  decision: `你是**决策 Agent**，负责根据风险评估结果制定处置策略。

## 职责
- 匹配20条决策策略，确定处置措施
- 判断是否需要触发告警（短信/邮件/钉钉/声光）
- 判断是否需要区块链存证（高风险及以上自动上链）
- 判断是否需要人工介入

## 策略类型
- 紧急抢修、计划检修、加强监测、临时限负荷、停电避险、安全整改等

## 回答风格
- 果断、行动导向，直接给出可执行的措施
- 说明每项措施的优先级和紧急程度
- 如果风险等级高，强调安全第一
- 回复控制在200字以内`,
};

@Injectable()
export class AiService {
  private llm: ChatOpenAI;

  constructor(private orchestrator: AgentOrchestrator) {
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      configuration: { baseURL: process.env.OPENAI_BASE_URL },
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 512,
    });
  }

  getAgentStatus() {
    return this.orchestrator.getAllAgentStatus();
  }

  async runRiskWorkflow(deviceData: Record<string, any>) {
    return this.orchestrator.executeRiskWorkflow(deviceData);
  }

  async handleChat(message: string, deviceData?: Record<string, any>, agent?: string) {
    const role = this.resolveAgentRole(agent);

    // 有外部传入的 deviceData → 始终走工作流（保证风险事件/告警一定持久化），
    // 不论用户在前端选择了哪个具体 Agent
    if (deviceData && Object.keys(deviceData).length > 0) {
      return await this.runWorkflowAndFormat(deviceData);
    }

    // 无设备数据时，明确指定了某个 Agent 角色 → 走 LLM 对话
    if (role !== 'general') {
      return await this.handleGeneralChat(message, role);
    }

    // LLM 驱动的意图分类：闲聊 or 分析请求
    const intent = await this.classifyIntent(message);

    if (intent.intent === 'analyze' && intent.deviceData) {
      return await this.runWorkflowAndFormat(intent.deviceData);
    }

    return await this.handleGeneralChat(message, 'general');
  }

  private resolveAgentRole(agent?: string): AgentRole {
    const validRoles: AgentRole[] = ['collection', 'assessment', 'decision', 'general'];
    if (agent && validRoles.includes(agent as AgentRole)) {
      return agent as AgentRole;
    }
    return 'general';
  }

  private async classifyIntent(message: string): Promise<{ intent: 'chat' | 'analyze'; deviceData?: Record<string, any> }> {
    try {
      const response = await this.llm.invoke([
        { role: 'system', content: INTENT_CLASSIFIER_PROMPT },
        { role: 'user', content: message },
      ]);

      const text = typeof response.content === 'string'
        ? response.content
        : (response.content as any[]).map((c: any) => c.text || '').join('');

      // 提取 JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.intent === 'analyze' && parsed.deviceData) {
          return { intent: 'analyze', deviceData: parsed.deviceData };
        }
      }
      return { intent: 'chat' };
    } catch {
      return { intent: 'chat' };
    }
  }

  private async runWorkflowAndFormat(deviceData: Record<string, any>) {
    const workflow = await this.orchestrator.executeRiskWorkflow(deviceData);

    const levelLabels: Record<number, string> = { 1: '低', 2: '中', 3: '高', 4: '紧急' };
    const rl = workflow.results.riskLevel as number;
    const levelText = levelLabels[rl] || '未知';

    let reply = '';
    if (!workflow.collected) {
      reply = `数据采集失败：${workflow.results.collection?.error || '未知错误'}`;
    } else if (!workflow.assessed) {
      reply = '风险评估未完成，请稍后重试。';
    } else {
      const anomalies = workflow.results.anomalies || [];
      const rules = workflow.results.matchedRules || [];
      const decision = workflow.results.decision || {};

      reply = `**风险分析完成** (trace: ${workflow.traceId})\n\n`;
      reply += `- 风险等级：**${levelText}** (${workflow.results.riskLevel}级, 评分: ${workflow.results.riskScore}分)\n`;
      reply += `- 风险类型：${workflow.results.primaryRiskType}\n`;
      if (anomalies.length > 0) {
        reply += `- 检测异常：${anomalies.join('、')}\n`;
      }
      if (rules.length > 0) {
        reply += `- 命中规则：${rules.map((r: any) => r.name || r.code).join('、')}\n`;
      }
      reply += `- 决策策略：${decision.strategyName || decision.strategyCode}\n`;
      reply += `- 处置措施：${(decision.measures || []).join('、')}\n`;
      if (decision.triggerAlert) reply += '- ⚠️ 已触发告警\n';
      if (decision.blockchainStored) reply += '- 🔗 已上链存证\n';
      reply += `\n耗时：${workflow.duration}ms`;
    }

    return {
      reply,
      steps: this.extractSteps(workflow),
      result: {
        riskId: workflow.results.riskId,
        riskLevel: workflow.results.riskLevel,
        riskScore: workflow.results.riskScore,
        riskType: workflow.results.primaryRiskType,
        decision: workflow.results.decision,
      },
      traceId: workflow.traceId,
    };
  }

  private async handleGeneralChat(message: string, role: AgentRole) {
    try {
      const systemPrompt = AGENT_PROMPTS[role];
      const response = await this.llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]);

      const reply =
        typeof response.content === 'string'
          ? response.content
          : (response.content as any[]).map((c: any) => c.text || '').join('');

      return {
        reply: reply || '抱歉，我暂时无法回复，请稍后再试。',
        steps: [],
        result: { riskId: null, riskLevel: null, riskScore: null, riskType: 'general_chat', decision: null },
        traceId: `chat-${Date.now()}`,
      };
    } catch {
      return {
        reply: '抱歉，AI 服务暂时不可用，请稍后重试或发送设备数据进行风险分析。',
        steps: [],
        result: { riskId: null, riskLevel: null, riskScore: null, riskType: 'general_chat', decision: null },
        traceId: `chat-${Date.now()}`,
      };
    }
  }

  private extractSteps(workflow: any) {
    const steps: any[] = [];

    if (workflow.results.collection) {
      const c = workflow.results.collection;
      steps.push({
        agent: 'CollectionAgent',
        agentType: 'collector',
        status: c.success ? 'completed' : 'failed',
        summary: c.success
          ? `采集完成，发现 ${c.data?.anomalies?.length || 0} 个异常`
          : `采集失败: ${c.error}`,
        duration: c.duration,
        input: { deviceData: 'from input' },
        output: c.data,
      });
    }

    if (workflow.results._assessment) {
      const a = workflow.results._assessment;
      steps.push({
        agent: 'AssessmentAgent',
        agentType: 'assessor',
        status: 'completed',
        summary: `评分 ${a.riskScore}，等级 ${a.riskLevel}`,
        duration: 0,
        input: { anomalies: a.anomalies },
        output: { riskLevel: a.riskLevel, riskScore: a.riskScore, matchedRules: a.matchedRules },
      });
    }

    if (workflow.results.decision) {
      const d = workflow.results.decision;
      steps.push({
        agent: 'DecisionAgent',
        agentType: 'decision',
        status: 'completed',
        summary: `策略 ${d.strategyCode}，${d.triggerAlert ? '已告警' : '未告警'}，${d.blockchainStored ? '已上链' : '未上链'}`,
        duration: 0,
        input: { riskLevel: workflow.results.riskLevel },
        output: d,
      });
    }

    return steps;
  }
}
