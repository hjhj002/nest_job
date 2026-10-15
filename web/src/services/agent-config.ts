import request from '../utils/request';

export interface AgentConfigItem {
  id: string;
  agentType: string;
  name: string;
  description: string;
  config: any;
  status: number;
  createdAt: string;
  updatedAt: string;
}

export const agentConfigApi = {
  getList: (params?: { keyword?: string }) => request.get<AgentConfigItem[]>('/agent-configs', { params }),
  getById: (id: string) => request.get<AgentConfigItem>(`/agent-configs/${id}`),
  create: (data: Partial<AgentConfigItem>) => request.post('/agent-configs', data),
  update: (id: string, data: Partial<AgentConfigItem>) => request.put(`/agent-configs/${id}`, data),
  remove: (id: string) => request.delete(`/agent-configs/${id}`),
};
