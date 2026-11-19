import { io, Socket } from 'socket.io-client';
import { getApiUrl, getToken } from './api';

/** Opens an authenticated Socket.IO connection to the API. */
export function connectSocket(): Socket {
  return io(getApiUrl(), { withCredentials: true, auth: { token: getToken() } });
}

export type ChatType = 'dm' | 'group';

export interface TypingUpdate {
  chatType: ChatType;
  chatId: string;
  userId: string;
  username?: string;
  typing: boolean;
}

/** Remote typing indicators expire on their own in case a "stop" event is lost (tab closed, disconnect). */
export const TYPING_INDICATOR_TTL_MS = 4000;
