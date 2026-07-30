'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Socket, io } from 'socket.io-client';

interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio?: string | null;
}

interface ConversationSummary {
  id: string;
  otherUser: UserSummary;
  lastMessage: { content: string; createdAt: string } | null;
}

function Avatar({ user,online }: {user: UserSummary,online:boolean}){
     const img = user.avatarUrl ? (
        <img
        src={`http://localhost:4000${user.avatarUrl}`}
        alt={user.username}
        className="w-11 h-11 rounded-full object-cover shrink-0"
        />
    ) : (
        <div className="w-11 h-11 rounded-full bg-[#3390EC] flex items-center justify-center text-white font-medium shrink-0">
        {user.username.charAt(0).toUpperCase()}
        </div>
    );

    return (
        <div className='relative shrink-0'>
            {img}
            {online && (
                <span className='absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#4FCE5D] border-2 border-[#0E1621]'/>
            )}
        </div>
    )
}

export default function MessagesPage(){
    const [conversations,setConversations] = useState<ConversationSummary[]>([]);
    const [searchQuery,setSearchQuery] = useState('');
    const [searchResults,setSearchResults] = useState<UserSummary[]>([]);
    const [loading,setLoading] = useState(true);
    const router = useRouter();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const socketRef = useRef<Socket | null>(null);

    useEffect(()=>{
        apiFetch('/api/conversations')
        .then(setConversations)
        .catch(()=>router.push("/login"))
        .finally(()=>setLoading(false))
    }, [router]);

    useEffect(()=>{
        if(!searchQuery.trim()){
            setSearchResults([]);
            return;
        }
        const timeout = setTimeout(()=>{
            apiFetch(`/api/users/search/${encodeURIComponent(searchQuery)}`)
            .then(setSearchResults)
            .catch(()=> setSearchResults([]))
        }, 300);

        return () => clearTimeout(timeout);
    }, [searchQuery]);

    useEffect(()=>{
        const socket = io('http://localhost:4000',{withCredentials:true})
        socketRef.current = socket;
        
        socket.on("presence:list",(userIds: string[]) => {
            setOnlineUsers(new Set(userIds))
        });

        socket.on("presence:update", ({ userId,online} : {userId:string,online:boolean}) => {
            setOnlineUsers((prev) => {
                const next = new Set(prev);
                if(online) next.add(userId);
                else next.delete(userId);
                return next;
            });
        });

        return () => {
            socket.disconnect();
        };
    },[]);

    async function startConversation(userId: string) {
        const conv = await apiFetch('/api/conversations',{
            method: 'POST',
            body: JSON.stringify({userId})
        });
        router.push(`/messages/${conv.id}`);
    }

    return(
        <main className='flex flex-col h-screen bg-[#0E1621] text-[#E9EDF0]'>
            <header className='px-4 py-3 border-b bprder-black/30 shrink-0 bg-[#17212B]'>
                <div className="flex items-center justify-between mb-3">
                <h1 className="text-xl font-bold">Messages</h1>
                <button onClick={() => router.push('/chat')} className="text-sm text-[#3390EC]">
                    Group chat
                </button>
                </div>
                <input
                className="w-full bg-[#242F3D] rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                />
            </header>
            <div className='flex-1 overflow-y-auto'>
                {searchQuery.trim() ? (
                    searchResults.length > 0 ? (
                        searchResults.map((user) => (
                            <button
                            key={user.id}
                            onClick={()=>startConversation(user.id)}
                            className='w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182533] transition-colors text-left'
                            >
                                <Avatar user={user} online={onlineUsers.has(user.id)}/>
                                <div>
                                    <p className='font-medium'>{user.username}</p>
                                    {user.bio && <p className="text-xs text-[#6C7883] truncate max-w-220">{user.bio}</p>}
                                </div>
                            </button>
                        ))
                    ) : (
                        <p className='text-center text-sm text-[#6C7883] mt-6'>No users found</p>
                    )
                ) : loading ? (
                    <p className="text-center text-sm text-[#6C7883] mt-6">Loading...</p>
                ) : conversations.length === 0 ? (
                    <p className="text-center text-sm text-[#6C7883] mt-6">
                        No conversations yet — search for someone to start chatting
                    </p>
                ) : (
                    conversations.map((conv) => (
                        <button
                        key={conv.id}
                        onClick={()=> router.push(`/messages/${conv.id}`)}
                        className='w-full flex items-center gap-3 px-4 py-3 hover:bg-[#182533] transition-colors text-left'
                        >
                            <Avatar user={conv.otherUser} online={onlineUsers.has(conv.otherUser.id)}/>
                            <div className='flex-1 min-w-0'>
                                <p className='font-medium'>{conv.otherUser.username}</p>
                                <p className="text-sm text-[#6C7883] truncate">
                                    {conv.lastMessage ? conv.lastMessage.content : 'No messages yet'}
                                </p>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </main>
    )
}