import request from '../utils/request';

export interface DashboardStats {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  todayRisks: number;
  pendingRisks: number;
  unreadAlerts: number;
  totalBlockchainRecords: number;
}

export interface RiskDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export const statisticsApi = {
  getDashboard: () => request.get<DashboardStats>('/stats/dashboard'),
  getRiskDistribution: () => request.get<RiskDistribution>('/stats/risk/distribution'),
};
