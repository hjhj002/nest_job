# 变电站风险管控系统 (nest_job)

基于 NestJS 的变电站设备风险管控平台:采集变电站设备状态数据,通过 AI 智能体进行风险评估与决策,并将风险证据上链存证(FISCO BCOS)。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 后端服务 `apps/server` | NestJS + Prisma + PostgreSQL + JWT |
| AI 智能体 `apps/ai` | NestJS + LangChain(评估/采集/决策智能体) |
| 前端 `web` | React + Vite + Ant Design |
| 区块链 `libs/shared` + `contracts` | FISCO BCOS + Solidity 智能合约 |
| 数据模拟 `substation-mock` | Go(模拟变电站设备数据上报) |

## 目录结构

```
apps/
  server/          # 后端 API(风险、告警、决策、大屏、区块链、用户权限等)
  ai/              # AI 智能体服务
web/               # 前端页面
libs/shared/       # 共享库(Prisma schema、区块链服务)
contracts/         # 智能合约(Solidity)
substation-mock/   # 变电站设备数据模拟服务(Go)
conf/              # FISCO BCOS 节点配置(密钥,已 gitignore)
```

## 快速开始

```bash
# 1. 安装依赖(需要 pnpm)
pnpm install

# 2. 配置环境变量
cp .env.example .env   # 按需填写数据库、私钥、LLM 等配置

# 3. 初始化数据库(PostgreSQL)
#    schema 位于 libs/shared/src/prisma/schema.prisma

# 4. 启动全部服务(server + ai + web)
pnpm start:all

# 或分别启动
pnpm start:server   # 后端
pnpm start:ai       # AI 服务
cd web && pnpm dev  # 前端
```

## 环境要求

- Node.js ≥ 18
- pnpm
- PostgreSQL
- Go(仅运行 substation-mock 时需要)
- FISCO BCOS 节点(区块链功能需要,配置见 `.env.example`)
