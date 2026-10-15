import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketIOOptions {
  url: string;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onMessage?: (event: string, data: any) => void;
  silent?: boolean;
}

export function useSocketIO(options: UseSocketIOOptions) {
  const { url, onConnect, onDisconnect, onMessage, silent = false } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const log = silent ? () => {} : console.log;

  useEffect(() => {
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 3000,
    });

    socket.on('connect', () => {
      log('Socket.IO connected');
      setIsConnected(true);
      onConnect?.();
    });

    socket.on('disconnect', () => {
      log('Socket.IO disconnected');
      setIsConnected(false);
      onDisconnect?.();
    });

    socket.on('risk_alert', (data) => {
      onMessage?.('risk_alert', data);
    });

    socket.on('alarm', (data) => {
      onMessage?.('alarm', data);
    });

    socket.on('device_data', (data) => {
      onMessage?.('device_data', data);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [url, onConnect, onDisconnect, onMessage, log]);

  const emit = useCallback((event: string, data?: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { isConnected, emit, socket: socketRef.current };
}
