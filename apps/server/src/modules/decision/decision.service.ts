import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared';

@Injectable()
export class DecisionService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page?: number; pageSize?: number; riskId?: string }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;

    // Group agent logs by traceId to form decision workflows
    const traces = await this.prisma.agentLog.groupBy({
      by: ['traceId'],
      orderBy: { traceId: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.prisma.agentLog
      .groupBy({ by: ['traceId'] })
      .then((r) => r.length);

    const list = await Promise.all(
      traces.map(async (t) => {
        const logs = await this.prisma.agentLog.findMany({
          where: { traceId: t.traceId },
          orderBy: { createdAt: 'asc' },
        });

        const first = logs[0];
        const last = logs[logs.length - 1];
        // Get riskId from any step that has one (orchestrator step 1 doesn't)
        const riskId = logs.find((l) => l.riskId)?.riskId || null;

        // Fetch associated risk event
        let riskEvent: { id: string; riskNo: string; riskType: string; riskLevel: number; title: string } | null = null;
        if (riskId) {
          riskEvent = await this.prisma.riskEvent.findUnique({
            where: { id: riskId },
            select: { id: true, riskNo: true, riskType: true, riskLevel: true, title: true },
          });
        }

        return {
          id: t.traceId,
          traceId: t.traceId,
          riskId,
          riskEvent,
          agentCount: logs.length,
          agents: logs.map((l) => l.agentName),
          status: last?.level === 'error' ? 'failed' : 'completed',
          duration: logs.reduce((sum, l) => sum + (l.duration || 0), 0),
          steps: logs.map((l) => ({
            id: l.id,
            agentName: l.agentName,
            agentType: l.agentType,
            status: l.level === 'error' ? 'failed' : 'completed',
            input: l.inputData,
            output: l.outputData,
            startTime: l.createdAt.toISOString(),
            duration: l.duration || 0,
          })),
          createdAt: first?.createdAt?.toISOString() || '',
        };
      }),
    );

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getByTraceId(traceId: string) {
    const logs = await this.prisma.agentLog.findMany({
      where: { traceId },
      orderBy: { createdAt: 'asc' },
    });
    return { traceId, steps: logs };
  }

  async getByRiskId(riskId: string) {
    const logs = await this.prisma.agentLog.findMany({
      where: { riskId },
      orderBy: { createdAt: 'asc' },
    });

    const traceIds = [...new Set(logs.map((l) => l.traceId))];
    return { riskId, traceIds, logs };
  }

  async getReviews(params: { page?: number; pageSize?: number; status?: string }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;
    const where: any = { reviewStatus: params.status || 'PENDING_REVIEW' };

    const [list, total] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          device: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.riskEvent.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async approveReview(riskId: string, userId: string) {
    const risk = await this.prisma.riskEvent.findUnique({ where: { id: riskId } });
    if (!risk) throw new NotFoundException('风险事件不存在');
    if (risk.reviewStatus !== 'PENDING_REVIEW') throw new BadRequestException('该风险事件不需要审核');

    const updated = await this.prisma.riskEvent.update({
      where: { id: riskId },
      data: {
        reviewStatus: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        status: 1, // 处理中
      },
    });

    // Log the review action
    await this.prisma.agentLog.create({
      data: {
        traceId: `review-${riskId}`,
        agentName: 'Operator',
        agentType: 'human',
        level: 'info',
        message: '运维人员审核通过，执行决策',
        outputData: { action: 'approve', reviewedBy: userId },
        riskId,
        duration: 0,
      },
    });

    return updated;
  }

  async rejectReview(riskId: string, comment: string, userId: string) {
    const risk = await this.prisma.riskEvent.findUnique({ where: { id: riskId } });
    if (!risk) throw new NotFoundException('风险事件不存在');
    if (risk.reviewStatus !== 'PENDING_REVIEW') throw new BadRequestException('该风险事件不需要审核');

    const updated = await this.prisma.riskEvent.update({
      where: { id: riskId },
      data: {
        reviewStatus: 'REJECTED',
        reviewComment: comment,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
    });

    // Log the rejection
    await this.prisma.agentLog.create({
      data: {
        traceId: `review-${riskId}`,
        agentName: 'Operator',
        agentType: 'human',
        level: 'warn',
        message: `运维人员驳回: ${comment}`,
        outputData: { action: 'reject', reviewedBy: userId, comment },
        riskId,
        duration: 0,
      },
    });

    return updated;
  }

  async getAgentStatus() {
    // Query recent agent activity
    const recentLogs = await this.prisma.agentLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { agentName: true, agentType: true, createdAt: true, level: true },
    });

    const agents = ['CollectionAgent', 'AssessmentAgent', 'DecisionAgent', 'Orchestrator'];
    return agents.map((name) => {
      const lastLog = recentLogs.find((l) => l.agentName === name);
      return {
        id: name,
        name,
        type: name === 'Orchestrator' ? 'orchestrator' : name.replace('Agent', '').toLowerCase(),
        status: lastLog ? (lastLog.level === 'error' ? 'warning' : 'online') : 'offline',
        lastHeartbeat: lastLog?.createdAt?.toISOString() || null,
      };
    });
  }
}
