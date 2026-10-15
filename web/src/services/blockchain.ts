import request from '../utils/request';
import type { BlockchainRecord } from '../types';

export interface BlockchainListParams {
  page?: number;
  pageSize?: number;
  deviceId?: string;
  eventId?: string;
  keyword?: string;
}

export interface BlockchainListResult {
  list: BlockchainRecord[];
  total: number;
}

export const blockchainApi = {
  // 获取区块链存证列表
  getList: (params: BlockchainListParams) => {
    return request.get<BlockchainListResult>('/blockchain/list', { params });
  },

  // 获取存证详情
  getDetail: (id: string) => {
    return request.get<BlockchainRecord>(`/blockchain/${id}`);
  },

  // 验证存证
  verify: (id: string) => {
    return request.post<{ valid: boolean; message: string }>(`/blockchain/${id}/verify`);
  },

  // 手动认证上链
  certify: (data: Record<string, any>, dataType?: string) => {
    return request.post<{
      success: boolean;
      riskEventNo: string;
      certificateId: string;
      txHash: string;
      blockNumber: string;
      dataHash: string;
      timestamp: string;
    }>('/blockchain/certify', { data, dataType });
  },

  // 获取存证统计
  getStats: () => {
    return request.get<{
      totalRecords: number;
      todayRecords: number;
      confirmedRecords: number;
      pendingRecords: number;
    }>('/blockchain/stats');
  },
};
