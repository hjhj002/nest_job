import request from '../utils/request';
import type { DecisionProcess } from '../types';

export const decisionApi = {
  // 获取决策流程列表
  getList: (params: { page?: number; pageSize?: number; riskId?: string }) => {
    return request.get<{ list: DecisionProcess[]; total: number }>('/decision/list', { params });
  },

  // 获取决策流程详情
  getDetail: (id: string) => {
    return request.get<DecisionProcess>(`/decision/${id}`);
  },

  // 根据风险ID获取决策流程
  getByRiskId: (riskId: string) => {
    return request.get<DecisionProcess>(`/decision/risk/${riskId}`);
  },

  // 获取Agent状态
  getAgentStatus: () => {
    return request.get<{
      id: string; name: string; type: string; status: string; lastHeartbeat: string | null;
    }[]>('/decision/agents/status');
  },
};
