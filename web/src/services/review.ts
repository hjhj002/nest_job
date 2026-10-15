import request from '../utils/request';
import type { RiskEvent } from '../types';

export interface ReviewItem extends RiskEvent {
  device?: { id: string; code: string; name: string };
}

export interface ReviewListResult {
  list: ReviewItem[];
  total: number;
  page: number;
  pageSize: number;
}

export const reviewApi = {
  getList: (params: { page?: number; pageSize?: number; status?: string }) =>
    request.get<ReviewListResult>('/decision/reviews', { params }),

  approve: (riskId: string) =>
    request.put(`/decision/reviews/${riskId}/approve`),

  reject: (riskId: string, comment: string) =>
    request.put(`/decision/reviews/${riskId}/reject`, { comment }),
};
