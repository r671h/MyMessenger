'use client';

import { useEffect,useState,useRef } from "react";
import { useRouter,useParams } from "next/navigation";
import { io,Socket } from "socket.io-client";
import { ArrowLeft, Send } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface User{
    username: string,
    id: string,
    avatarUrl:string | null
}

interface DirectMessage {
    id:string,
    content:string,
    createdAt:string
    sender:User
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleDateString([], {hour:'2-digit',minute:'2-digit'});
}

export default function DMPage(){
    const params = useParams();
    const conversationId = params.id as string;
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [otherUser, setOtherUser] = useState<User | null>(null);
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [input, setInput] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(()=>{
        apiFetch('/api/auth/me')
        .then(setCurrentUser)
        .catch(()=>router.push('/login'));

        apiFetch('/api/conversations')
        .then((convs) => {
            const conv = convs.find((c: any) => c.id === conversationId);
            if (conv) setOtherUser(conv.otherUser);
        });

        apiFetch(`/api/conversations/${conversationId}/messages`).then(setMessages);

        const socket = io('http://localhost:4000', {withCredentials:true});
        socketRef.current = socket;

        socket.emit("conversation:join",conversationId);

        socket.on("dm:new",(message: DirectMessage) => {
            setMessages((prev) => [...prev,message]);
        });

        return () => {
            socket.emit("conversation:leave", conversationId);
            socket.disconnect();
        };
    }, [conversationId,router]);

    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
    }, [messages]);

    function handleSend(e: React.FormEvent){
        e.preventDefault();
        const socket = socketRef.current;
        if(!input.trim() || !socket) return;
        socket.emit("dm:send", {conversationId, content: input});
        setInput('');
    }

    return(
        <main className="flex flex-col h-screen bg-[#0E1621] text-[#E9EDF0]">
            <header className="flex items-center gap-3 px-4 py-3 bg-[#17212B] border-b border-black/30 shrink-0">
                <button onClick={()=>router.push("/messages")} className="text-[#6C7883] hover:text-white">
                    <ArrowLeft size={28}/>
                </button>
                {otherUser?.avatarUrl ? (
                    <img src={`http://localhost:4000${otherUser.avatarUrl}`} alt="" className="w-9 h-9 rounded-full object-cover"/>
                ) : (
                    <div className="w-9 h-9 rounded-full bg-[#3390EC] flex items-center justify-center font-medium">
                        {otherUser?.username.charAt(0).toUpperCase()}
                    </div>
                )
                }
                <p className="font-medium">{otherUser?.username || 'Loading...'}</p>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
                {messages.map((msg) => {
                    const isOwn = msg.sender.id === currentUser?.id;
                    return(
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mt-0.5`}>
                            <div className={`max-w-[65%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                  isOwn ? 'bg-[#2B5278] rounded-br-md' : 'bg-[#182533] rounded-bl-md'
                }`}>
                                <p className="break-words">{msg.content}</p>
                                <p className="text-[10px] text-[#8FA3AD] text-right mt-1">{formatTime(msg.createdAt)}</p>
                            </div>
                        </div>
                    )
                })}
                <div ref={messagesEndRef}></div>
            </div>

            <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 bg-[#17212B] border-t border-black/30 shrink-0">
                <input
                className="flex-1 bg-[#242F3D] text-[#E9EDF0] placeholder-[#6C7883] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message"
                />
                <button
                className="w-10 h-10 rounded-full bg-[#3390EC] disabled:bg-[#242F3D] disabled:text-[#6C7883] flex items-center justify-center text-white transition-colors shrink-0"
                type="submit"
                disabled={!input.trim()}
                aria-label="Send message"
                >
                    <Send size={18}/>
                </button>
            </form>
        </main>
    )
}