import { prisma } from '../prismaClient';

/**
 * Direct messages and group messages live in separate tables but behave identically
 * (send / edit / delete / react / read). Each adapter maps the shared socket logic
 * onto its own Prisma models and event names.
 */
export interface NewMessageInput {
  chatId: string;
  senderId: string;
  content: string | null;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  replyToId: string | null;
}

export interface ChatAdapter {
  /** Prefix for emitted events: `${prefix}:new`, `${prefix}:updated`, ... */
  eventPrefix: 'dm' | 'groupchat';
  /** Key the client uses to tell chats apart (`conversationId` / `groupChatId`). */
  chatIdKey: 'conversationId' | 'groupChatId';
  isMember(chatId: string, userId: string): Promise<boolean>;
  memberIds(chatId: string): Promise<string[]>;
  /** Returns the message only if it belongs to the given chat. */
  messageInChat(messageId: string, chatId: string): Promise<boolean>;
  findMessage(messageId: string): Promise<{ chatId: string; senderId: string; deletedAt: Date | null } | null>;
  createMessage(input: NewMessageInput): Promise<object>;
  editMessage(messageId: string, content: string): Promise<object>;
  deleteMessage(messageId: string): Promise<object>;
  toggleReaction(messageId: string, userId: string, emoji: string): Promise<object[]>;
  markRead(chatId: string, userId: string, at: Date): Promise<void>;
  /** Hook that runs after a message is sent (e.g. un-hide a DM for both sides). */
  afterSend?(chatId: string): Promise<void>;
}

const messageInclude = {
  sender: { select: { id: true, username: true, avatarUrl: true } },
  reactions: true,
} as const;

const replyInclude = { include: { sender: { select: { id: true, username: true } } } } as const;

const clearedMessage = {
  content: null,
  fileUrl: null,
  fileName: null,
  fileType: null,
  fileSize: null,
};

export const dmAdapter: ChatAdapter = {
  eventPrefix: 'dm',
  chatIdKey: 'conversationId',

  async isMember(conversationId, userId) {
    const p = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    return p !== null;
  },

  async memberIds(conversationId) {
    const rows = await prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },

  async messageInChat(messageId, conversationId) {
    const count = await prisma.directMessage.count({ where: { id: messageId, conversationId } });
    return count > 0;
  },

  async findMessage(id) {
    const m = await prisma.directMessage.findUnique({ where: { id } });
    return m && { chatId: m.conversationId, senderId: m.senderId, deletedAt: m.deletedAt };
  },

  createMessage({ chatId, ...data }) {
    return prisma.directMessage.create({
      data: { ...data, conversationId: chatId },
      include: { ...messageInclude, replyTo: replyInclude },
    });
  },

  editMessage(id, content) {
    return prisma.directMessage.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: { ...messageInclude, replyTo: replyInclude },
    });
  },

  deleteMessage(id) {
    return prisma.directMessage.update({
      where: { id },
      data: { ...clearedMessage, deletedAt: new Date() },
      include: { ...messageInclude, replyTo: replyInclude },
    });
  },

  async toggleReaction(messageId, userId, emoji) {
    const existing = await prisma.directMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing) {
      await prisma.directMessageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.directMessageReaction.create({ data: { messageId, userId, emoji } });
    }
    return prisma.directMessageReaction.findMany({ where: { messageId } });
  },

  async markRead(conversationId, userId, at) {
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: at },
    });
  },

  async afterSend(conversationId) {
    // A new message brings a hidden ("deleted for me") conversation back into both lists.
    await prisma.conversationParticipant.updateMany({
      where: { conversationId, hiddenAt: { not: null } },
      data: { hiddenAt: null },
    });
  },
};

export const groupAdapter: ChatAdapter = {
  eventPrefix: 'groupchat',
  chatIdKey: 'groupChatId',

  async isMember(groupChatId, userId) {
    const p = await prisma.groupChatParticipant.findUnique({
      where: { groupChatId_userId: { groupChatId, userId } },
    });
    return p !== null;
  },

  async memberIds(groupChatId) {
    const rows = await prisma.groupChatParticipant.findMany({
      where: { groupChatId },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },

  async messageInChat(messageId, groupChatId) {
    const count = await prisma.groupMessage.count({ where: { id: messageId, groupChatId } });
    return count > 0;
  },

  async findMessage(id) {
    const m = await prisma.groupMessage.findUnique({ where: { id } });
    return m && { chatId: m.groupChatId, senderId: m.senderId, deletedAt: m.deletedAt };
  },

  createMessage({ chatId, ...data }) {
    return prisma.groupMessage.create({
      data: { ...data, groupChatId: chatId },
      include: { ...messageInclude, replyTo: replyInclude },
    });
  },

  editMessage(id, content) {
    return prisma.groupMessage.update({
      where: { id },
      data: { content, editedAt: new Date() },
      include: { ...messageInclude, replyTo: replyInclude },
    });
  },

  deleteMessage(id) {
    return prisma.groupMessage.update({
      where: { id },
      data: { ...clearedMessage, deletedAt: new Date() },
      include: { ...messageInclude, replyTo: replyInclude },
    });
  },

  async toggleReaction(messageId, userId, emoji) {
    const existing = await prisma.groupMessageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });
    if (existing) {
      await prisma.groupMessageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.groupMessageReaction.create({ data: { messageId, userId, emoji } });
    }
    return prisma.groupMessageReaction.findMany({ where: { messageId } });
  },

  async markRead(groupChatId, userId, at) {
    await prisma.groupChatParticipant.update({
      where: { groupChatId_userId: { groupChatId, userId } },
      data: { lastReadAt: at },
    });
  },
};
