import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '../middleware/auth';

let io: SocketServer | null = null;

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.cors.origins,
      methods: ['GET', 'POST'],
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('אימות נדרש'));
    }
    try {
      const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('טוקן לא תקין'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user as JwtPayload;

    // Join role-based rooms
    if (user.role === 'super_admin') {
      socket.join('super_admin');
    } else if (user.role === 'admin' && user.orgId) {
      socket.join(`org:${user.orgId}`);
    }

    socket.on('disconnect', () => {});
  });

  return io;
}

export function emitToOrg(orgId: string, event: string, data: any): void {
  if (!io) return;
  io.to(`org:${orgId}`).emit(event, data);
  // Super admins also receive org events
  io.to('super_admin').emit(event, { ...data, orgId });
}

export function emitToSuperAdmins(event: string, data: any): void {
  if (!io) return;
  io.to('super_admin').emit(event, data);
}

export function getSocketServer(): SocketServer | null {
  return io;
}
