'use client';

import { useRef, useState } from 'react';
import { Pencil, Trash2, Check, X, Reply } from 'lucide-react';
import { colorForName } from '../lib/avatarColors';
import AttachmentView from './AttachmentView';
import Avatar from './Avatar';
import ReactionBar from './ReactionBar';
import MessageActionSheet from './MessageActionSheet';
import type { ChatMessage } from '../types/chat';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const SWIPE_TRIGGER_DISTANCE = 60;
const SWIPE_MAX_DISTANCE = 80;
const LONG_PRESS_MS = 450;

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
  const [sheetAnchor, setSheetAnchor] = useState<{ x: number; y: number } | null>(null);


  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const swipeLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const isDeleted = !!msg.deletedAt;

  function saveEdit() {
    if (editValue.trim() && editValue !== msg.content) {
      onEdit?.(msg.id, editValue.trim());
    }
    setIsEditing(false);
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (isDeleted) return;
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    swipeLocked.current = null;
    setSwiping(true);

    longPressTimer.current = setTimeout(() => {
      setSheetAnchor({ x: touch.clientX, y: touch.clientY });
      setDragX(0);
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;

    if (swipeLocked.current === null && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
      swipeLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
      // Any real movement cancels the long-press — it's a scroll or a swipe, not a hold
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    }

    if (swipeLocked.current === 'horizontal') {
      e.preventDefault();
      const clamped = Math.max(0, Math.min(deltaX, SWIPE_MAX_DISTANCE));
      setDragX(clamped);
    }
  }

  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
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
        <div className={`px-3 py-2 rounded-2xl text-sm leading-snug select-none md:select-text ${isOwn ? 'bg-[#2B5278] rounded-br-md' : 'bg-[#182533] rounded-bl-md'}`}>
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

        {/* Desktop-only hover controls — mobile relies on swipe + long-press instead */}
        {!isDeleted && !isEditing && (
          <div className="hidden md:flex absolute -bottom-5 right-0 items-center gap-0.5 bg-[#242F3D] rounded-full px-1 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onReply?.(msg)}
              className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3AD] hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Reply"
            >
              <Reply size={13} />
            </button>
            {isOwn && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3AD] hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Edit message"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onDelete?.(msg.id)}
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#8FA3AD] hover:text-red-400 hover:bg-white/10 transition-colors"
                  aria-label="Delete message"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {sheetAnchor && (
        <MessageActionSheet
          isOwn={isOwn}
          hasText={!!msg.content}
          onClose={() => setSheetAnchor(null)}
          onReact={(emoji) => onReact?.(msg.id, emoji)}
          onReply={() => onReply?.(msg)}
          onEdit={isOwn ? () => setIsEditing(true) : undefined}
          onDelete={isOwn ? () => onDelete?.(msg.id) : undefined}
          onCopy={msg.content ? () => navigator.clipboard.writeText(msg.content!) : undefined}
          anchor={sheetAnchor}
        />
      )}
    </div>
  );
}