'use client';

import { useState } from 'react';
import { SmilePlus } from 'lucide-react';
import type { Reaction } from '../types/chat';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
}

export default function ReactionBar({ reactions, currentUserId, onReact }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Group reactions by emoji -> count + whether the current user reacted with it
  const grouped = new Map<string, { count: number; mine: boolean }>();
  reactions.forEach((r) => {
    const entry = grouped.get(r.emoji) || { count: 0, mine: false };
    entry.count++;
    if (r.userId === currentUserId) entry.mine = true;
    grouped.set(r.emoji, entry);
  });

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1 relative">
      {Array.from(grouped.entries()).map(([emoji, { count, mine }]) => (
        <button
          key={emoji}
          onClick={() => onReact(emoji)}
          className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 border transition-colors ${
            mine ? 'bg-[#3390EC]/20 border-[#3390EC]' : 'bg-black/20 border-transparent hover:border-[#6C7883]'
          }`}
        >
          <span>{emoji}</span>
          <span className="text-[#8FA3AD]">{count}</span>
        </button>
      ))}

      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="text-[#6C7883] hover:text-white p-0.5"
          aria-label="Add reaction"
        >
          <SmilePlus size={14} />
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full mb-1 right-0 bg-[#242F3D] rounded-full px-2 py-1 flex gap-1 shadow-lg z-10 whitespace-nowrap">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji);
                  setPickerOpen(false);
                }}
                className="hover:scale-125 transition-transform text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}