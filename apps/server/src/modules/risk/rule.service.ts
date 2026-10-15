import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared';
import { Prisma } from '@prisma/client';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRuleDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsString() riskType: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() conditions: any[];
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsInt() priority?: number;
}

export class UpdateRuleDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() conditions?: any[];
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsInt() status?: number;
}

export class QueryRuleDto {
  @IsOptional() @Type(() => Number) @IsInt() page?: number;
  @IsOptional() @Type(() => Number) @IsInt() pageSize?: number;
  @IsOptional() @IsString() riskType?: string;
  @IsOptional() @Type(() => Number) @IsInt() status?: number;
  @IsOptional() @IsString() keyword?: string;
}

@Injectable()
export class RuleService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRuleDto) {
    return this.prisma.riskRule.create({
      data: {
        code: dto.code,
        name: dto.name,
        riskType: dto.riskType,
        description: dto.description,
        conditions: dto.conditions,
        weight: new Prisma.Decimal(dto.weight ?? 1.0),
        priority: dto.priority ?? 0,
      },
    });
  }

  async query(dto: QueryRuleDto) {
    const { page = 1, pageSize = 10 } = dto;
    const skip = (page - 1) * pageSize;
    const where: Prisma.RiskRuleWhereInput = { deletedAt: null };

    if (dto.riskType) where.riskType = dto.riskType;
    if (dto.status !== undefined) where.status = dto.status;
    if (dto.keyword) {
      where.OR = [
        { name: { contains: dto.keyword, mode: 'insensitive' } },
        { code: { contains: dto.keyword, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.riskRule.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          ruleStrategies: {
            include: { strategy: { select: { id: true, code: true, name: true } } },
          },
        },
      }),
      this.prisma.riskRule.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string) {
    const rule = await this.prisma.riskRule.findFirst({
      where: { id, deletedAt: null },
      include: { ruleStrategies: { include: { strategy: true } } },
    });
    if (!rule) throw new NotFoundException('规则不存在');
    return rule;
  }

  async update(id: string, dto: UpdateRuleDto) {
    const data: Prisma.RiskRuleUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.conditions) data.conditions = dto.conditions;
    if (dto.weight !== undefined) data.weight = new Prisma.Decimal(dto.weight);
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.riskRule.update({ where: { id }, data });
  }

  async delete(id: string) {
    return this.prisma.riskRule.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /** 规则引擎：对给定数据匹配所有启用规则，返回命中规则和总权重 */
  async evaluate(data: Record<string, any>) {
    const rules = await this.prisma.riskRule.findMany({
      where: { status: 1, deletedAt: null },
    });

    const matchedRules: string[] = [];
    let totalWeight = 0;

    for (const rule of rules) {
      const conditions = rule.conditions as any[];
      let matched = true;
      for (const cond of conditions) {
        const fieldValue = this.getNestedValue(data, cond.field);
        if (!this.evalCondition(fieldValue, cond.operator, cond.value)) {
          matched = false;
          break;
        }
      }
      if (matched) {
        matchedRules.push(rule.code);
        totalWeight += Number(rule.weight);
      }
    }

    return { matchedRules, totalWeight };
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((cur, key) => cur?.[key], obj);
  }

  private evalCondition(fieldValue: any, operator: string, value: any): boolean {
    switch (operator) {
      case '>': return fieldValue > value;
      case '>=': return fieldValue >= value;
      case '<': return fieldValue < value;
      case '<=': return fieldValue <= value;
      case '==': return fieldValue === value;
      case '!=': return fieldValue !== value;
      case 'includes': return Array.isArray(fieldValue) && fieldValue.includes(value);
      default: return false;
    }
  }
}
