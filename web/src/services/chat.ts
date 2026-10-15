import request from '../utils/request';

export interface ChatStep {
  agent: string;
  agentType: string;
  status: string;
  summary: string;
  duration: number;
  input: any;
  output: any;
}

export interface ChatResult {
  reply: string;
  steps: ChatStep[];
  result: {
    riskId?: string;
    riskLevel?: number;
    riskScore?: number;
    riskType?: string;
    decision?: any;
  };
  traceId: string;
}

export const chatApi = {
  sendMessage: (message: string, deviceData?: Record<string, any>, agent?: string) =>
    request.post<ChatResult>('/ai/chat', { message, deviceData, agent }),

  getAgentStatus: () =>
    request.get('/ai/agents/status'),
};
