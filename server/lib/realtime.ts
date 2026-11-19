import type { Server } from 'socket.io';

let io: Server | null = null;

export function setIo(server: Server) {
  io = server;
}

/** Every socket joins a personal `user:<id>` room, so events can target users across tabs/devices. */
export function emitToUsers(userIds: Iterable<string>, event: string, payload: unknown) {
  if (!io) return;
  for (const userId of userIds) {
    io.to(`user:${userId}`).emit(event, payload);
  }
}
