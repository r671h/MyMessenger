'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { apiFetch } from '../../../../src/lib/api';
import Avatar from '../../../../src/components/Avatar';
import MessageBubble from '../../../../src/components/MessageBubble';
import TypingDots from '../../../../src/components/TypingDots';
import ChatInput from '../../../../src/components/ChatInput';
import type { User, ChatMessage, Attachment } from '../../../../src/types/chat';

interface GroupInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  participants: { user: User }[];
}

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params.id as string;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [readStatus, setReadStatus] = useState<Map<string, string>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => router.push('/login'));

    apiFetch(`/api/groupchats/${groupId}`).then(setGroup);
    apiFetch(`/api/groupchats/${groupId}/messages`).then(setMessages);
    apiFetch(`/api/groupchats/${groupId}/read-status`).then(
      (data: { userId: string; lastReadAt: string }[]) => {
        setReadStatus(new Map(data.map((r) => [r.userId, r.lastReadAt])));
      }
    );

    const socket = io('http://localhost:4000', { withCredentials: true });
    socketRef.current = socket;

    socket.emit('groupchat:read', groupId);

    socket.on('groupchat:new', (message: ChatMessage & { groupChatId: string }) => {
      if (message.groupChatId !== groupId) return; // ignore messages for other groups
      setMessages((prev) => [...prev, message]);
      socket.emit('groupchat:read', groupId);
    });

    socket.on('groupchat:read-update', (data: { groupChatId: string; userId: string; readAt: string }) => {
      if (data.groupChatId === groupId) {
        setReadStatus((prev) => new Map(prev).set(data.userId, data.readAt));
      }
    });

    socket.on('typing:update', ({ userId, username, typing }: { userId: string; username?: string; typing: boolean }) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (typing && username) next.set(userId, username);
        else next.delete(userId);
        return next;
      });
    });

    socket.on('groupchat:updated', (updatedMessage: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)));
    });

    socket.on('groupchat:reactions-updated', ({ messageId, reactions }: { messageId: string; reactions: any[] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });

    return () => {
      socket.disconnect();
    };
  }, [groupId, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  function getSeenCount(messageCreatedAt: string, senderId: string): number {
    let count = 0;
    readStatus.forEach((lastReadAt, userId) => {
      if (userId !== senderId && new Date(lastReadAt) >= new Date(messageCreatedAt)) count++;
    });
    return count;
  }

  function handleSend(content: string | undefined, attachment: Attachment | null) {
    socketRef.current?.emit('groupchat:send', {
      groupChatId: groupId,
      content,
      ...attachment,
    });
  }

  function handleEdit(messageId: string, content: string) {
    socketRef.current?.emit('groupchat:edit', { messageId, content });
  }

  function handleDelete(messageId: string) {
    if (!confirm('Delete this message?')) return;
    socketRef.current?.emit('groupchat:delete', { messageId });
  }

  function handleReact(messageId: string, emoji: string) {
    socketRef.current?.emit('groupchat:react', { messageId, emoji });
  }

  return (
    <main className="flex flex-col h-full bg-[#0E1621] text-[#E9EDF0]">
      <header className="flex items-center gap-3 px-4 py-3 bg-[#17212B] border-b border-black/30 shrink-0">
        {group && <Avatar name={group.name} avatarUrl={group.avatarUrl} size={36} />}
        <div>
          <p className="font-medium">{group?.name || 'Loading...'}</p>
          {group && <p className="text-xs text-[#6C7883]">{group.participants.length} members</p>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col justify-end gap-1">
        {messages.map((msg, i) => {
          const isOwn = msg.sender.id === currentUser?.id;
          const prev = messages[i - 1];
          const showAvatarAndName = !prev || prev.sender.id !== msg.sender.id;
          const seenCount = isOwn ? getSeenCount(msg.createdAt, msg.sender.id) : 0;

          return (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={isOwn}
              showAvatarAndName={showAvatarAndName}
              receipt={isOwn ? <span>· {seenCount > 0 ? `Seen by ${seenCount}` : 'Sent'}</span> : undefined}
              currentUserId={currentUser?.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={handleReact}
            />
          );
        })}

        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-9" />
            <TypingDots />
          </div>
        )}

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