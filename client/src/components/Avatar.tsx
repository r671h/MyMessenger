'use client';

import { colorForName } from '../lib/avatarColors';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  online?: boolean;
  size?: number;
}

export default function Avatar({ name, avatarUrl, online, size = 36 }: AvatarProps) {
  const dimension = `${size}px`;

  const content = avatarUrl ? (
    <img
      src={`http://localhost:4000${avatarUrl}`}
      alt={name}
      className="rounded-full object-cover"
      style={{ width: dimension, height: dimension }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center text-white font-medium shrink-0"
      style={{ width: dimension, height: dimension, backgroundColor: colorForName(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );

  if (!online) return content;

  return (
    <div className="relative shrink-0" style={{ width: dimension, height: dimension }}>
      {content}
      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#4FCE5D] border-2 border-[#0E1621]" />
    </div>
  );
}