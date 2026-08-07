'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { io } from 'socket.io-client';
import { Search, LogOut, Plus, UserCircle } from 'lucide-react';
import { apiFetch, getApiUrl } from '../../src/lib/api';
import { onChatListRefreshRequested } from '../../src/lib/chatListRefresh';
import Avatar from '../../src/components/Avatar';

interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio?: string | null;
}

interface ChatItem {
  id: string;
  type: 'dm' | 'group';
  name: string;
  avatarUrl: string | null;
  lastMessage: { content: string | null; createdAt: string } | null;
  unread: boolean;
  lastActivity: string;
  otherUserId?: string;
}

export default function Sidebar() {
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSummary[]>([]);
  const router = useRouter();
  const pathname = usePathname();

  async function loadChats() {
    const [conversations, groups] = await Promise.all([
      apiFetch('/api/conversations'),
      apiFetch('/api/groupchats'),
    ]);

    const dmItems: ChatItem[] = conversations.map((c: any) => ({
      id: c.id,
      type: 'dm' as const,
      name: c.otherUser.username,
      avatarUrl: c.otherUser.avatarUrl,
      lastMessage: c.lastMessage,
      unread: c.unread,
      lastActivity: c.lastMessage?.createdAt || new Date(0).toISOString(),
      otherUserId: c.otherUser.id,
    }));

    const groupItems: ChatItem[] = groups.map((g: any) => ({
      id: g.id,
      type: 'group' as const,
      name: g.name,
      avatarUrl: g.avatarUrl,
      lastMessage: g.lastMessage,
      unread: g.unread,
      lastActivity: g.lastActivity,
    }));

    const merged = [...dmItems, ...groupItems].sort(
      (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    setChats(merged);
  }

  useEffect(() => {
    loadChats();

    const socket = io(`${getApiUrl()}`, { withCredentials: true });

    socket.on('presence:list', (userIds: string[]) => setOnlineUsers(new Set(userIds)));
    socket.on('presence:update', ({ userId, online }: { userId: string; online: boolean }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
      loadChats()
    });

    socket.on('dm:new', () => loadChats());
    socket.on('groupchat:new', () => loadChats());

    socket.on('dm:updated', () => loadChats());
    socket.on('groupchat:updated', () => loadChats());

    socket.on('groupchat:removed', () => loadChats());
    socket.on('groupchat:deleted', () => loadChats());

    socket.on('dm:deleted', () => loadChats());

    const unsubscribeRefresh = onChatListRefreshRequested(() => loadChats());

    return () => {
      socket.disconnect();
      unsubscribeRefresh();
    };
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      apiFetch(`/api/users/search/${encodeURIComponent(searchQuery)}`)
        .then(setSearchResults)
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  async function startConversation(userId: string) {
    const conv = await apiFetch('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setSearchQuery('');
    router.push(`/messages/dm/${conv.id}`);
  }

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="w-full flex flex-col h-full bg-[#0E1621] border-r border-black/30">
      <div className="px-3 py-3 flex items-center gap-2 border-b border-black/30">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C7883]" />
          <input
            className="w-full bg-[#242F3D] rounded-full pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => router.push('/profile')}
          className="text-[#6C7883] hover:text-white shrink-0"
          aria-label="Your profile"
        >
          <UserCircle size={20} />
        </button>
        <button
          onClick={() => router.push('/messages/new-group')}
          className="w-9 h-9 rounded-full bg-[#3390EC] flex items-center justify-center text-white shrink-0"
          aria-label="Create group"
        >
          <Plus size={18} />
        </button>
        <button onClick={handleLogout} className="text-[#6C7883] hover:text-white shrink-0" aria-label="Log out">
          <LogOut size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {searchQuery.trim() ? (
          searchResults.length > 0 ? (
            searchResults.map((user) => (
              <button
                key={user.id}
                onClick={() => startConversation(user.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182533] transition-colors text-left"
              >
                <Avatar name={user.username} avatarUrl={user.avatarUrl} online={onlineUsers.has(user.id)} size={44} />
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{user.username}</p>
                  {user.bio && <p className="text-xs text-[#6C7883] truncate">{user.bio}</p>}
                </div>
              </button>
            ))
          ) : (
            <p className="text-center text-sm text-[#6C7883] mt-6">No users found</p>
          )
        ) : chats.length === 0 ? (
          <p className="text-center text-sm text-[#6C7883] mt-6">
            No chats yet — search for someone or create a group
          </p>
        ) : (
          chats.map((chat) => {
            const href = chat.type === 'dm' ? `/messages/dm/${chat.id}` : `/messages/group/${chat.id}`;
            const isActive = pathname === href;
            return (
              <button
                key={`${chat.type}-${chat.id}`}
                onClick={() => router.push(href)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                  isActive ? 'bg-[#2B5278]' : 'hover:bg-[#182533]'
                }`}
              >
                <Avatar
                  name={chat.name}
                  avatarUrl={chat.avatarUrl}
                  online={chat.type === 'dm' && chat.otherUserId ? onlineUsers.has(chat.otherUserId) : false}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{chat.name}</p>
                  <p className={`text-sm truncate ${chat.unread ? 'text-white font-medium' : 'text-[#6C7883]'}`}>
                    {chat.lastMessage?.content || (chat.lastMessage ? '📎 Attachment' : 'No messages yet')}
                  </p>
                </div>
                {chat.unread && <span className="w-2.5 h-2.5 rounded-full bg-[#3390EC] shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}