import type { Server, Socket } from 'socket.io';
import { parseCookie } from 'cookie';
import { prisma } from '../prismaClient';
import { verifyToken } from '../middleware/auth';
import { emitToUsers } from '../lib/realtime';
import { isSafeFileUrl, normalizeMessageContent } from '../lib/validation';
import { ChatAdapter, dmAdapter, groupAdapter } from './chatAdapters';

declare module 'socket.io' {
  interface Socket {
    userId?: string;
  }
}

interface SendPayload {
  content?: unknown;
  fileUrl?: unknown;
  fileName?: unknown;
  fileType?: unknown;
  fileSize?: unknown;
  replyToId?: unknown;
}

type ChatType = 'dm' | 'group';

/** Number of open sockets per user; a user is "online" while at least one tab is connected. */
const onlineUsers = new Map<string, number>();

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 64;
}

/** Runs a socket handler, logging instead of crashing on unexpected errors. */
function safe<T extends unknown[]>(name: string, handler: (...args: T) => Promise<void>) {
  return (...args: T) => {
    handler(...args).catch((err) => console.error(`Error in "${name}" handler:`, err));
  };
}

export function registerSocketHandlers(io: Server) {
  // Authenticate the handshake with the same JWT as the REST API (auth payload or cookie).
  io.use((socket, next) => {
    const cookieToken = parseCookie(socket.handshake.headers.cookie || '').token;
    const userId = verifyToken(socket.handshake.auth?.token || cookieToken);
    if (!userId) return next(new Error('Not authenticated'));
    socket.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.userId!;
    socket.join(`user:${userId}`);

    prisma.user
      .findUnique({ where: { id: userId }, select: { username: true } })
      .then((user) => (socket.data.username = user?.username || 'Someone'))
      .catch(() => (socket.data.username = 'Someone'));

    // ---- presence ----
    const openSockets = onlineUsers.get(userId) || 0;
    onlineUsers.set(userId, openSockets + 1);
    if (openSockets === 0) {
      socket.broadcast.emit('presence:update', { userId, online: true });
    }
    socket.emit('presence:list', Array.from(onlineUsers.keys()));

    socket.on('disconnect', () => {
      const remaining = (onlineUsers.get(userId) || 1) - 1;
      if (remaining <= 0) {
        onlineUsers.delete(userId);
        socket.broadcast.emit('presence:update', { userId, online: false });
      } else {
        onlineUsers.set(userId, remaining);
      }
    });

    // ---- typing indicators (only delivered to other members of the same chat) ----
    const verifiedChats = new Set<string>();
    async function canAccess(chatType: ChatType, chatId: string) {
      const key = `${chatType}:${chatId}`;
      if (verifiedChats.has(key)) return true;
      const adapter = chatType === 'dm' ? dmAdapter : groupAdapter;
      const ok = await adapter.isMember(chatId, userId);
      if (ok) verifiedChats.add(key);
      return ok;
    }

    function onTyping(typing: boolean) {
      return safe(`typing:${typing ? 'start' : 'stop'}`, async (payload: { chatType?: unknown; chatId?: unknown }) => {
        const { chatType, chatId } = payload ?? {};
        if ((chatType !== 'dm' && chatType !== 'group') || !isId(chatId)) return;
        if (!(await canAccess(chatType, chatId))) return;

        const adapter = chatType === 'dm' ? dmAdapter : groupAdapter;
        const recipients = (await adapter.memberIds(chatId)).filter((id) => id !== userId);
        emitToUsers(recipients, 'typing:update', {
          chatType,
          chatId,
          userId,
          username: socket.data.username,
          typing,
        });
      });
    }
    socket.on('typing:start', onTyping(true));
    socket.on('typing:stop', onTyping(false));

    // ---- messaging: identical flows for DMs and groups ----
    registerChatHandlers(socket, userId, dmAdapter, 'conversation');
    registerChatHandlers(socket, userId, groupAdapter, 'groupchat');
  });
}

