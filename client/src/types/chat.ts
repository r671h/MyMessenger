export interface User {
  id: string;
  username: string;
  email?: string;
  bio?: string | null;
  avatarUrl?: string | null;
}

export interface Attachment {
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
}

export interface MessagePreview {
  content: string | null;
  createdAt: string;
  senderId?: string;
}

export interface ConversationSummary {
  id: string;
  otherUser: User;
  lastMessage: MessagePreview | null;
  unread: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  memberCount: number;
  lastMessage: MessagePreview | null;
  unread: boolean;
  lastActivity: string;
}

export interface ChatMessage {
  id: string;
  content: string | null;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  sender: User;
  reactions?: Reaction[];
  replyTo?: {
    id: string;
    content: string | null;
    fileName?: string | null;
    sender: { id: string; username: string };
  } | null;
}

