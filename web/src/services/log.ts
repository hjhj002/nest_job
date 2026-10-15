import request from '../utils/request';

export interface AgentLogEntry {
  id: string;
  traceId: string;
  agentName: string;
  agentType: string;
  level: string;
  message: string;
  inputData?: any;
  outputData?: any;
  duration?: number;
  riskId?: string;
  metadata?: any;
  createdAt: string;
}

export interface LogListParams {
  page?: number;
  pageSize?: number;
  level?: string;
  agentName?: string;
  traceId?: string;
  keyword?: string;
  startTime?: string;
  endTime?: string;
}

export const logApi = {
  getList: (params: LogListParams) =>
    request.get<{ list: AgentLogEntry[]; total: number; page: number; pageSize: number }>('/logs', { params }),

  getDetail: (id: string) =>
    request.get<AgentLogEntry>(`/logs/${id}`),

  getStats: () =>
    request.get<{ total: number; byLevel: Record<string, number>; byAgent: Record<string, number> }>('/logs/stats'),
};