function registerChatHandlers(socket: Socket, userId: string, adapter: ChatAdapter, readEventPrefix: string) {
  const { eventPrefix: prefix, chatIdKey } = adapter;

  async function broadcast(chatId: string, event: string, payload: unknown) {
    emitToUsers(await adapter.memberIds(chatId), event, payload);
  }

  // SEND
  socket.on(`${prefix}:send`, safe(`${prefix}:send`, async (data: SendPayload & Record<string, unknown>) => {
    const chatId = data?.[chatIdKey];
    if (!isId(chatId)) return;

    const content = normalizeMessageContent(data.content);
    const hasFile = isSafeFileUrl(data.fileUrl);
    if (!content && !hasFile) return;
    if (!(await adapter.isMember(chatId, userId))) return;

    // A reply must point at a message from the same chat, otherwise its content would leak across chats.
    const replyToId =
      isId(data.replyToId) && (await adapter.messageInChat(data.replyToId, chatId)) ? data.replyToId : null;

    const message = await adapter.createMessage({
      chatId,
      senderId: userId,
      content,
      replyToId,
      ...(hasFile && {
        fileUrl: data.fileUrl as string,
        fileName: typeof data.fileName === 'string' ? data.fileName.slice(0, 255) : 'file',
        fileType: typeof data.fileType === 'string' ? data.fileType.slice(0, 100) : 'application/octet-stream',
        fileSize: typeof data.fileSize === 'number' ? Math.max(0, Math.floor(data.fileSize)) : 0,
      }),
    });

    await adapter.afterSend?.(chatId);
    await broadcast(chatId, `${prefix}:new`, { ...message, [chatIdKey]: chatId });
  }));

  // EDIT (sender only)
  socket.on(`${prefix}:edit`, safe(`${prefix}:edit`, async ({ messageId, content }: { messageId?: unknown; content?: unknown } = {}) => {
    const text = normalizeMessageContent(content);
    if (!isId(messageId) || !text) return;

    const message = await adapter.findMessage(messageId);
    if (!message || message.senderId !== userId || message.deletedAt) return;

    const updated = await adapter.editMessage(messageId, text);
    await broadcast(message.chatId, `${prefix}:updated`, { ...updated, [chatIdKey]: message.chatId });
  }));

  // DELETE (sender only, soft delete keeps the bubble as "message deleted")
  socket.on(`${prefix}:delete`, safe(`${prefix}:delete`, async ({ messageId }: { messageId?: unknown } = {}) => {
    if (!isId(messageId)) return;

    const message = await adapter.findMessage(messageId);
    if (!message || message.senderId !== userId || message.deletedAt) return;

    const updated = await adapter.deleteMessage(messageId);
    await broadcast(message.chatId, `${prefix}:updated`, { ...updated, [chatIdKey]: message.chatId });
  }));

  // REACT (toggle; members only)
  socket.on(`${prefix}:react`, safe(`${prefix}:react`, async ({ messageId, emoji }: { messageId?: unknown; emoji?: unknown } = {}) => {
    if (!isId(messageId) || typeof emoji !== 'string' || !emoji || emoji.length > 16) return;

    const message = await adapter.findMessage(messageId);
    if (!message || message.deletedAt) return;
    if (!(await adapter.isMember(message.chatId, userId))) return;

    const reactions = await adapter.toggleReaction(messageId, userId, emoji);
    await broadcast(message.chatId, `${prefix}:reactions-updated`, { messageId, reactions });
  }));

  // READ receipts
  socket.on(`${readEventPrefix}:read`, safe(`${readEventPrefix}:read`, async (chatId: unknown) => {
    if (!isId(chatId) || !(await adapter.isMember(chatId, userId))) return;

    const readAt = new Date();
    await adapter.markRead(chatId, userId, readAt);

    const others = (await adapter.memberIds(chatId)).filter((id) => id !== userId);
    emitToUsers(others, `${readEventPrefix}:read-update`, { [chatIdKey]: chatId, userId, readAt });
  }));
}
