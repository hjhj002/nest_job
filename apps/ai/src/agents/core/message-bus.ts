import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v4 as uuidv4 } from 'uuid';

export enum MessageType {
  DATA_COLLECTED   = 'agent:data:collected',
  RISK_ASSESSED    = 'agent:risk:assessed',
  DECISION_MADE    = 'agent:decision:made',
  ALERT_TRIGGERED  = 'agent:alert:triggered',
  EVIDENCE_STORED  = 'agent:evidence:stored',
  AGENT_HEARTBEAT  = 'agent:heartbeat',
  ERROR            = 'agent:error',
}

export enum AgentType {
  COLLECTION  = 'CollectionAgent',
  ASSESSMENT  = 'AssessmentAgent',
  DECISION    = 'DecisionAgent',
}

export interface AgentMessage {
  id?: string;
  type: MessageType;
  sender: string;
  receiver: string;
  payload: any;
  traceId: string;
  timestamp?: Date;
}

type MessageHandler = (message: AgentMessage) => Promise<void> | void;

@Injectable()
export class MessageBus {
  private handlers = new Map<string, MessageHandler[]>();

  constructor(private eventEmitter: EventEmitter2) {
    for (const type of Object.values(MessageType)) {
      this.eventEmitter.on(type, (msg: AgentMessage) => this.dispatch(msg));
    }
  }

  publish(message: Omit<AgentMessage, 'id' | 'timestamp'>) {
    const full: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };
    this.eventEmitter.emit(message.type, full);
  }

  subscribe(type: MessageType, handler: MessageHandler) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler);
  }

  unsubscribe(type: MessageType, handler: MessageHandler) {
    const list = this.handlers.get(type);
    if (!list) return;
    const idx = list.indexOf(handler);
    if (idx > -1) list.splice(idx, 1);
  }

  private dispatch(message: AgentMessage) {
    const handlers = this.handlers.get(message.type) ?? [];
    for (const h of handlers) {
      Promise.resolve(h(message)).catch((err) =>
        console.error(`[MessageBus] handler error for ${message.type}:`, err),
      );
    }
  }

  generateTraceId(): string {
    return `trace-${Date.now()}-${uuidv4().slice(0, 8)}`;
  }

  sendHeartbeat(agentName: string) {
    this.publish({
      type: MessageType.AGENT_HEARTBEAT,
      sender: agentName,
      receiver: 'all',
      payload: { agentName, status: 'alive', timestamp: new Date().toISOString() },
      traceId: this.generateTraceId(),
    });
  }
}
