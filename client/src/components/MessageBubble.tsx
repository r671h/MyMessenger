'use client';

import { useState } from 'react';
import { Pencil, Trash2, Check, X } from 'lucide-react';
import { colorForName } from '../lib/avatarColors';
import AttachmentView from './AttachmentView';
import Avatar from './Avatar';
import type { ChatMessage } from '../types/chat';
import ReactionBar from './ReactionBar';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface MessageBubbleProps {
  msg: ChatMessage;
  isOwn: boolean;
  showAvatarAndName: boolean;
  receipt?: React.ReactNode;
  currentUserId?: string;
  onEdit?: (messageId: string, newContent: string) => void;
  onDelete?: (messageId: string) => void;
  onReact?: (messageId: string, emoji: string) => void;
}

export default function MessageBubble({ msg, isOwn, showAvatarAndName, receipt, currentUserId, onEdit, onDelete, onReact }: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content || '');

  const isDeleted = !!msg.deletedAt;

  function saveEdit() {
    if (editValue.trim() && editValue !== msg.content) {
      onEdit?.(msg.id, editValue.trim());
    }
    setIsEditing(false);
  }

  return (
    <div className={`group flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatarAndName ? 'mt-2' : 'mt-0.5'}`}>
      {!isOwn && showAvatarAndName && (
        <div className="w-9 shrink-0">
          {<Avatar name={msg.sender.username} avatarUrl={msg.sender.avatarUrl} size={36} />}
        </div>
      )}

      {isOwn && !isDeleted && !isEditing && (
        <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center">          
        <button onClick={() => setIsEditing(true)} className="text-[#6C7883] hover:text-white p-2" aria-label="Edit message">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDelete?.(msg.id)} className="text-[#6C7883] hover:text-red-400 p-1" aria-label="Delete message">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      <div className={`max-w-[65%] px-3 py-2 rounded-2xl text-sm leading-snug ${isOwn ? 'bg-[#2B5278] rounded-br-md' : 'bg-[#182533] rounded-bl-md'}`}>
        {!isOwn && showAvatarAndName && (
          <p className="text-xs font-medium mb-0.5" style={{ color: colorForName(msg.sender.username) }}>
            {msg.sender.username}
          </p>
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
          <div className="text-[10px] text-[#8FA3AD] text-right mt-1 flex items-center justify-end gap-1">
            {msg.editedAt && !isDeleted && <span className="italic">edited</span>}
            {formatTime(msg.createdAt)}
            {!isEditing && !isDeleted && currentUserId && onReact && (
              <ReactionBar
                reactions={msg.reactions || []}
                currentUserId={currentUserId}
                onReact={(emoji) => onReact(msg.id, emoji)}
              />
            )}
            {!isDeleted && receipt}
          </div>
        )}
      </div>
    </div>
  );
}