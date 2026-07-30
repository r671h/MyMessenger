'use client';

import { useEffect,useState,useRef } from "react";
import { useRouter,useParams } from "next/navigation";
import { io,Socket } from "socket.io-client";
import { ArrowLeft, Send, FileIcon, Paperclip, X } from "lucide-react";
import { apiFetch, formatFileSize, apiUpload } from "@/lib/api";

interface User{
    username: string,
    id: string,
    avatarUrl:string | null
}

interface Attachment {
    fileUrl: string,
    fileName: string,
    fileType: string,
    fileSize: number
}

interface DirectMessage {
    id: string;
    content: string | null;
    createdAt: string;
    sender: User;
    fileUrl?: string,
    fileName?: string,
    fileType?: string,
    fileSize?: number
}

function formatTime(iso: string) {
    return new Date(iso).toLocaleDateString([], {hour:'2-digit',minute:'2-digit'});
}

function AttachmentView ({ msg } : {msg:DirectMessage}) {
    if(!msg.fileUrl) return null;
    const url = `http://localhost:4000${msg.fileUrl}`
    const isImage = msg.fileType?.startsWith("image/");

    if(isImage){
        return(
            <a href={url} target="_blank" rel="noopener noreferrer">
                <img
                src={url}
                alt={msg.fileName || 'attachment'}
                className='flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 mb-1 hover:bg-black/30 transition-colors'
                />
            </a>
        );
    }

    return(
        <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className='rounded-lg max-w-240 max-h-240 object-cover mb-1'>
            <FileIcon size={20} className='shrink-0'/>
            <div className='min-w-0'>
                <p className='text-sm truncate'>{msg.fileName}</p>
                <p className='text-xs text-[#8FA3AD]'>{formatFileSize(msg.fileSize || 0)}</p>
            </div>
        </a>
    )
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
    const [uploading,setUploading] = useState(false);
    const [pendingFile,setPendingFile] = useState<Attachment | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [typingUser, setTypingUser] = useState<Map<string,string>>(new Map());
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());


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

        socket.on("typing:update", ({typing,userId,username} : {typing:boolean,userId:string,username:string}) => {

            setTypingUser((prev) => {
                const next = new Map()
                if(typing && username) {
                    next.set(userId,username);
                } else {
                    next.delete(userId)
                }
                return next;
            })
        });

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
        if((!input.trim() && pendingFile) || !socket) return;
        socket.emit("dm:send", {
            conversationId, 
            content: input.trim() || undefined, 
            ...pendingFile});
        console.log(socket)
        setInput('');
        setPendingFile(null);
    }

    async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
                console.log('typing:update received:'); // debug

        setInput(e.target.value);
        socketRef.current?.emit("typing:start");

        if(typingTimeoutRef.current){
            clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit('typing:stop')
        }, 1500);
    } 

    async function handleFileSelect (e: React.ChangeEvent<HTMLInputElement>) {
            const file = e.target.files?.[0];
            if(!file) return;
    
            setUploading(true);
            try{
                const formData = new FormData();
                formData.append("file",file);
                const result = await apiUpload(`/api/upload`,formData);
                setPendingFile(result);
            }
            catch(err) {
                alert((err as Error).message);
            }
            finally{
                setUploading(false);
                e.target.value = ''
            }
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
                <div>
                    <p className="font-medium">{otherUser?.username || 'Loading...'}</p>
                    {otherUser && (
                        <p className="text-xs text-[#6C7883]">
                        {onlineUsers.has(otherUser.id) ? 'online' : 'offline'}
                        </p>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
                {messages.map((msg) => {
                    const isOwn = msg.sender.id === currentUser?.id;
                    return(
                        <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mt-0.5`}>
                            <div className={`max-w-[65%] px-3 py-2 rounded-2xl text-sm leading-snug ${
                    isOwn ? 'bg-[#2B5278] rounded-br-md' : 'bg-[#182533] rounded-bl-md'
                    }`}>
                            <AttachmentView msg={msg}/>
                            <p className="wrap-break-words">{msg.content}</p>
                            <p className="text-[10px] text-[#8FA3AD] text-right mt-1">{formatTime(msg.createdAt)}</p>
                            </div>
                        </div>
                    )
                })}

                {typingUser.size > 0 && (
                <div className="flex items-center gap-2 mt-2">
                    <div className="w-9" />
                    <div className="bg-[#182533] rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6C7883] animate-bounce" />
                    </div>
                </div>
                )}

                <div ref={messagesEndRef}></div>
            </div>

            {pendingFile && (
                 <div className="flex items-center gap-2 px-4 py-2 bg-[#17212B] border-t border-black/30">
                <FileIcon size={16} className="text-[#3390EC]" />
                <span className="text-sm truncate flex-1">{pendingFile.fileName}</span>
                <button onClick={() => setPendingFile(null)} className="text-[#6C7883] hover:text-white">
                    <X size={16} />
                </button>
                </div>
            )}

            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 px-4 py-3 bg-[#17212B] border-t border-black/30 shrink-0"
            >
                <input
                    className='hidden'
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />
                <button
                    type='button'
                    onClick={()=> fileInputRef?.current?.click()}
                    disabled={uploading}
                    className='text-[#6C7883] hover:text-white transition-colors shrink-0'
                    aria-label='Attach file'
                >
                    <Paperclip size={20}/>
                </button>
                <input
                    className="flex-1 bg-[#242F3D] text-[#E9EDF0] placeholder-[#6C7883] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Message"
                />
                <button
                    type="submit"
                    disabled={!input.trim() && !pendingFile}
                    className="w-10 h-10 rounded-full bg-[#3390EC] disabled:bg-[#242F3D] disabled:text-[#6C7883] flex items-center justify-center text-white transition-colors shrink-0"
                    aria-label="Send message"
                >
                    <Send size={18} />
                </button>
            </form>
        </main>
    )
}