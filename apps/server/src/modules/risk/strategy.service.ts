import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService, BlockchainService } from '@shared';
import { Prisma } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsInt,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStrategyDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() riskLevel: number;
  @IsArray() actions: any[];
  @IsOptional() notifyConfig?: any;
}

export class UpdateStrategyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() actions?: any[];
  @IsOptional() notifyConfig?: any;
  @IsOptional() @IsInt() status?: number;
}

export class QueryStrategyDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number;
  @IsOptional() @Type(() => Number) @IsInt() riskLevel?: number;
  @IsOptional() @Type(() => Number) @IsInt() status?: number;
  @IsOptional() @IsString() keyword?: string;
}

@Injectable()
export class StrategyService {
  private readonly logger = new Logger(StrategyService.name);

  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
  ) {}

  async create(dto: CreateStrategyDto) {
    return this.prisma.riskStrategy.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        riskLevel: dto.riskLevel,
        actions: dto.actions,
        notifyConfig: dto.notifyConfig ?? Prisma.JsonNull,
      },
    });
  }

  async query(dto: QueryStrategyDto) {
    const { page = 1, pageSize = 10 } = dto;
    const skip = (page - 1) * pageSize;
    const where: Prisma.RiskStrategyWhereInput = { deletedAt: null };

    if (dto.riskLevel) where.riskLevel = dto.riskLevel;
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.keyword) {
      where.OR = [
        { name: { contains: dto.keyword, mode: 'insensitive' } },
        { code: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.riskStrategy.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { riskLevel: 'asc' },
        include: {
          ruleStrategies: {
            include: { rule: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
      this.prisma.riskStrategy.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string) {
    const strategy = await this.prisma.riskStrategy.findFirst({
      where: { id, deletedAt: null },
      include: { ruleStrategies: { include: { rule: true } } },
    });
    if (!strategy) throw new NotFoundException('策略不存在');
    return strategy;
  }

  async update(id: string, dto: UpdateStrategyDto) {
    const data: Prisma.RiskStrategyUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.actions) data.actions = dto.actions;
    if (dto.notifyConfig !== undefined) data.notifyConfig = dto.notifyConfig;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.riskStrategy.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.riskStrategy.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async getByRiskLevel(riskLevel: number) {
    return this.prisma.riskStrategy.findFirst({
      where: { riskLevel, status: 1, deletedAt: null },
    });
  }

  async execute(strategyId: string, context: Record<string, any>) {
    const strategy = await this.getById(strategyId);
    const actions = strategy.actions as any[];
    const results = [];
    for (const action of actions) {
      results.push(await this.executeAction(action, context));
    }
    return { actions: actions.map((a) => a.type), results };
  }

  private async executeAction(action: any, context: Record<string, any>) {
    switch (action.type) {
      case 'log':
        console.log(`[Risk] Event: ${context.riskId}`);
        return { type: 'log', success: true };
      case 'notify':
        return { type: 'notify', success: true, channels: action.config?.channels ?? [] };
      case 'alert':
        return { type: 'alert', success: true };
      case 'blockchain':
        return this.executeBlockchainAction(action, context);
      case 'escalate':
        return { type: 'escalate', success: true, level: action.config?.level };
      default:
        return { type: action.type, success: false, error: 'Unknown action' };
    }
  }

  private async executeBlockchainAction(action: any, context: Record<string, any>) {
    if (!this.blockchain.isEnabled()) {
      this.logger.warn('Blockchain disabled, skipping on-chain storage');
      return { type: 'blockchain', success: false, error: 'Blockchain disabled' };
    }
    const riskEventId = context.riskId || context.riskEventId;
    if (!riskEventId) {
      return { type: 'blockchain', success: false, error: 'Missing riskEventId in context' };
    }
    try {
      const riskEvent = await this.prisma.riskEvent.findUnique({
        where: { id: riskEventId },
        select: { riskNo: true },
      });
      const result = await this.blockchain.storeWithLog(
        {
          riskEventNo: riskEvent?.riskNo || `RISK-${riskEventId}`,
          data: { context, ...action.config },
          dataType: action.config?.dataType || 'strategy_execution',
          operator: action.config?.operator || 'system',
        },
        riskEventId,
      );
      this.logger.log(`Blockchain evidence stored: ${result.txHash}`);
      return { type: 'blockchain', success: true, txHash: result.txHash, blockNumber: Number(result.blockNumber) };
    } catch (err: any) {
      this.logger.error(`Blockchain evidence failed: ${err.message}`);
      return { type: 'blockchain', success: false, error: err.message };
    }
  }
}
