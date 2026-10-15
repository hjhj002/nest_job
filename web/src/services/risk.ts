import request from '../utils/request';
import type { RiskEvent } from '../types';

export interface RiskListParams {
  page?: number;
  pageSize?: number;
  riskLevel?: number;
  status?: number;
  keyword?: string;
  startTime?: string;
  endTime?: string;
}

export interface RiskListResult {
  list: any[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RiskStats {
  total: number;
  byLevel: { level: number; count: number }[];
  byType: { type: string; count: number }[];
  byStatus: { status: number; count: number }[];
  trend: { date: string; count: number }[];
}

export const riskApi = {
  getList: (params: RiskListParams) => {
    return request.get<RiskListResult>('/risk/events', { params });
  },

  getDetail: (id: string) => {
    return request.get<any>(`/risk/events/${id}`);
  },

  handle: (id: string, data: { status: number; handleResult?: string }) => {
    return request.put(`/risk/events/${id}/handle`, data);
  },

  getStatistics: (params?: { startTime?: string; endTime?: string }) => {
    return request.get<RiskStats>('/risk/events/statistics', { params });
  },
};

// ==================== 风险规则 ====================

export interface RuleItem {
  id: string;
  code: string;
  name: string;
  riskType: string;
  description?: string;
  conditions: { field: string; operator: string; value: any }[];
  weight: number;
  priority: number;
  status: number;
  createdAt: string;
  updatedAt: string;
  ruleStrategies?: { strategy: { id: string; code: string; name: string } }[];
}

export interface RuleListParams {
  page?: number;
  pageSize?: number;
  riskType?: string;
  status?: number;
  keyword?: string;
}

export interface RuleListResult {
  list: RuleItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const ruleApi = {
  getList: (params: RuleListParams) => {
    return request.get<RuleListResult>('/risk/rules', { params });
  },
  getById: (id: string) => {
    return request.get<RuleItem>(`/risk/rules/${id}`);
  },
  create: (data: any) => {
    return request.post('/risk/rules', data);
  },
  update: (id: string, data: any) => {
    return request.put(`/risk/rules/${id}`, data);
  },
  remove: (id: string) => {
    return request.delete(`/risk/rules/${id}`);
  },
  evaluate: (data: Record<string, any>) => {
    return request.post('/risk/rules/evaluate', data);
  },
};

// ==================== 风控策略 ====================

export interface StrategyItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  riskLevel: number;
  actions: { type: string; config?: any }[];
  notifyConfig?: any;
  status: number;
  createdAt: string;
  updatedAt: string;
  ruleStrategies?: { rule: { id: string; code: string; name: string } }[];
}

export interface StrategyListParams {
  page?: number;
  pageSize?: number;
  riskLevel?: number;
  status?: number;
  keyword?: string;
}

export interface StrategyListResult {
  list: StrategyItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const strategyApi = {
  getList: (params: StrategyListParams) => {
    return request.get<StrategyListResult>('/risk/strategies', { params });
  },
  getById: (id: string) => {
    return request.get<StrategyItem>(`/risk/strategies/${id}`);
  },
  create: (data: any) => {
    return request.post('/risk/strategies', data);
  },
  update: (id: string, data: any) => {
    return request.put(`/risk/strategies/${id}`, data);
  },
  remove: (id: string) => {
    return request.delete(`/risk/strategies/${id}`);
  },
  execute: (id: string, context: Record<string, any>) => {
    return request.post(`/risk/strategies/${id}/execute`, context);
  },
};
