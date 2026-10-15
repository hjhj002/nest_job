import request from '../utils/request';
import type { Device, DeviceDataItem, HistoryData } from '../types';

export interface DeviceListParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  type?: string;
  status?: string;
}

export interface DeviceListResult {
  list: Device[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const deviceApi = {
  getList: (params: DeviceListParams) =>
    request.get<DeviceListResult>('/device/list', { params }),

  getDetail: (id: string) =>
    request.get<Device & { deviceData: DeviceDataItem[] }>(`/device/${id}`),

  getHistoryData: (id: string, startTime?: string, endTime?: string) =>
    request.get<HistoryData[]>(`/device/${id}/history`, {
      params: { startTime, endTime },
    }),

  getAll: () =>
    request.get<Pick<Device, 'id' | 'code' | 'name' | 'deviceType' | 'status' | 'location'>[]>('/device/all'),

  update: (id: string, data: { name?: string; location?: string; description?: string; status?: number }) =>
    request.put<Device>(`/device/${id}`, data),

  remove: (id: string) =>
    request.delete<{ success: boolean }>(`/device/${id}`),

  sync: () =>
    request.post<{ success: boolean; count: number; total: number }>('/device/sync'),
};
