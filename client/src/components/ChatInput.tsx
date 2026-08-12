'use client';

import { useRef, useState, useEffect } from 'react';
import { Send, Paperclip, X, File as FileIcon, Reply } from 'lucide-react';
import { apiUpload } from '../lib/api';
import type { Attachment, ChatMessage } from '../types/chat';

interface ChatInputProps {
  onSend: (content: string | undefined, attachment: Attachment | null, replyToId: string | null) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  replyTarget?: ChatMessage | null;
  onCancelReply?: () => void;
}

export default function ChatInput({ onSend, onTypingStart, onTypingStop, replyTarget, onCancelReply }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [pendingFile, setPendingFile] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  // Focus the text field automatically when a reply target is set — matches Telegram's feel
  useEffect(() => {
    if (replyTarget) textInputRef.current?.focus();
  }, [replyTarget]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value);
    onTypingStart?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onTypingStop?.(), 1500);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiUpload('/api/upload', formData);
      setPendingFile(result);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !pendingFile) return;
    onSend(input.trim() || undefined, pendingFile, replyTarget?.id || null);
    onCancelReply?.();
    onTypingStop?.();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setInput('');
    setPendingFile(null);
  }

  return (
    <>
      {replyTarget && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#17212B] border-t border-black/30">
          <Reply size={16} className="text-[#3390EC] shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[#3390EC]">Replying to {replyTarget.sender.username}</p>
            <p className="text-xs text-[#8FA3AD] truncate">
              {replyTarget.content || (replyTarget.fileName ? `📎 ${replyTarget.fileName}` : 'Message')}
            </p>
          </div>
          <button onClick={onCancelReply} className="text-[#6C7883] hover:text-white shrink-0">
            <X size={16} />
          </button>
        </div>
      )}

      {pendingFile && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[#17212B] border-t border-black/30">
          <FileIcon size={16} className="text-[#3390EC]" />
          <span className="text-sm truncate flex-1">{pendingFile.fileName}</span>
          <button onClick={() => setPendingFile(null)} className="text-[#6C7883] hover:text-white">
            <X size={16} />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-4 py-3 bg-[#17212B] border-t border-black/30 shrink-0">
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-[#6C7883] hover:text-white transition-colors shrink-0"
          aria-label="Attach file"
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={textInputRef}
          className="flex-1 bg-[#242F3D] text-[#E9EDF0] placeholder-[#6C7883] rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
          value={input}
          onChange={handleInputChange}
          placeholder={uploading ? 'Uploading...' : 'Message'}
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
    </>
  );
}