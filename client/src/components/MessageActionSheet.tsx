'use client';

import { createPortal } from 'react-dom';
import { Reply, Pencil, Trash2, Copy } from 'lucide-react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const MENU_WIDTH = 200;
const REACTION_ROW_HEIGHT = 42;
const MENU_ESTIMATED_HEIGHT = 180; // rough max height of the action list below

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
  // The sheet only opens after a user gesture, so we're always in the browser when anchor is set.
  if (!anchor || typeof document === 'undefined') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const left = Math.min(Math.max(anchor.x - MENU_WIDTH / 2, 12), vw - MENU_WIDTH - 12);

  // Does the menu + reaction row fit below the tap point? If not, flip above.
  const spaceBelow = vh - anchor.y;
  const neededBelow = REACTION_ROW_HEIGHT + 8 + MENU_ESTIMATED_HEIGHT;
  const showBelow = spaceBelow > neededBelow;

  let reactionTop: number;
  let menuTop: number;

  if (showBelow) {
    reactionTop = anchor.y + 8;
    menuTop = reactionTop + REACTION_ROW_HEIGHT + 8;
  } else {
    // Stack upward from the tap point, then clamp so nothing goes above the viewport
    menuTop = Math.max(anchor.y - 14 - MENU_ESTIMATED_HEIGHT, 12);
    reactionTop = Math.max(menuTop - REACTION_ROW_HEIGHT - 8, 12);
  }

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />

      <div
        className="absolute flex gap-1 bg-[#242F3D] rounded-full px-2 py-1.5 shadow-xl"
        style={{ left, width: MENU_WIDTH, top: reactionTop }}
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
        className="absolute bg-[#242F3D] rounded-xl shadow-xl overflow-hidden"
        style={{ left, width: MENU_WIDTH, top: menuTop }}
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