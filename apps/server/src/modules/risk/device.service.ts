import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@shared';
import { Prisma } from '@prisma/client';

// substation-mock 设备类型代号到数据库 deviceType 字段的映射
const MOCK_DEVICE_TYPE_MAP: Record<string, string> = {
  TX: 'transformer',
  CB: 'breaker',
  Bus: 'busbar',
  Cap: 'capacitor',
  LA: 'arrester',
};

// 默认 mock 服务地址，可通过环境变量 SUBSTATION_MOCK_URL 覆盖
const DEFAULT_MOCK_BASE_URL = 'http://localhost:8080';

@Injectable()
export class DeviceService implements OnModuleInit {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private prisma: PrismaService) {}

  // 服务启动时自动尝试从 mock 服务同步一次（mock 未启动时静默失败）
  async onModuleInit() {
    try {
      const result = await this.syncFromMock();
      this.logger.log(`启动时同步 mock 设备完成，共同步 ${result.count} 台设备`);
    } catch (err) {
      this.logger.warn(
        `启动时同步 mock 设备失败（可能 mock 服务未启动）: ${(err as Error).message}`,
      );
    }
  }

  // 从 substation-mock 拉取设备数据并 upsert 到数据库，按 code 字段匹配
  async syncFromMock() {
    const baseUrl = process.env.SUBSTATION_MOCK_URL || DEFAULT_MOCK_BASE_URL;
    const url = `${baseUrl}/api/v1/devices/data`;

    let payload: any;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`mock 服务返回 HTTP ${res.status}`);
      }
      payload = await res.json();
    } catch (err) {
      const reason = (err as Error).message || String(err);
      throw new Error(`无法连接 substation-mock 服务 (${url}): ${reason}`);
    }

    const list: any[] = Array.isArray(payload?.data) ? payload.data : [];
    let count = 0;
    for (const item of list) {
      const code: string | undefined = item?.device_id;
      if (!code) continue;

      const rawType = String(item?.device_type ?? '');
      const deviceType = MOCK_DEVICE_TYPE_MAP[rawType] || rawType.toLowerCase() || 'unknown';
      // mock 中 location 字段实际承载了 CSV 中配置的设备名；优先使用显式 device_name
      const name: string = item?.device_name || item?.location || code;
      const location: string | undefined = item?.location || undefined;
      // normal/warning -> 在线(1)，abnormal -> 离线(0)
      const status = item?.status === 'abnormal' ? 0 : 1;

      await this.prisma.device.upsert({
        where: { code },
        create: { code, name, deviceType, status, location },
        update: { name, deviceType, status, location },
      });
      count++;
    }

    return { success: true, count, total: list.length };
  }

  async list(params: {
    page?: number;
    pageSize?: number;
    keyword?: string;
    type?: string;
    status?: string;
  }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;
    const where: Prisma.DeviceWhereInput = {};

    if (params.keyword) {
      where.OR = [
        { name: { contains: params.keyword, mode: 'insensitive' } },
        { code: { contains: params.keyword, mode: 'insensitive' } },
      ];
    }
    if (params.type) where.deviceType = params.type;
    if (params.status !== undefined) {
      where.status = parseInt(String(params.status));
    }

    const [list, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ]);

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string) {
    const device = await this.prisma.device.findUnique({
      where: { id },
      include: {
        deviceData: { orderBy: { recordedAt: 'desc' }, take: 1 },
      },
    });
    if (!device) throw new NotFoundException('设备不存在');
    return device;
  }

  async getHistory(id: string, startTime?: string, endTime?: string) {
    const where: Prisma.DeviceDataWhereInput = { deviceId: id };
    if (startTime || endTime) {
      where.recordedAt = {};
      if (startTime) where.recordedAt.gte = new Date(startTime);
      if (endTime) where.recordedAt.lte = new Date(endTime);
    }

    return this.prisma.deviceData.findMany({
      where,
      orderBy: { recordedAt: 'asc' },
      take: 500,
      select: {
        id: true,
        voltageA: true,
        voltageB: true,
        voltageC: true,
        currentA: true,
        currentB: true,
        currentC: true,
        activePower: true,
        temperature: true,
        humidity: true,
        sf6Pressure: true,
        partialDischarge: true,
        recordedAt: true,
      },
    });
  }

  async getAll() {
    return this.prisma.device.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, deviceType: true, status: true, location: true },
    });
  }

  async update(id: string, dto: { name?: string; location?: string; description?: string; status?: number }) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('设备不存在');

    return this.prisma.device.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async remove(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('设备不存在');

    await this.prisma.device.delete({ where: { id } });
    return { success: true };
  }

  async saveData(dto: {
    deviceId: string;
    voltageA?: number;
    voltageB?: number;
    voltageC?: number;
    currentA?: number;
    currentB?: number;
    currentC?: number;
    activePower?: number;
    reactivePower?: number;
    temperature?: number;
    humidity?: number;
    sf6Pressure?: number;
    partialDischarge?: number;
    rawData?: any;
  }) {
    const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    return this.prisma.deviceData.create({
      data: {
        deviceId: dto.deviceId,
        voltageA: dto.voltageA,
        voltageB: dto.voltageB,
        voltageC: dto.voltageC,
        currentA: dto.currentA,
        currentB: dto.currentB,
        currentC: dto.currentC,
        activePower: dto.activePower,
        reactivePower: dto.reactivePower,
        temperature: dto.temperature,
        humidity: dto.humidity,
        sf6Pressure: dto.sf6Pressure,
        partialDischarge: dto.partialDischarge,
        rawData: dto.rawData,
      },
    });
  }
}
