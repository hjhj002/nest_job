import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared';
import * as crypto from 'crypto';

function md5(s: string) {
  return crypto.createHash('md5').update(s).digest('hex');
}

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page?: number; pageSize?: number; keyword?: string }) {
    const page = Number(params.page) || 1;
    const pageSize = Number(params.pageSize) || 10;
    const where: any = {};

    if (params.keyword) {
      where.OR = [
        { username: { contains: params.keyword, mode: 'insensitive' } },
        { realName: { contains: params.keyword, mode: 'insensitive' } },
      ];
    }

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          phone: true,
          realName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          userRoles: {
            select: {
              role: { select: { id: true, code: true, name: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mapped = list.map((u) => ({
      ...u,
      roles: u.userRoles.map((ur) => ur.role),
    }));

    return { list: mapped, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        realName: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('用户不存在');
    return {
      ...user,
      roles: user.userRoles.map((ur) => ur.role),
    };
  }

  async create(dto: {
    username: string;
    password: string;
    realName?: string;
    email?: string;
    phone?: string;
    roleIds?: string[];
  }) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) throw new BadRequestException('用户名已存在');

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: md5(dto.password),
        realName: dto.realName,
        email: dto.email,
        phone: dto.phone,
        status: 1,
        userRoles: dto.roleIds?.length
          ? {
              create: dto.roleIds.map((roleId) => ({ roleId })),
            }
          : undefined,
      },
    });

    return { id: user.id, username: user.username };
  }

  async update(id: string, dto: {
    realName?: string;
    email?: string;
    phone?: string;
    status?: number;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.realName !== undefined && { realName: dto.realName }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      select: { id: true, username: true },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    if (user.username === 'admin') throw new BadRequestException('不能删除超级管理员');

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async updateRoles(id: string, roleIds: string[]) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    // Delete existing roles, then assign new
    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    }
    return { success: true };
  }

  async getRoles() {
    return this.prisma.role.findMany({
      where: { status: 1 },
      select: { id: true, code: true, name: true, description: true },
    });
  }
}
