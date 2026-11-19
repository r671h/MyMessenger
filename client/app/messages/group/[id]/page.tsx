'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { Socket } from 'socket.io-client';
import { apiFetch } from '../../../../src/lib/api';
import { connectSocket, TYPING_INDICATOR_TTL_MS, type TypingUpdate } from '../../../../src/lib/socket';
import { requestChatListRefresh } from '../../../../src/lib/chatListRefresh';
import Avatar from '../../../../src/components/Avatar';
import MessageBubble from '../../../../src/components/MessageBubble';
import TypingDots from '../../../../src/components/TypingDots';
import ChatInput from '../../../../src/components/ChatInput';
import ChatThreadSkeleton, { ChatHeaderSkeleton } from '../../../../src/components/skeletons/ChatThreadSkeleton';
import type { User, ChatMessage, Attachment, Reaction } from '../../../../src/types/chat';
import { ArrowLeft, MoreVertical, Trash2, LogOut, UserMinus } from 'lucide-react';
interface GroupInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  createdById: string;
  participants: { user: User }[];
}

export default function GroupChatPage() {
  const params = useParams();
  const groupId = params.id as string;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [readStatus, setReadStatus] = useState<Map<string, string>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);

  useEffect(() => {
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const clearTyping = (userId: string) => {
      clearTimeout(typingTimers.get(userId));
      typingTimers.delete(userId);
      setTypingUsers((prev) => {
        if (!prev.has(userId)) return prev;
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });
    };

    apiFetch('/api/auth/me')
      .then(setCurrentUser)
      .catch(() => router.push('/login'));

    apiFetch(`/api/groupchats/${groupId}`)
      .then(setGroup)
      .catch(() => router.push('/messages'));
    apiFetch(`/api/groupchats/${groupId}/messages`)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setMessagesLoaded(true));
    apiFetch(`/api/groupchats/${groupId}/read-status`)
      .then((data: { userId: string; lastReadAt: string }[]) => {
        setReadStatus(new Map(data.map((r) => [r.userId, r.lastReadAt])));
      })
      .catch(() => {});

    const socket = connectSocket();
    socketRef.current = socket;

    socket.emit('groupchat:read', groupId);

    socket.on('groupchat:new', (message: ChatMessage & { groupChatId: string }) => {
      if (message.groupChatId !== groupId) return; // ignore messages for other groups
      setMessages((prev) => [...prev, message]);
      clearTyping(message.sender.id);
      socket.emit('groupchat:read', groupId);
    });

    socket.on('groupchat:read-update', (data: { groupChatId: string; userId: string; readAt: string }) => {
      if (data.groupChatId === groupId) {
        setReadStatus((prev) => new Map(prev).set(data.userId, data.readAt));
      }
    });

    socket.on('typing:update', ({ chatType, chatId, userId, username, typing }: TypingUpdate) => {
      if (chatType !== 'group' || chatId !== groupId) return;
      if (!typing) return clearTyping(userId);

      setTypingUsers((prev) => new Map(prev).set(userId, username || 'Someone'));
      clearTimeout(typingTimers.get(userId));
      typingTimers.set(userId, setTimeout(() => clearTyping(userId), TYPING_INDICATOR_TTL_MS));
    });

    socket.on('groupchat:updated', (updatedMessage: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m)));
    });

    socket.on('groupchat:reactions-updated', ({ messageId, reactions }: { messageId: string; reactions: Reaction[] }) => {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
    });

    socket.on('groupchat:removed', ({ groupChatId }: { groupChatId: string }) => {
      if (groupChatId === groupId) {
        alert('You were removed from this group');
        router.push('/messages');
      }
    });

    socket.on('groupchat:deleted', ({ groupChatId }: { groupChatId: string }) => {
      if (groupChatId === groupId) {
        alert('This group was deleted');
        router.push('/messages');
      }
    });

    return () => {
      typingTimers.forEach(clearTimeout);
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

  function handleSend(content: string | undefined, attachment: Attachment | null, replyToId: string | null) {
    socketRef.current?.emit('groupchat:send', {
      groupChatId: groupId,
      content,
      replyToId,
      ...attachment,
    });
  }

  function handleQuoteClick(messageId: string) {
    const el = document.getElementById(`msg-${messageId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  async function handleLeaveGroup() {
    if (!confirm('Leave this group?')) return;
    await apiFetch(`/api/groupchats/${groupId}/leave`, { method: 'POST' });
    requestChatListRefresh();
    router.push('/messages');
  }

  async function handleDeleteGroup() {
    if (!confirm('Delete this group for everyone? This cannot be undone.')) return;
    // The server notifies all members in real time.
    await apiFetch(`/api/groupchats/${groupId}`, { method: 'DELETE' });
    requestChatListRefresh();
    router.push('/messages');
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this member from the group?')) return;
    // The server notifies the removed member in real time.
    await apiFetch(`/api/groupchats/${groupId}/members/${userId}`, { method: 'DELETE' });
    setGroup((prev) => prev && { ...prev, participants: prev.participants.filter((p) => p.user.id !== userId) });
    requestChatListRefresh();
  }

  

  return (
    <main className="flex flex-col h-full bg-[#0E1621] text-[#E9EDF0]">
      {!group ? (
        <ChatHeaderSkeleton />
      ) : (
        <header className="flex items-center gap-3 px-4 py-3 bg-[#17212B] border-b border-black/30 shrink-0">
          <button onClick={() => router.push('/messages')} className="md:hidden text-[#6C7883] hover:text-white shrink-0">
            <ArrowLeft size={20} />
          </button>
          <Avatar name={group.name} avatarUrl={group.avatarUrl} size={36} />
          <div className="flex-1">
            <p className="font-medium">{group.name}</p>
            <p className="text-xs text-[#6C7883]">{group.participants.length} members</p>
          </div>
          <div className="relative">
            <button onClick={() => setMenuOpen((v) => !v)} className="text-[#6C7883] hover:text-white p-1">
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-[#242F3D] rounded-lg shadow-lg py-1 w-56 z-10">
                {group?.participants.map((p) => (
                  <div key={p.user.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                    <button
                      onClick={() => { router.push(`/users/${p.user.id}`); setMenuOpen(false); }}
                      className="truncate hover:text-[#3390EC] text-left cursor-pointer"
                    >
                      {p.user.username}
                    </button>
                    {group.createdById === currentUser?.id && p.user.id !== currentUser?.id && (
                      <button onClick={() => handleRemoveMember(p.user.id)} className="text-[#6C7883] hover:text-red-400">
                        <UserMinus size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <div className="border-t border-black/30 mt-1 pt-1">
                  <button
                    onClick={handleLeaveGroup}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#E9EDF0] hover:bg-black/20 text-left"
                  >
                    <LogOut size={14} /> Leave group
                  </button>
                  {group.createdById === currentUser?.id && (
                    <button
                      onClick={handleDeleteGroup}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-black/20 text-left"
                    >
                      <Trash2 size={14} /> Delete group
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      {!messagesLoaded ? (
        <ChatThreadSkeleton />
      ) : (
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-1">
        {messages.map((msg, i) => {
          const isOwn = msg.sender.id === currentUser?.id;
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const showSenderName = !prev || prev.sender.id !== msg.sender.id;
          const showAvatar = !next || next.sender.id !== msg.sender.id;
          const seenCount = isOwn ? getSeenCount(msg.createdAt, msg.sender.id) : 0;

          return (
            <div key={msg.id} id={`msg-${msg.id}`}>
              <MessageBubble
                msg={msg}
                isOwn={isOwn}
                showSenderName={showSenderName}
                showAvatar={showAvatar}
                receipt={isOwn ? <span>· {seenCount > 0 ? `Seen by ${seenCount}` : 'Sent'}</span> : undefined}
                currentUserId={currentUser?.id}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReact={handleReact}
                onReply={setReplyTarget}
                onQuoteClick={handleQuoteClick}
              />
            </div>
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
      )}

      <ChatInput
        onSend={handleSend}
        onTypingStart={() => socketRef.current?.emit('typing:start', { chatType: 'group', chatId: groupId })}
        onTypingStop={() => socketRef.current?.emit('typing:stop', { chatType: 'group', chatId: groupId })}
        replyTarget={replyTarget}
        onCancelReply={() => setReplyTarget(null)}
      />
    </main>
  );
}