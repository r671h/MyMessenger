'use client';

import type { Reaction } from '../types/chat';

interface ReactionBarProps {
  reactions: Reaction[];
  currentUserId: string;
  onReact: (emoji: string) => void;
}

export default function ReactionBar({ reactions, currentUserId, onReact }: ReactionBarProps) {
  if (reactions.length === 0) return null;

  const grouped = new Map<string, { count: number; mine: boolean }>();
  reactions.forEach((r) => {
    const entry = grouped.get(r.emoji) || { count: 0, mine: false };
    entry.count++;
    if (r.userId === currentUserId) entry.mine = true;
    grouped.set(r.emoji, entry);
  });

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
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
    </div>
  );
}