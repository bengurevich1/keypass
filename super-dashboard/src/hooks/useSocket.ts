import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

export function useSocket(onEvent?: (event: string, data: any) => void) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    const events = [
      'door:status_changed',
      'access:new_log',
      'user:registered',
      'user:status_changed',
      'user:created',
      'door:created',
    ];

    events.forEach((event) => {
      socket.on(event, (data) => {
        onEvent?.(event, data);
      });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  return socketRef.current;
}
