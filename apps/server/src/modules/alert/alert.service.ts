import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class AlertService {
  constructor(private prisma: PrismaService) {}

  async list(params: {
    page?: number;
    pageSize?: number;
    level?: string;
    status?: string;
    deviceId?: string;
    keyword?: string;
    startTime?: string;
    endTime?: string;
  }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;
    const where: Prisma.AlertRecordWhereInput = {};

    if (params.level) where.alertLevel = parseInt(params.level);
    if (params.status !== undefined && params.status !== '') where.status = parseInt(params.status);
    if (params.deviceId) {
      where.riskEvent = { deviceId: params.deviceId };
    }
    if (params.keyword) {
      const kw = params.keyword;
      where.OR = [
        { title: { contains: kw } },
        { content: { contains: kw } },
        { riskEvent: { is: { deviceId: { contains: kw } } } },
        { riskEvent: { is: { description: { contains: kw } } } },
        { riskEvent: { is: { device: { is: { name: { contains: kw } } } } } },
        { riskEvent: { is: { device: { is: { code: { contains: kw } } } } } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.alertRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sentAt: 'desc' },
        include: {
          riskEvent: { include: { device: { select: { id: true, code: true, name: true } } } },
        },
      }),
      this.prisma.alertRecord.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getLatest(limit: number = 10) {
    return this.prisma.alertRecord.findMany({
      take: limit,
      orderBy: { sentAt: 'desc' },
      include: {
        riskEvent: { include: { device: { select: { id: true, code: true, name: true } } } },
      },
    });
  }

  async markAsRead(id: string) {
    const alert = await this.prisma.alertRecord.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('告警不存在');
    return this.prisma.alertRecord.update({
      where: { id },
      data: { status: 1, confirmedAt: new Date() },
    });
  }

  async handle(id: string, dto: { handler: string; remark?: string }) {
    const alert = await this.prisma.alertRecord.findUnique({ where: { id } });
    if (!alert) throw new NotFoundException('告警不存在');
    return this.prisma.alertRecord.update({
      where: { id },
      data: { status: 2 },
    });
  }

  async getUnreadCount() {
    return this.prisma.alertRecord.count({ where: { status: 0 } });
  }
}
