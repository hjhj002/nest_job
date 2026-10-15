import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared';

@Injectable()
export class LogService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    page?: number;
    pageSize?: number;
    level?: string;
    agentName?: string;
    traceId?: string;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 20;
    const where: any = {};

    if (params.level) where.level = params.level;
    if (params.agentName) where.agentName = params.agentName;
    if (params.traceId) where.traceId = params.traceId;
    if (params.keyword) {
      where.message = { contains: params.keyword, mode: 'insensitive' };
    }
    if (params.startTime || params.endTime) {
      where.createdAt = {};
      if (params.startTime) where.createdAt.gte = new Date(params.startTime);
      if (params.endTime) where.createdAt.lte = new Date(params.endTime);
    }

    const [list, total] = await Promise.all([
      this.prisma.agentLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.agentLog.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getDetail(id: string) {
    return this.prisma.agentLog.findUnique({ where: { id } });
  }

  async getStats() {
    const [total, infoCount, warnCount, errorCount, agents] = await Promise.all([
      this.prisma.agentLog.count(),
      this.prisma.agentLog.count({ where: { level: 'info' } }),
      this.prisma.agentLog.count({ where: { level: 'warn' } }),
      this.prisma.agentLog.count({ where: { level: 'error' } }),
      this.prisma.agentLog.groupBy({
        by: ['agentName'],
        _count: { agentName: true },
      }),
    ]);

    const byAgent: Record<string, number> = {};
    agents.forEach((a) => {
      byAgent[a.agentName] = a._count.agentName;
    });

    return {
      total,
      byLevel: { info: infoCount, warn: warnCount, error: errorCount },
      byAgent,
    };
  }
}
