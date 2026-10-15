// 用户相关类型
export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar?: string;
  role: 'admin' | 'operator' | 'analyst';
  permissions: string[];
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email?: string;
    phone?: string;
    realName?: string;
    roles: string[];
    permissions: string[];
  };
}

// 设备相关类型
export type DeviceStatus = 'online' | 'offline' | 'warning' | 'error';
export type DeviceType = 'transformer' | 'breaker' | 'switchgear' | 'sensor';

export interface Device {
  id: string;
  code: string;
  name: string;
  deviceType: DeviceType;
  status: number; // 1-在线 0-离线
  location?: string;
  longitude?: number;
  latitude?: number;
  description?: string;
  createdAt: string;
  updatedAt: string;
  // 最新一条数据（详情接口返回）
  deviceData?: DeviceDataItem[];
}

export interface DeviceDataItem {
  id: string;
  voltageA: number;
  voltageB: number;
  voltageC: number;
  currentA: number;
  currentB: number;
  currentC: number;
  activePower: number;
  temperature: number;
  humidity: number;
  sf6Pressure: number;
  partialDischarge: number;
  recordedAt: string;
}

export interface HistoryData {
  id: string;
  voltageA: number;
  voltageB: number;
  voltageC: number;
  currentA: number;
  currentB: number;
  currentC: number;
  activePower: number;
  temperature: number;
  humidity: number;
  sf6Pressure: number;
  partialDischarge: number;
  recordedAt: string;
}

// 风险相关类型
export type RiskLevel = 'high' | 'medium' | 'low';
export type RiskStatus = 'pending' | 'processing' | 'resolved' | 'ignored';

export interface RiskEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  level: RiskLevel;
  type: string;
  description: string;
  source: string;
  status: RiskStatus;
  createdAt: string;
  handledAt?: string;
  handler?: string;
  ruleHit?: string;
  aiJudgment?: boolean;
}

// 告警相关类型
export type AlertLevel = 'critical' | 'warning' | 'info';
export type AlertStatus = 'unread' | 'read' | 'handled';

export interface Alert {
  id: string;
  deviceId: string;
  deviceName: string;
  level: AlertLevel;
  message: string;
  status: AlertStatus;
  createdAt: string;
}

// 决策协同类型
export interface DecisionProcess {
  id: string;
  riskId: string;
  steps: DecisionStep[];
  result: DecisionResult;
  createdAt: string;
}

export interface DecisionStep {
  id: string;
  agentType: 'collector' | 'assessor' | 'decision';
  agentName: string;
  status: 'running' | 'completed' | 'failed';
  input: Record<string, any>;
  output: Record<string, any>;
  startTime: string;
  endTime?: string;
}

export interface DecisionResult {
  action: string;
  command?: string;
  alertLevel: AlertLevel;
  description: string;
}

// 区块链存证类型
export interface BlockchainRecord {
  id: string;
  eventId: string;
  deviceId: string;
  riskLevel: RiskLevel;
  blockHash: string;
  txHash: string;
  timestamp: string;
  status: 'confirmed' | 'pending';
}

// WebSocket消息类型
export interface WSMessage<T = any> {
  type: 'device_data' | 'risk_alert' | 'alarm' | 'agent_status';
  data: T;
  timestamp: string;
}

// 统计数据类型
export interface Statistics {
  totalDevices: number;
  onlineDevices: number;
  abnormalDevices: number;
  todayRisks: number;
  riskDistribution: { level: RiskLevel; count: number }[];
  deviceTypeDistribution: { type: DeviceType; count: number }[];
  trendData: { date: string; risks: number; alerts: number }[];
}
