'use client';

import { useEffect, useState,useRef } from 'react';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {apiFetch} from '../../lib/api';
import { LogOut, Send } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; username: string; avatarUrl: string | null };
}

interface User {
    id: string,
    email: string,
    username: string
}

// Deterministic color per username — same person always gets the same color
const AVATAR_COLORS = [
  '#E17076', '#7BC862', '#65AADD', '#A695E7',
  '#EE7AAE', '#6EC9CB', '#FAA774', '#5D9BD4',
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ username, avatarUrl }: { username: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={`http://localhost:4000${avatarUrl}`}
        alt={username}
        className="w-9 h-9 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
      style={{ backgroundColor: colorForName(username) }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
    const [typingUsers, setTypingUsers] = useState<Map<string,string>>(new Map());
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [messages,setMessages] = useState<Message[]>([]);
    const [input,setInput] = useState('');
    const [connected,setConnected] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const socketRef = useRef<Socket | null>(null);
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement | null>(null)

    useEffect(()=>{
        //Load messahe history
        apiFetch('/api/messages')
            .then(setMessages)
            .catch(() => router.push('/login'))

        apiFetch('/api/auth/me')
            .then(setCurrentUser)
            .catch(() => router.push('/login'));
        const socket = io('http://localhost:4000', {
            withCredentials: true //cookies are sent with the request
        });
        socketRef.current = socket;

        socket.on('connect', ()=> setConnected(true));
        socket.on('disconnect', ()=> setConnected(false));

        socket.on('message:new', (message: Message) => {
            setMessages((prev) => [ ...prev, message ]);
        });
        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err.message);
        });

        socket.on("typing:update", ({userId,username,typing} : {userId: string, username:string, typing:boolean}) => {
            console.log('typing:update received:', userId, username, typing); // debug
            setTypingUsers((prev)=>{
                const next = new Map(prev);
                if(typing && username){
                    next.set(userId, username);
                } else {
                    next.delete(userId);
                }
                return next;
            });
        });
        

        return () => {
            socket.disconnect();
        };
    },[router]);

    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({behavior:"smooth"})
    },[messages])

    function handleSend(e: React.FormEvent){
        e.preventDefault();
        const socket = socketRef.current; 
        if (!input.trim() || !socket) return;
        socket.emit('message:send', input);
        socket.emit('typing:stop');
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        setInput("");
    }

    async function handleLogout() {
        await apiFetch('/api/auth/logout',{
            method:"POST"
        });
        router.push('/login')
    }

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        setInput(e.target.value);
        socketRef.current?.emit("typing:start");

        if(typingTimeoutRef.current){
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(()=>{
            socketRef.current?.emit('typing:stop');
        }, 1500)
    }

    return(
        <main className="flex flex-col h-screen bg-[#0E1621] text-[#E9EDF0]">
            <header className="flex items-center justify-between px-4 py-3 bg-[#17212B] border-b border-black/30 shrink-0">
                <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#3390EC] flex items-center justify-center font-semibold">
                    #
                </div>
                <div>
                    <p className="font-medium leading-tight">General Chat</p>
                    <p className="text-xs text-[#6C7883] flex items-center gap-1">
                    <span
                        className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#3390EC]' : 'bg-red-500'}`}
                    />
                    {connected ? 'online' : 'connecting...'}
                    </p>
                </div>
                </div>

                {currentUser && (
                <div className="flex items-center gap-3">
                    <button
                    onClick={() => router.push('/profile')}
                    className="text-sm text-[#6C7883] hover:text-white"
                    >
                    {currentUser.username}
                    </button>
                    <button onClick={() => router.push('/messages')} className="text-sm text-[#3390EC]">
                        Messages
                    </button>
                    <button
                    onClick={handleLogout}
                    className="text-[#6C7883] hover:text-white transition-colors"
                    aria-label="Log out"
                    >
                    <LogOut size={18} />
                    </button>
                </div>
                )}
            </header>

            <div
                className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1"
                style={{
                backgroundImage:
                    'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                }}
            >
                {messages.map((msg, i) => {
                const isOwn = msg.author.id === currentUser?.id;
                const prev = messages[i - 1];
                const isGroupStart = !prev || prev.author.id !== msg.author.id;

                return (
                    <div
                    key={msg.id}
                    className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${
                        isGroupStart ? 'mt-2' : 'mt-0.5'
                    }`}
                    >
                    {!isOwn && (
                        <div className="w-9 shrink-0">
                            {isGroupStart && <Avatar username={msg.author.username} avatarUrl={msg.author.avatarUrl} />}
                        </div>
                    )}

                    <div
                        className={`max-w-[65%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                        isOwn
                            ? 'bg-[#2B5278] rounded-br-md'
                            : 'bg-[#182533] rounded-bl-md'
                        }`}
                    >
                        {!isOwn && isGroupStart && (
                        <p
                            className="text-xs font-medium mb-0.5"
                            style={{ color: colorForName(msg.author.username) }}
                        >
                            {msg.author.username}
                        </p>
                        )}
                        <p className="wrap-break-words">{msg.content}</p>
                        <p className="text-[10px] text-[#8FA3AD] text-right mt-1">
                        {formatTime(msg.createdAt)}
                        </p>
                    </div>
                    </div>
                );
                })}

                {typingUsers.size > 0 && (
                <div className="flex items-center gap-2 mt-2">
                    <div className="w-9" />
                    <div className="bg-[#182533] rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce" />
                    </div>
                </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 px-4 py-3 bg-[#17212B] border-t border-black/30 shrink-0"
            >
                <input
                className="flex-1 bg-[#242F3D] text-[#E9EDF0] placeholder-[#6C7883] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
                value={input}
                onChange={handleInputChange}
                placeholder="Message"
                />
                <button
                type="submit"
                disabled={!input.trim()}
                className="w-10 h-10 rounded-full bg-[#3390EC] disabled:bg-[#242F3D] disabled:text-[#6C7883] flex items-center justify-center text-white transition-colors shrink-0"
                aria-label="Send message"
                >
                <Send size={18} />
                </button>
            </form>
        </main>
    )
}