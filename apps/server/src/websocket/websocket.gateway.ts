import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * WebSocket网关 - 处理实时数据推送
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private connectedClients: Map<string, Socket> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit() {
    this.logger.log('WebSocket Gateway initialized');

    // 监听风险事件，推送给所有客户端
    this.eventEmitter.on('risk.created', (data) => {
      this.broadcast('risk_alert', data);
    });

    // 监听告警事件
    this.eventEmitter.on('alert.created', (data) => {
      this.broadcast('alarm', data);
    });

    // 监听设备数据更新
    this.eventEmitter.on('device.data.updated', (data) => {
      this.broadcast('device_data', data);
    });
  }

  /**
   * 客户端连接
   */
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);

    // 发送欢迎消息
    client.emit('connected', {
      message: 'Connected to power monitoring system',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 客户端断开连接
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * 订阅大屏数据
   */
  @SubscribeMessage('subscribe_bigscreen')
  handleSubscribeBigscreen(client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to bigscreen`);
    client.join('bigscreen');
    return { event: 'subscribed', data: { channel: 'bigscreen' } };
  }

  /**
   * 订阅告警
   */
  @SubscribeMessage('subscribe_alerts')
  handleSubscribeAlerts(client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to alerts`);
    client.join('alerts');
    return { event: 'subscribed', data: { channel: 'alerts' } };
  }

  /**
   * 订阅设备数据
   */
  @SubscribeMessage('subscribe_devices')
  handleSubscribeDevices(client: Socket) {
    this.logger.log(`Client ${client.id} subscribed to devices`);
    client.join('devices');
    return { event: 'subscribed', data: { channel: 'devices' } };
  }

  /**
   * 广播消息到所有客户端
   */
  broadcast(event: string, data: any) {
    this.server.emit(event, {
      type: event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 发送消息到特定房间
   */
  broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, {
      type: event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取连接数
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
