import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared';
import { Prisma } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRiskEventDto {
  @IsOptional() @IsString() deviceId?: string;
  @IsString() riskType: string;
  @IsInt() riskLevel: number;
  @IsOptional() @IsNumber() riskScore?: number;
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() rawData?: any;
  @IsOptional() processedData?: any;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsDateString() occurredAt?: Date;
}

export class QueryRiskEventDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number;
  @IsOptional() @IsString() riskType?: string;
  @IsOptional() @Type(() => Number) @IsInt() riskLevel?: number;
  @IsOptional() @Type(() => Number) @IsInt() status?: number;
  @IsOptional() @IsDateString() startTime?: Date;
  @IsOptional() @IsDateString() endTime?: Date;
  @IsOptional() @IsString() keyword?: string;
}

export class HandleRiskEventDto {
  @IsInt() status: number;
  @IsOptional() @IsString() handleResult?: string;
}

@Injectable()
export class RiskService {
  constructor(private prisma: PrismaService) {}

  async createRiskEvent(dto: CreateRiskEventDto) {
    const riskNo = await this.generateRiskNo();
    return this.prisma.riskEvent.create({
      data: {
        riskNo,
        deviceId: dto.deviceId,
        riskType: dto.riskType,
        riskLevel: dto.riskLevel,
        riskScore: dto.riskScore
          ? new Prisma.Decimal(dto.riskScore)
          : undefined,
        title: dto.title,
        description: dto.description,
        rawData: dto.rawData ?? Prisma.JsonNull,
        processedData: dto.processedData ?? Prisma.JsonNull,
        location: dto.location,
        longitude: dto.longitude
          ? new Prisma.Decimal(dto.longitude)
          : undefined,
        latitude: dto.latitude ? new Prisma.Decimal(dto.latitude) : undefined,
        status: 0,
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      },
    });
  }

  private async generateRiskNo(): Promise<string> {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const count = await this.prisma.riskEvent.count({
      where: { occurredAt: { gte: startOfDay } },
    });
    return `RISK-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async queryRiskEvents(dto: QueryRiskEventDto) {
    const { page = 1, pageSize = 10 } = dto;
    const skip = (page - 1) * pageSize;
    const where: Prisma.RiskEventWhereInput = {};

    if (dto.riskType) where.riskType = dto.riskType;
    if (dto.riskLevel) where.riskLevel = dto.riskLevel;
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.startTime || dto.endTime) {
      where.occurredAt = {};
      if (dto.startTime) where.occurredAt.gte = new Date(dto.startTime);
      if (dto.endTime) where.occurredAt.lte = new Date(dto.endTime);
    }
    if (dto.keyword) {
      where.OR = [
        { title: { contains: dto.keyword, mode: 'insensitive' } },
        { description: { contains: dto.keyword, mode: 'insensitive' } },
        { riskNo: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { occurredAt: 'desc' },
        include: {
          device: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.riskEvent.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getRiskEventById(id: string) {
    const event = await this.prisma.riskEvent.findUnique({
      where: { id },
      include: {
        device: true,
        alertRecords: true,
        blockchainLogs: true,
      },
    });
    if (!event) throw new NotFoundException('风险事件不存在');
    return event;
  }

  async handleRiskEvent(id: string, dto: HandleRiskEventDto, userId: string) {
    return this.prisma.riskEvent.update({
      where: { id },
      data: {
        status: dto.status,
        handleResult: dto.handleResult,
        handledAt: new Date(),
        handledBy: userId,
      },
    });
  }

  async deleteRiskEvent(id: string) {
    return this.prisma.riskEvent.delete({ where: { id } });
  }

  async getStatistics(startTime?: Date, endTime?: Date) {
    const where: Prisma.RiskEventWhereInput = {};
    if (startTime || endTime) {
      where.occurredAt = {};
      if (startTime) where.occurredAt.gte = startTime;
      if (endTime) where.occurredAt.lte = endTime;
    }

    const [total, byLevel, byType, byStatus] = await Promise.all([
      this.prisma.riskEvent.count({ where }),
      this.prisma.riskEvent.groupBy({ by: ['riskLevel'], where, _count: { id: true } }),
      this.prisma.riskEvent.groupBy({ by: ['riskType'], where, _count: { id: true } }),
      this.prisma.riskEvent.groupBy({ by: ['status'], where, _count: { id: true } }),
    ]);

    const trend = await this.getTrend(7);

    return {
      total,
      byLevel: byLevel.map((i) => ({ level: i.riskLevel, count: i._count.id })),
      byType: byType.map((i) => ({ type: i.riskType, count: i._count.id })),
      byStatus: byStatus.map((i) => ({ status: i.status, count: i._count.id })),
      trend,
    };
  }

  private async getTrend(days: number) {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      const count = await this.prisma.riskEvent.count({
        where: { occurredAt: { gte: date, lt: nextDate } },
      });
      result.push({ date: date.toISOString().slice(0, 10), count });
    }
    return result;
  }

  async getRealtimeData() {
    const [pendingCount, todayCount, criticalEvents] = await Promise.all([
      this.prisma.riskEvent.count({ where: { status: 0 } }),
      this.prisma.riskEvent.count({
        where: { occurredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
      this.prisma.riskEvent.findMany({
        where: { riskLevel: 4, status: { in: [0, 1] } },
        take: 5,
        orderBy: { occurredAt: 'desc' },
      }),
    ]);

    return { pendingCount, todayCount, criticalEvents, lastUpdate: new Date().toISOString() };
  }
}
