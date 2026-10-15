import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared';

@Injectable()
export class BigscreenService {
  constructor(private readonly prisma: PrismaService) {}

  async getFullData() {
    const [
      stats,
      devices,
      latestRisks,
      latestAlerts,
      riskDistribution,
      deviceTypeDistribution,
      trendData,
      agentStatus,
    ] = await Promise.all([
      this.getStats(),
      this.getDevicesRealtime(),
      this.getLatestRisks(10),
      this.getLatestAlerts(10),
      this.getRiskDistribution(),
      this.getDeviceTypeDistribution(),
      this.getTrendData(),
      this.getAgentStatus(),
    ]);

    return {
      stats,
      devices,
      latestRisks,
      latestAlerts,
      riskDistribution,
      deviceTypeDistribution,
      trendData,
      agentStatus,
    };
  }

  async getStats() {
    // 从数据库获取统计数据
    const totalDevices = await this.prisma.device.count();
    const onlineDevices = await this.prisma.device.count({
      where: { status: 1 },
    });
    const abnormalDevices = await this.prisma.device.count({
      where: { status: 0 },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRisks = await this.prisma.riskEvent.count({
      where: {
        createdAt: {
          gte: today,
        },
      },
    });

    return {
      totalDevices,
      onlineDevices,
      abnormalDevices,
      todayRisks,
    };
  }

  async getDevicesRealtime() {
    const devices = await this.prisma.device.findMany({
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    const typeLabels: Record<string, string> = {
      transformer: '变压器',
      breaker: '断路器',
      busbar: '母线',
      capacitor: '电容器组',
      arrester: '避雷器',
    };

    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      type: device.deviceType.toLowerCase(),
      typeLabel: typeLabels[device.deviceType] || device.deviceType,
      status: device.status === 1 ? 'normal' : 'offline',
      voltage: device.deviceType === 'busbar' ? 10.5 : 220,
      current: 45 + Math.random() * 80,
      temperature: 35 + Math.random() * 45,
      loadRate: 40 + Math.random() * 50,
      lastUpdate: device.updatedAt?.toISOString() || new Date().toISOString(),
    }));
  }

  async getLatestRisks(limit: number = 10) {
    const risks = await this.prisma.riskEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { device: true },
    });

    const levelMap: Record<number, string> = {
      1: 'low',
      2: 'medium',
      3: 'high',
      4: 'critical',
    };

    return risks.map((risk) => ({
      id: risk.id,
      deviceId: risk.deviceId,
      deviceName: risk.device?.name || '未绑定设备',
      level: levelMap[risk.riskLevel] || (risk.riskLevel === 0 ? 'info' : 'unknown'),
      type: risk.riskType === 'manual_certification' ? '手动认证' : risk.riskType,
      description: risk.description || risk.title || '无描述',
      createdAt: risk.createdAt.toISOString().replace('T', ' ').substring(0, 19),
    }));
  }

  async getLatestAlerts(limit: number = 10) {
    const alerts = await this.prisma.alertRecord.findMany({
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: { riskEvent: true },
    });

    const levelMap: Record<number, string> = {
      1: 'low',
      2: 'medium',
      3: 'high',
      4: 'critical',
    };

    return alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      content: alert.content,
      level: levelMap[alert.alertLevel] || 'info',
      status: alert.status === 0 ? 'unconfirmed' : 'confirmed',
      riskType: alert.riskEvent?.riskType || 'unknown',
      createdAt: alert.sentAt.toISOString().replace('T', ' ').substring(0, 19),
    }));
  }

  async getRiskDistribution() {
    const [critical, high, medium, low] = await Promise.all([
      this.prisma.riskEvent.count({ where: { riskLevel: 4 } }),
      this.prisma.riskEvent.count({ where: { riskLevel: 3 } }),
      this.prisma.riskEvent.count({ where: { riskLevel: 2 } }),
      this.prisma.riskEvent.count({ where: { riskLevel: 1 } }),
    ]);

    return { critical, high, medium, low };
  }

  async getDeviceTypeDistribution() {
    const types = await this.prisma.device.groupBy({
      by: ['deviceType'],
      _count: { deviceType: true },
    });

    const typeLabels: Record<string, string> = {
      transformer: '变压器',
      breaker: '断路器',
      busbar: '母线',
      capacitor: '电容器组',
      arrester: '避雷器',
    };

    return types.map((t) => ({
      type: t.deviceType,
      label: typeLabels[t.deviceType] || t.deviceType,
      count: t._count.deviceType,
    }));
  }

  async getTrendData() {
    const hours: string[] = [];
    const risks: number[] = [];
    const alerts: number[] = [];

    for (let i = 23; i >= 0; i--) {
      const start = new Date();
      start.setHours(start.getHours() - i, 0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);

      const [riskCount, alertCount] = await Promise.all([
        this.prisma.riskEvent.count({
          where: { createdAt: { gte: start, lt: end } },
        }),
        this.prisma.alertRecord.count({
          where: { sentAt: { gte: start, lt: end } },
        }),
      ]);

      hours.push(start.getHours().toString().padStart(2, '0') + ':00');
      risks.push(riskCount);
      alerts.push(alertCount);
    }

    return { hours, risks, alerts };
  }

  async getAgentStatus() {
    // 模拟Agent状态
    return [
      { id: 'AGENT-C1', name: 'CollectionAgent', type: 'collector', status: 'online', lastHeartbeat: new Date().toISOString() },
      { id: 'AGENT-A1', name: 'AssessmentAgent', type: 'assessor', status: 'online', lastHeartbeat: new Date().toISOString() },
      { id: 'AGENT-D1', name: 'DecisionAgent', type: 'decision', status: 'online', lastHeartbeat: new Date().toISOString() },
    ];
  }
}
