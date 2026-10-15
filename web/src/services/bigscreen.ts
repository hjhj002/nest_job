import request from '../utils/request';
import type { RiskEvent, Alert } from '../types';

// 大屏统计数据
export interface BigScreenStats {
  totalDevices: number;
  onlineDevices: number;
  abnormalDevices: number;
  todayRisks: number;
}

// 设备实时数据
export interface DeviceRealtimeData {
  id: string;
  name: string;
  type: string;
  status: 'normal' | 'warning' | 'error' | 'offline';
  voltage: number;
  current: number;
  temperature: number;
  loadRate: number;
  lastUpdate: string;
}

// 风险分布数据
export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

// 设备类型分布项
export interface DeviceTypeItem {
  type: string;
  label: string;
  count: number;
}

// 24小时趋势数据
export interface TrendData {
  hours: string[];
  risks: number[];
  alerts: number[];
}

// Agent状态
export interface AgentStatus {
  id: string;
  name: string;
  type: 'collector' | 'assessor' | 'decision';
  status: 'online' | 'offline' | 'busy';
  lastHeartbeat: string;
}

// 大屏完整数据
export interface BigScreenData {
  stats: BigScreenStats;
  devices: DeviceRealtimeData[];
  latestRisks: RiskEvent[];
  latestAlerts: Alert[];
  riskDistribution: RiskDistribution;
  deviceTypeDistribution: DeviceTypeItem[];
  trendData: TrendData;
  agentStatus: AgentStatus[];
}

export const bigscreenApi = {
  // 获取大屏完整数据
  getFullData: () => {
    return request.get<BigScreenData>('/bigscreen/data');
  },

  // 获取统计数据
  getStats: () => {
    return request.get<BigScreenStats>('/bigscreen/stats');
  },

  // 获取设备实时数据
  getDevicesRealtime: () => {
    return request.get<DeviceRealtimeData[]>('/bigscreen/devices/realtime');
  },

  // 获取最新风险事件
  getLatestRisks: (limit: number = 10) => {
    return request.get<RiskEvent[]>(`/bigscreen/risks/latest?limit=${limit}`);
  },

  // 获取最新告警
  getLatestAlerts: (limit: number = 10) => {
    return request.get<Alert[]>(`/bigscreen/alerts/latest?limit=${limit}`);
  },

  // 获取风险分布
  getRiskDistribution: () => {
    return request.get<RiskDistribution>('/bigscreen/risk-distribution');
  },

  // 获取24小时趋势
  getTrendData: () => {
    return request.get<TrendData>('/bigscreen/trend');
  },

  // 获取Agent状态
  getAgentStatus: () => {
    return request.get<AgentStatus[]>('/bigscreen/agents/status');
  },
};
