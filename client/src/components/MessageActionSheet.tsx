'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Reply, Pencil, Trash2, Copy } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const MENU_WIDTH = 200;

interface MessageActionSheetProps {
  isOwn: boolean;
  hasText: boolean;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

export default function MessageActionSheet({
  isOwn, hasText, anchor, onClose, onReact, onReply, onEdit, onDelete, onCopy,
}: MessageActionSheetProps) {
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Clamp horizontally so the menu never runs off either edge
  const left = Math.min(Math.max(anchor!.x - MENU_WIDTH / 2, 12), vw - MENU_WIDTH - 12);

  // Prefer showing below the tap point; flip above if there's not enough room below
  const showBelow = anchor!.y < vh * 0.65;
  const verticalStyle = showBelow
    ? { top: anchor!.y + 14 }
    : { bottom: vh - anchor!.y + 14 };

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />

      {/* Quick reaction row, floating just above the menu */}
      <div
        className="absolute flex gap-1 bg-[#242F3D] rounded-full px-2 py-1.5 shadow-xl"
        style={{
          left,
          width: MENU_WIDTH,
          ...(showBelow ? { top: anchor!.y - 42 } : { bottom: vh - anchor!.y + 56 }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => { onReact(emoji); onClose(); }}
            className="text-lg flex-1 active:scale-90 transition-transform"
          >
            {emoji}
          </button>
        ))}
      </div>

      <div
        ref={menuRef}
        className="absolute bg-[#242F3D] rounded-xl shadow-xl overflow-hidden"
        style={{ left, width: MENU_WIDTH, ...verticalStyle }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => { onReply(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#E9EDF0] active:bg-black/20"
        >
          <Reply size={16} /> Reply
        </button>
        {hasText && onCopy && (
          <button
            onClick={() => { onCopy(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#E9EDF0] active:bg-black/20"
          >
            <Copy size={16} /> Copy
          </button>
        )}
        {isOwn && onEdit && (
          <button
            onClick={() => { onEdit(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-[#E9EDF0] active:bg-black/20"
          >
            <Pencil size={16} /> Edit
          </button>
        )}
        {isOwn && onDelete && (
          <button
            onClick={() => { onDelete(); onClose(); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-red-400 active:bg-black/20"
          >
            <Trash2 size={16} /> Delete
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}