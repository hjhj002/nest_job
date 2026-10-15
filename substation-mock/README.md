# Substation Device Data Mock Service

变电站设备数据模拟服务，用于多智能体风控系统测试。

## 功能特性

- **5种设备类型**: 变压器(TX)、断路器(CB)、母线(Bus)、电容器(Cap)、避雷器(LA)
- **真实参数模拟**: 电压±5%、电流±10%、温度±20℃、负载率0-100%
- **状态分布**: 正常85%、警告10%、异常5%
- **异常告警**: 过温、油位低、跳闸故障、过载
- **高并发生成**: 使用goroutine并发生成数据
- **RabbitMQ推送**: 可选消息队列推送
- **REST API**: 标准JSON响应格式

## 快速开始

### 安装依赖

```bash
cd substation-mock
go mod tidy
```

### 运行服务

```bash
# 默认运行
go run main.go

# 指定端口
go run main.go -port 9090

# 启用RabbitMQ推送
go run main.go -mq -mq-host localhost

# 查看版本
go run main.go -version
```

### 编译运行

```bash
go build -o substation-mock
./substation-mock
```

## API接口

### 1. 健康检查
```bash
GET /health
```

### 2. 获取设备数据
```bash
GET /api/v1/device-data?count=5
```

参数:
- `count`: 返回设备数量，默认5，最大100

响应示例:
```json
{
  "success": true,
  "data": [
    {
      "device_id": "TX_001_ABC1",
      "device_type": "TX",
      "location": "主变1号站-出线5",
      "voltage": 218.5,
      "current": 485.2,
      "frequency": 50.02,
      "temperature": 58.5,
      "oil_level": 82.3,
      "load_rate": 65.4,
      "tap_position": 3,
      "status": "normal",
      "alarms": [],
      "maintenance_due": "2024-07-15T00:00:00Z",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 3. 获取设备统计
```bash
GET /api/v1/device-stats
```

### 4. 获取设备类型列表
```bash
GET /api/v1/device-types
```

## 环境变量配置

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | HTTP服务器端口 | 8080 |
| RABBITMQ_HOST | RabbitMQ主机地址 | localhost |
| RABBITMQ_PORT | RabbitMQ端口 | 5672 |
| RABBITMQ_USER | RabbitMQ用户名 | guest |
| RABBITMQ_PASS | RabbitMQ密码 | guest |
| RABBITMQ_VHOST | RabbitMQ虚拟主机 | / |

## 项目结构

```
substation-mock/
├── main.go                 # 入口文件
├── go.mod                  # Go模块定义
├── README.md               # 项目说明
└── pkg/
    ├── data/
    │   └── device.go       # 设备数据结构和生成逻辑
    ├── api/
    │   └── router.go       # API路由和处理器
    └── service/
        └── rabbitmq.go     # RabbitMQ服务
```

## 设备数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| device_id | string | 设备唯一标识 |
| device_type | string | 设备类型: TX/CB/Bus/Cap/LA |
| location | string | 设备位置 |
| voltage | float64 | 电压(kV) |
| current | float64 | 电流(A) |
| frequency | float64 | 频率(Hz) |
| temperature | float64 | 温度(℃) |
| oil_level | float64 | 油位百分比(%)，变压器特有 |
| load_rate | float64 | 负载率(%) |
| tap_position | int | 分接头位置，变压器特有 |
| status | string | 状态: normal/warning/abnormal |
| alarms | []string | 告警列表 |
| last_fault | string | 最近故障类型 |
| fault_time | string | 故障时间 |
| maintenance_due | string | 下次维护日期 |
| timestamp | string | 数据时间戳(ISO8601) |

## 告警规则

- **过温告警**: 温度 > 80℃
- **油位低告警**: 变压器油位 < 70%
- **跳闸故障**: 电流为0且状态异常
- **过载告警**: 电流 > 1500A

## 扩展开发

### 添加新的设备类型

1. 在 `pkg/data/device.go` 中添加新的设备类型常量
2. 在 `deviceTypeConfigs` 中添加基础参数配置
3. 在 `getRandomFaultType` 中添加故障类型

### 添加新的API端点

1. 在 `pkg/api/router.go` 中添加处理器方法
2. 在 `SetupRouter` 函数中注册路由

### WebSocket支持

可通过以下步骤添加WebSocket实时推送:

1. 添加 `pkg/service/websocket.go` 实现WebSocket管理器
2. 在 `main.go` 中启动WebSocket服务
3. 在数据生成时广播到所有连接的客户端

## 许可证

MIT License
