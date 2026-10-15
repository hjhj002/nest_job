import { useState, useRef, useEffect } from 'react';
import {
  Card, Input, Button, Typography, Space, Collapse, Tag, Spin, Empty, Segmented,
  Modal, Form, InputNumber,
} from 'antd';
import {
  SendOutlined, RobotOutlined, UserOutlined, ThunderboltOutlined,
  SearchOutlined, AlertOutlined, CheckCircleOutlined, TeamOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { chatApi, type ChatResult } from '../../../services/chat';
import './style.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
  result?: ChatResult;
  time: string;
}

const sampleData = {
  stationId: 'SUB-001',
  deviceId: 'TX_001',
  deviceType: 'transformer',
  voltage: 10.5,
  ratedVoltage: 10,
  current: 120,
  ratedCurrent: 150,
  powerFactor: 0.78,
  frequency: 49.8,
  transformerOilTemp: 82,
  windingTemp: 70,
  switchgearTemp: 35,
  sf6Pressure: 0.35,
  partialDischarge: 150,
  loadRate: 88,
  circuitBreakerFault: false,
  fireAlarm: false,
  unauthorizedAccess: false,
  misoperation: false,
};

const AGENT_OPTIONS = [
  { label: '协调员', value: 'general', icon: <TeamOutlined /> },
  { label: '数据采集', value: 'collection', icon: <SearchOutlined /> },
  { label: '风险评估', value: 'assessment', icon: <AlertOutlined /> },
  { label: '决策建议', value: 'decision', icon: <CheckCircleOutlined /> },
];

