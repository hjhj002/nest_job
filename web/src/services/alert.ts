import request from '../utils/request';
import type { Alert, AlertLevel, AlertStatus } from '../types';

export interface AlertListParams {
  page?: number;
  pageSize?: number;
  level?: AlertLevel;
  status?: AlertStatus;
  deviceId?: string;
  keyword?: string;
}

export interface AlertListResult {
  list: Alert[];
  total: number;
}

export const alertApi = {
  // 获取告警列表
  getList: (params: AlertListParams) => {
    return request.get<AlertListResult>('/alert/list', { params });
  },

  // 标记告警为已读
  markAsRead: (id: string) => {
    return request.post(`/alert/${id}/read`);
  },

  // 处理告警
  handle: (id: string, data: { handler: string; remark?: string }) => {
    return request.post(`/alert/${id}/handle`, data);
  },

  // 获取未读告警数量
  getUnreadCount: () => {
    return request.get<number>('/alert/unread/count');
  },

  // 获取最新告警（用于实时推送）
  getLatest: (limit: number = 10) => {
    return request.get<Alert[]>('/alert/latest', { params: { limit } });
  },
};
