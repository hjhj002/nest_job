import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, BlockchainService } from '@shared';
import { Prisma } from '@prisma/client';

@Injectable()
export class BcService {
  constructor(
    private prisma: PrismaService,
    private blockchain: BlockchainService,
  ) {}

  async list(params: {
    page?: number;
    pageSize?: number;
    deviceId?: string;
    eventId?: string;
    keyword?: string;
  }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;
    const where: Prisma.BlockchainLogWhereInput = {};

    if (params.eventId) where.riskEventId = params.eventId;

    const keyword = params.keyword?.trim();
    if (keyword) {
      where.OR = [
        { riskEventId: { contains: keyword } },
        { txHash: { contains: keyword } },
        { dataHash: { contains: keyword } },
        { errorMsg: { contains: keyword } },
        { riskEvent: { is: { riskNo: { contains: keyword } } } },
        { riskEvent: { is: { title: { contains: keyword } } } },
        { riskEvent: { is: { deviceId: { contains: keyword } } } },
        { riskEvent: { is: { riskType: { contains: keyword } } } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.blockchainLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { riskEvent: true },
      }),
      this.prisma.blockchainLog.count({ where }),
    ]);

    const serialized = list.map((item) => ({
      ...item,
      blockNumber: item.blockNumber ? item.blockNumber.toString() : null,
    }));

    return { list: serialized, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getDetail(id: string) {
    const record = await this.prisma.blockchainLog.findUnique({
      where: { id },
      include: { riskEvent: true },
    });
    if (!record) throw new NotFoundException('存证记录不存在');
    return record;
  }

  async verify(id: string) {
    const record = await this.prisma.blockchainLog.findUnique({
      where: { id },
    });
    if (!record) throw new NotFoundException('存证记录不存在');
    if (!record.dataHash) return { valid: false, message: '存证数据哈希为空' };

    try {
      const result = await this.blockchain.verifyByHash(record.dataHash);
      return { valid: result.exists, message: result.exists ? '数据哈希已上链存证有效' : '链上未找到对应哈希' };
    } catch (e: any) {
      return { valid: false, message: `验证失败: ${e.message}` };
    }
  }

  async certify(
    data: Record<string, any>,
    dataType?: string,
    operator?: string,
  ) {
    const riskEventNo = `CERT-${Date.now()}`;
    const riskEventId = `cert-risk-${Date.now()}`;

    // Create placeholder RiskEvent to satisfy FK
    await this.prisma.riskEvent.create({
      data: {
        id: riskEventId,
        riskNo: riskEventNo,
        riskType: 'manual_certification',
        riskLevel: 0,
        title: `手动认证-${riskEventNo}`,
        description: `操作人: ${operator || 'admin'}`,
        status: 2,
        occurredAt: new Date(),
      },
    });

    const result = await this.blockchain.storeEvidence({
      riskEventNo,
      data,
      dataType: dataType || 'manual_certification',
      operator: operator || 'admin',
    });

    await this.prisma.blockchainLog.create({
      data: {
        riskEventId,
        txHash: result.txHash,
        blockNumber: Number(result.blockNumber),
        dataHash: result.dataHash,
        status: 1,
      },
    });

    return {
      success: true,
      riskEventNo,
      certificateId: result.evidenceId,
      txHash: result.txHash,
      blockNumber: result.blockNumber.toString(),
      dataHash: result.dataHash,
      timestamp: new Date().toISOString(),
    };
  }

  async getStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalRecords, todayRecords, confirmedRecords, pendingRecords] = await Promise.all([
      this.prisma.blockchainLog.count(),
      this.prisma.blockchainLog.count({ where: { createdAt: { gte: today } } }),
      this.prisma.blockchainLog.count({ where: { status: 1 } }),
      this.prisma.blockchainLog.count({ where: { status: 0 } }),
    ]);

    return { totalRecords, todayRecords, confirmedRecords, pendingRecords };
  }
}
