import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalDevices,
      onlineDevices,
      offlineDevices,
      todayRisks,
      pendingRisks,
      unreadAlerts,
      totalBlockchainRecords,
    ] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.device.count({ where: { status: 1 } }),
      this.prisma.device.count({ where: { status: 0 } }),
      this.prisma.riskEvent.count({ where: { createdAt: { gte: today } } }),
      this.prisma.riskEvent.count({ where: { status: 0 } }),
      this.prisma.alertRecord.count({ where: { status: 0 } }),
      this.prisma.blockchainLog.count(),
    ]);

    return {
      totalDevices,
      onlineDevices,
      offlineDevices,
      todayRisks,
      pendingRisks,
      unreadAlerts,
      totalBlockchainRecords,
    };
  }

  async getDeviceStatus() {
    const [online, offline] = await Promise.all([
      this.prisma.device.count({ where: { status: 1 } }),
      this.prisma.device.count({ where: { status: 0 } }),
    ]);
    return { online, offline };
  }

  async getRiskDistribution() {
    const [low, medium, high, critical] = await Promise.all([
      this.prisma.riskEvent.count({ where: { riskLevel: 1 } }),
      this.prisma.riskEvent.count({ where: { riskLevel: 2 } }),
      this.prisma.riskEvent.count({ where: { riskLevel: 3 } }),
      this.prisma.riskEvent.count({ where: { riskLevel: 4 } }),
    ]);
    return { low, medium, high, critical };
  }

  async getRealtime() {
    const devices = await this.prisma.device.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      include: { deviceData: { take: 1, orderBy: { recordedAt: 'desc' } } },
    });

    const latestRisks = await this.prisma.riskEvent.findMany({
      take: 5,
      orderBy: { occurredAt: 'desc' },
      include: { device: { select: { id: true, code: true, name: true } } },
    });

    return { devices, latestRisks };
  }
}