interface AgentConfig {
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

const DEFAULT_AGENT_CONFIGS: Record<string, AgentConfig> = {
  general: {
    name: '意图分类 Agent',
    systemPrompt: `你是一个意图分类器。判断用户消息属于哪种类型，只返回 JSON。

## 分类规则
- "chat": 闲聊、问候、自我介绍、帮助询问、感谢、与电力风险分析无关的话题
- "analyze": 用户提供了设备数据要求分析（含 JSON、数值指标、或自然语言描述的设备异常）

## 输出格式
如果 intent=chat:  {"intent":"chat"}
如果 intent=analyze: {"intent":"analyze","deviceData":{"stationId":"...","deviceId":"...","deviceType":"...","voltage":...,"current":...,"temperature":...,"transformerOilTemp":...,"windingTemp":...,"switchgearTemp":...,"sf6Pressure":...,"partialDischarge":...,"loadRate":...,"powerFactor":...,"frequency":...,"ratedVoltage":...,"ratedCurrent":...}}

从消息中提取所有你能识别的数值，字段名使用英文 camelCase。未提及的字段不要包含。
只返回 JSON，不要有任何其他文字。`,
    temperature: 0.3,
    maxTokens: 2048,
  },
  collection: {
    name: '数据采集 Agent',
    systemPrompt: `你是**数据采集 Agent**，负责电力设备数据的解析与异常初筛。

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
    temperature: 0.2,
    maxTokens: 1024,
  },
  assessment: {
    name: '风险评估 Agent',
    systemPrompt: `你是**风险评估 Agent**，负责对采集到的设备数据进行风险评估。

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
    temperature: 0.3,
    maxTokens: 2048,
  },
  decision: {
    name: '决策 Agent',
    systemPrompt: `你是**决策 Agent**，负责根据风险评估结果制定处置策略。

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
    temperature: 0.4,
    maxTokens: 2048,
  },
};

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [deviceData, setDeviceData] = useState<Record<string, any>>({});
  const [rawDataInput, setRawDataInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [showDataInput, setShowDataInput] = useState(true);
  const [agent, setAgent] = useState<string>('general');
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [agentConfigs, setAgentConfigs] = useState<Record<string, AgentConfig>>(DEFAULT_AGENT_CONFIGS);
  const [editInfoForm] = Form.useForm();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const openEditInfo = () => {
    editInfoForm.setFieldsValue(agentConfigs[agent]);
    setShowEditInfo(true);
  };

  const handleEditInfoOk = () => {
    editInfoForm.validateFields().then((values: AgentConfig) => {
      setAgentConfigs((prev) => ({ ...prev, [agent]: values }));
      setShowEditInfo(false);
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !Object.keys(deviceData).length) return;
    if (loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text || '发送了设备数据',
      time: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const result = await chatApi.sendMessage(text, deviceData, agent);
      const aiMsg: ChatMessage = {
        role: 'ai',
        content: result.reply,
        result,
        time: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setDeviceData({});
      setRawDataInput('');
      setJsonError('');
    } catch {
      const errMsg: ChatMessage = {
        role: 'ai',
        content: 'AI 服务暂不可用，请确认 AI 服务已启动（端口 3001）',
        time: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const fillSampleData = () => {
    setDeviceData(sampleData);
    setRawDataInput(JSON.stringify(sampleData, null, 2));
    setJsonError('');
    setInput('请分析这个变压器设备的数据，判断是否存在风险');
  };

  const clearDeviceData = () => {
    setDeviceData({});
    setRawDataInput('');
    setJsonError('');
  };

  const renderStepPanel = (result: ChatResult) => (
    <Collapse ghost size="small" className="step-collapse">
      {result.steps.map((step, i) => (
        <Panel
          key={i}
          header={
            <Space>
              <Tag color={step.status === 'completed' ? 'green' : 'red'}>
                {step.status === 'completed' ? '完成' : '失败'}
              </Tag>
              <Text strong>{step.agent}</Text>
              <Text type="secondary">{step.summary}</Text>
              <Tag>{step.duration}ms</Tag>
            </Space>
          }
        >
          <div className="step-detail">
            <div className="step-io">
              <Text strong>输入：</Text>
              <pre>{JSON.stringify(step.input, null, 2)}</pre>
            </div>
            <div className="step-io">
              <Text strong>输出：</Text>
              <pre>{JSON.stringify(step.output, null, 2)}</pre>
            </div>
          </div>
        </Panel>
      ))}
    </Collapse>
  );

  return (
    <div className="chat-page">
      <Title level={2}>Agent 对话测试</Title>
      <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
        发送设备数据，AI Agent 将执行采集→评估→决策的完整风控流程
      </Text>

      <Card className="chat-card" styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}>
        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {messages.length === 0 && (
            <Empty
              description="发送设备数据开始对话测试"
              style={{ marginTop: 60 }}
            >
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={fillSampleData}>
                填入示例数据
              </Button>
            </Empty>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`message-row ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
              </div>
              <div className="message-bubble">
                <Paragraph className="message-text">
                  {msg.content.split('\n').map((line, j) => (
                    <span key={j}>
                      {line.startsWith('**') ? (
                        <Text strong>{line.replace(/\*\*/g, '')}</Text>
                      ) : line}
                      <br />
                    </span>
                  ))}
                </Paragraph>
                {msg.result && renderStepPanel(msg.result)}
                <Text type="secondary" className="message-time">{msg.time}</Text>
              </div>
            </div>
          ))}

          {loading && (
            <div className="message-row ai">
              <div className="message-avatar"><RobotOutlined /></div>
              <div className="message-bubble loading-bubble">
                <Spin size="small" /> <Text type="secondary">Agent 分析中...</Text>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-area">
          {showDataInput && (
            <div className="data-input">
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong style={{ fontSize: 13 }}>设备数据 (JSON格式)</Text>
              </div>
              <TextArea
                rows={8}
                placeholder={`请输入JSON格式的设备数据，例如：
{
  "stationId": "SUB-001",
  "deviceId": "TX_001",
  "deviceType": "transformer",
  "voltage": 10.5,
  "current": 120,
  "temperature": 65,
  "sf6Pressure": 0.45,
  "loadRate": 75
}`}
                value={rawDataInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setRawDataInput(val);
                  try {
                    if (val.trim()) {
                      const parsed = JSON.parse(val);
                      setDeviceData(parsed);
                      setJsonError('');
                    } else {
                      setDeviceData({});
                      setJsonError('');
                    }
                  } catch (err: any) {
                    setJsonError('JSON 格式错误: ' + err.message);
                  }
                }}
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
              />
              {rawDataInput && (
                <div style={{ marginTop: 4 }}>
                  {jsonError ? (
                    <Text type="danger" style={{ fontSize: 12 }}>{jsonError}</Text>
                  ) : (
                    <Text type="success" style={{ fontSize: 12 }}>✓ JSON 格式正确</Text>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="agent-selector">
            <Segmented
              value={agent}
              onChange={(val) => setAgent(val as string)}
              options={AGENT_OPTIONS.map((opt) => ({
                label: (
                  <Space size={4}>
                    {opt.icon}
                    <span>{opt.label}</span>
                  </Space>
                ),
                value: opt.value,
              }))}
            />
          </div>
          <div className="input-row">
            <Button
              size="small"
              onClick={() => setShowDataInput(!showDataInput)}
              style={{ marginRight: 8 }}
            >
              {showDataInput ? '收起数据' : '编辑数据'}
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={openEditInfo}
              style={{ marginRight: 8 }}
            >
              编辑信息
            </Button>
            <Button size="small" onClick={fillSampleData} style={{ marginRight: 8 }}>
              示例数据
            </Button>
            <Button size="small" onClick={clearDeviceData} style={{ marginRight: 8 }}>
              清空数据
            </Button>
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => { e.preventDefault(); sendMessage(); }}
              placeholder="输入消息或指令..."
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="chat-textarea"
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={sendMessage}
              loading={loading}
            />
          </div>
        </div>
      </Card>

      <Modal
        title="编辑 Agent 信息"
        open={showEditInfo}
        onOk={handleEditInfoOk}
        onCancel={() => setShowEditInfo(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={editInfoForm} layout="vertical">
          <Form.Item label="Agent 名称" name="name">
            <Input disabled />
          </Form.Item>
          <Form.Item
            label="系统提示词"
            name="systemPrompt"
            rules={[{ required: true, message: '请输入系统提示词' }]}
          >
            <Input.TextArea rows={4} placeholder="输入 Agent 的系统提示词..." />
          </Form.Item>
          <Form.Item
            label="Temperature"
            name="temperature"
            rules={[{ required: true, message: '请输入 Temperature' }]}
          >
            <InputNumber min={0} max={1} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Max Tokens"
            name="maxTokens"
            rules={[{ required: true, message: '请输入 Max Tokens' }]}
          >
            <InputNumber min={100} max={4096} step={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
