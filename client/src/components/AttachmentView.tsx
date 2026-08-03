'use client';

import { File as FileIcon } from 'lucide-react';
import { formatFileSize } from '../lib/api';
import type { ChatMessage } from '../types/chat';

export default function AttachmentView({ msg }: { msg: ChatMessage }) {
  if (!msg.fileUrl) return null;
  const url = `http://localhost:4000${msg.fileUrl}`;
  const isImage = msg.fileType?.startsWith('image/');

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={msg.fileName || 'attachment'}
          className="rounded-lg max-w-240 max-h-240 object-cover mb-1"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-2 mb-1 hover:bg-black/30 transition-colors"
    >
      <FileIcon size={20} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-sm truncate">{msg.fileName}</p>
        <p className="text-xs text-[#8FA3AD]">{formatFileSize(msg.fileSize || 0)}</p>
      </div>
    </a>
  );
}