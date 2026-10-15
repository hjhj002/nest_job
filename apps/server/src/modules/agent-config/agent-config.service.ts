import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared';

@Injectable()
export class AgentConfigService {
  constructor(private prisma: PrismaService) {}

  async list(keyword?: string) {
    const where: any = {};
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { description: { contains: keyword } },
        { agentType: { contains: keyword } },
      ];
    }
    return this.prisma.agentConfig.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const config = await this.prisma.agentConfig.findUnique({ where: { id } });
    if (!config) throw new NotFoundException('Agent 配置不存在');
    return config;
  }

  async create(dto: {
    agentType: string;
    name: string;
    description?: string;
    config: any;
    status?: number;
  }) {
    return this.prisma.agentConfig.create({
      data: {
        agentType: dto.agentType,
        name: dto.name,
        description: dto.description,
        config: dto.config,
        status: dto.status ?? 1,
      },
    });
  }

  async update(id: string, dto: {
    agentType?: string;
    name?: string;
    description?: string;
    config?: any;
    status?: number;
  }) {
    const existing = await this.prisma.agentConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Agent 配置不存在');

    return this.prisma.agentConfig.update({
      where: { id },
      data: {
        ...(dto.agentType !== undefined && { agentType: dto.agentType }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.config !== undefined && { config: dto.config }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.agentConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Agent 配置不存在');

    await this.prisma.agentConfig.delete({ where: { id } });
    return { success: true };
  }
}
