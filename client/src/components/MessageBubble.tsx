'use client';

import { useRef, useState } from 'react';
import { Pencil, Trash2, Check, X, Reply } from 'lucide-react';
import { colorForName } from '../lib/avatarColors';
import AttachmentView from './AttachmentView';
import Avatar from './Avatar';
import ReactionBar from './ReactionBar';
import type { ChatMessage } from '../types/chat';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SWIPE_TRIGGER_DISTANCE = 60;
const SWIPE_MAX_DISTANCE = 80;

interface MessageBubbleProps {
  msg: ChatMessage;
  isOwn: boolean;
  showAvatarAndName: boolean;
  receipt?: React.ReactNode;
  currentUserId?: string;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
  onReply?: (msg: ChatMessage) => void;
  onQuoteClick?: (messageId: string) => void;
}

export default function MessageBubble({
  msg, isOwn, showAvatarAndName, receipt, currentUserId,
  onEdit, onDelete, onReact, onReply, onQuoteClick,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content || '');
  const [dragX, setDragX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeLocked = useRef<'horizontal' | 'vertical' | null>(null);

  const isDeleted = !!msg.deletedAt;

  function saveEdit() {
    if (editValue.trim() && editValue !== msg.content) {
      onEdit?.(msg.id, editValue.trim());
    }
    setIsEditing(false);
  }

  // --- Swipe-to-reply (mobile touch gesture) ---
  function handleTouchStart(e: React.TouchEvent) {
    if (isDeleted) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeLocked.current = null;
    setSwiping(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    // Decide once whether this gesture is a horizontal swipe or a vertical scroll,
    // based on whichever direction has moved further first. This stops the reply
    // gesture from hijacking normal up/down scrolling through the message list.
    if (swipeLocked.current === null && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
      swipeLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    if (swipeLocked.current === 'horizontal') {
      e.preventDefault(); // stop the page from scrolling while actively swiping a message
      const clamped = Math.max(0, Math.min(deltaX, SWIPE_MAX_DISTANCE));
      setDragX(clamped);
    }
  }

  function handleTouchEnd() {
    if (dragX >= SWIPE_TRIGGER_DISTANCE) {
      onReply?.(msg);
    }
    setDragX(0);
    setSwiping(false);
    touchStartX.current = null;
    touchStartY.current = null;
    swipeLocked.current = null;
  }

  return (
    <div
      className={`group flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatarAndName ? 'mt-2' : 'mt-0.5'} relative`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        transform: `translateX(${dragX}px)`,
        transition: swiping ? 'none' : 'transform 0.2s ease-out',
      }}
    >
      {dragX > 0 && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full flex items-center justify-center text-[#3390EC]"
          style={{ opacity: Math.min(dragX / SWIPE_TRIGGER_DISTANCE, 1) }}
        >
          <Reply size={18} />
        </div>
      )}

      {!isOwn && (
        <div className="w-9 shrink-0">
          {showAvatarAndName && <Avatar name={msg.sender.username} avatarUrl={msg.sender.avatarUrl} size={36} />}
        </div>
      )}

      <div className="relative max-w-[65%]">
        <div className={`px-3 py-2 rounded-2xl text-sm leading-snug ${isOwn ? 'bg-[#2B5278] rounded-br-md' : 'bg-[#182533] rounded-bl-md'}`}>
          {!isOwn && showAvatarAndName && (
            <p className="text-xs font-medium mb-0.5" style={{ color: colorForName(msg.sender.username) }}>
              {msg.sender.username}
            </p>
          )}

          {msg.replyTo && !isDeleted && (
            <button
              onClick={() => onQuoteClick?.(msg.replyTo!.id)}
              className="block w-full text-left border-l-2 border-[#3390EC] bg-black/20 rounded px-2 py-1 mb-1.5 hover:bg-black/30 transition-colors"
            >
              <p className="text-xs font-medium text-[#3390EC]">{msg.replyTo.sender.username}</p>
              <p className="text-xs text-[#8FA3AD] truncate">
                {msg.replyTo.content || (msg.replyTo.fileName ? `📎 ${msg.replyTo.fileName}` : 'Message')}
              </p>
            </button>
          )}

          {isDeleted ? (
            <p className="italic text-[#8FA3AD]">This message was deleted</p>
          ) : isEditing ? (
            <div className="flex flex-col gap-1.5 min-w-45">
              <input
                autoFocus
                className="bg-black/20 rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-[#3390EC]"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="text-[#8FA3AD] hover:text-white">
                  <X size={16} />
                </button>
                <button onClick={saveEdit} className="text-[#3390EC] hover:text-white">
                  <Check size={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <AttachmentView msg={msg} />
              {msg.content && <p className="wrap-break-words">{msg.content}</p>}
            </>
          )}

          {!isEditing && (
            <p className="text-[10px] text-[#8FA3AD] text-right mt-1 flex items-center justify-end gap-1">
              {msg.editedAt && !isDeleted && <span className="italic">edited</span>}
              {formatTime(msg.createdAt)}
              {!isDeleted && receipt}
            </p>
          )}

          {!isEditing && !isDeleted && currentUserId && onReact && (
            <ReactionBar
              reactions={msg.reactions || []}
              currentUserId={currentUserId}
              onReact={(emoji) => onReact(msg.id, emoji)}
            />
          )}
        </div>

        {/* Top-right corner controls: reply always available, edit/delete only for your own messages */}
        {!isDeleted && !isEditing && (
          <div className="absolute bottom-0 right-1 flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onReply?.(msg)}
              className="w-6 h-6 rounded-full bg-[#242F3D] shadow-md flex items-center justify-center text-[#6C7883] hover:text-white"
              aria-label="Reply"
            >
              <Reply size={12} />
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-6 h-6 rounded-full bg-[#242F3D] shadow-md flex items-center justify-center text-[#6C7883] hover:text-white"
                  aria-label="Edit message"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={() => onDelete?.(msg.id)}
                  className="w-6 h-6 rounded-full bg-[#242F3D] shadow-md flex items-center justify-center text-[#6C7883] hover:text-red-400"
                  aria-label="Delete message"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}