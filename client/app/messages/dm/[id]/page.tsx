'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { apiFetch, getApiUrl } from '../../../../src/lib/api';
import { requestChatListRefresh } from '../../../../src/lib/chatListRefresh';
import Avatar from '../../../../src/components/Avatar';
import MessageBubble from '../../../../src/components/MessageBubble';
import TypingDots from '../../../../src/components/TypingDots';
import ChatInput from '../../../../src/components/ChatInput';
import type { User, ChatMessage, Attachment } from '../../../../src/types/chat';
import { ArrowLeft, MoreVertical, Trash2 } from 'lucide-react';

export default function DMPage() {
  const params = useParams();
  const conversationId = params.id as string;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => router.push('/login'));

    apiFetch('/api/conversations').then((convs) => {
      const conv = convs.find((c: any) => c.id === conversationId);
      if (conv) setOtherUser(conv.otherUser);
    });

    apiFetch(`/api/conversations/${conversationId}/messages`).then(setMessages);

    apiFetch(`/api/conversations/${conversationId}/read-status`)
      .then((data) => setOtherLastReadAt(data.otherLastReadAt))
      .catch(() => {});

    const socket = io(getApiUrl(), { withCredentials: true });
    socketRef.current = socket;

    socket.emit('conversation:join', conversationId);
    socket.emit('conversation:read', conversationId);

    socket.on('dm:new', (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      socket.emit('conversation:read', conversationId);
    });

    socket.on('typing:update', ({ userId, typing }: { userId: string; typing: boolean }) => {
      if (userId === otherUser?.id || !otherUser) {
        setIsOtherTyping(typing);
      }
    });

    socket.on('presence:list', (userIds: string[]) => setOnlineUsers(new Set(userIds)));
    socket.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    socket.on('conversation:read-update', (data: { conversationId: string; readAt: string }) => {
      if (data.conversationId === conversationId) {
        setOtherLastReadAt(data.readAt);
      }
    });

    socket.on('dm:updated', (updatedMessage: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)));
    });

    socket.on('dm:reactions-updated', ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });

    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.disconnect();
    };
  }, [conversationId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  function handleSend(content: string | undefined, attachment: Attachment | null) {
    socketRef.current?.emit('dm:send', {
      conversationId,
      content,
      ...attachment,
    });
  }

  function handleEdit(messageId: string, content: string) {
    socketRef.current?.emit('dm:edit', { messageId, content });
  }

  function handleDelete(messageId: string) {
    if (!confirm('Delete this message?')) return;
    socketRef.current?.emit('dm:delete', { messageId });
  }

  function handleReact(messageId: string, emoji: string) {
    socketRef.current?.emit('dm:react', { messageId, emoji });
  }

  async function handleDeleteChat() {
    if (!confirm('Delete this conversation? It will be removed from your list.')) return;
    await apiFetch(`/api/conversations/${conversationId}/hide`, { method: 'POST' });
    requestChatListRefresh();
    router.push('/messages');
  }

  return (
    <main className="flex flex-col h-full bg-[#0E1621] text-[#E9EDF0]">
      <header className="flex items-center gap-3 px-4 py-3 bg-[#17212B] border-b border-black/30 shrink-0">
        <button onClick={() => router.push('/messages')} className="md:hidden text-[#6C7883] hover:text-white shrink-0">
          <ArrowLeft size={20} />
        </button>
        {otherUser && <Avatar name={otherUser.username} avatarUrl={otherUser.avatarUrl} size={36} />}
        <div className="flex-1">
          <p className="font-medium">{otherUser?.username || 'Loading...'}</p>
          {otherUser && (
            <p className="text-xs text-[#6C7883]">
              {onlineUsers.has(otherUser.id) ? 'online' : 'offline'}
            </p>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="text-[#6C7883] hover:text-white p-1">
            <MoreVertical size={18} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-[#242F3D] rounded-lg shadow-lg py-1 w-44 z-10">
              <button
                onClick={handleDeleteChat}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-black/20 text-left"
              >
                <Trash2 size={14} /> Delete chat
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {messages.map((msg) => {
          const isOwn = msg.sender.id === currentUser?.id;
          const isRead = isOwn && !!otherLastReadAt && new Date(msg.createdAt) <= new Date(otherLastReadAt);

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={isOwn}
              showAvatarAndName={false} // DMs don't need repeated name/avatar per message, only 2 people
              receipt={
                isOwn ? (
                  <span className={isRead ? 'text-[#3390EC]' : 'text-[#8FA3AD]'}>{isRead ? '✓✓' : '✓'}</span>
                ) : undefined
              }
              currentUserId={currentUser?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={handleReact}
            />
          );
        })}

        {isOtherTyping && <TypingDots />}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        onTypingStart={() => socketRef.current?.emit('typing:start')}
        onTypingStop={() => socketRef.current?.emit('typing:stop')}
      />
    </main>
  );
}