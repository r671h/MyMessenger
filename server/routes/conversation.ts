import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../prismaClient';

const router = Router();

const userPreview = { select: { id: true, username: true, avatarUrl: true } } as const;

async function getMembership(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

// LIST my direct conversations (hidden ones excluded) with last message + unread flag
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: req.userId, hiddenAt: null } },
    },
    include: {
      participants: { include: { user: userPreview } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });

  const shaped = conversations.map((conv) => {
    const me = conv.participants.find((p) => p.userId === req.userId);
    const other = conv.participants.find((p) => p.userId !== req.userId)?.user;
    const lastMessage = conv.messages[0] || null;
    const unread =
      !!lastMessage &&
      lastMessage.senderId !== req.userId &&
      me !== undefined &&
      lastMessage.createdAt > me.lastReadAt;

    return { id: conv.id, otherUser: other, lastMessage, unread };
  });

  res.json(shaped);
});

// START (or reopen) a conversation with another user
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { userId: otherUserId } = req.body ?? {};

  if (typeof otherUserId !== 'string' || !otherUserId || otherUserId === req.userId) {
    return res.status(400).json({ error: 'Invalid user' });
  }

  const otherUser = await prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
  if (!otherUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: req.userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
    },
  });

  if (existing) {
    // If I previously hid this chat, starting it again brings it back.
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId: existing.id, userId: req.userId! } },
      data: { hiddenAt: null },
    });
    return res.json({ id: existing.id });
  }

  const conversation = await prisma.conversation.create({
    data: {
      participants: { create: [{ userId: req.userId! }, { userId: otherUserId }] },
    },
  });

  res.status(201).json({ id: conversation.id });
});

// GET a single conversation (used by the chat header)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id as string;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: userPreview } } },
  });

  if (!conversation || !conversation.participants.some((p) => p.userId === req.userId)) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const other = conversation.participants.find((p) => p.userId !== req.userId);
  res.json({
    id: conversation.id,
    otherUser: other?.user ?? null,
    otherLastReadAt: other?.lastReadAt ?? null,
  });
});

// GET message history
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id as string;

  if (!(await getMembership(conversationId, req.userId!))) {
    return res.status(403).json({ error: 'Not a participant in this conversation' });
  }

  const messages = await prisma.directMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: userPreview,
      reactions: true,
      replyTo: { include: { sender: { select: { id: true, username: true } } } },
    },
  });

  res.json(messages);
});

// MARK as read
router.post('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id as string;

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: req.userId! } },
    data: { lastReadAt: new Date() },
  });

  res.json({ success: true });
});

// When did the other participant last read the chat (for ✓✓ receipts)
router.get('/:id/read-status', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id as string;

  if (!(await getMembership(conversationId, req.userId!))) {
    return res.status(404).json({ error: 'Conversation not found' });
  }

  const otherParticipant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId: { not: req.userId } },
    select: { lastReadAt: true },
  });

  res.json({ otherLastReadAt: otherParticipant?.lastReadAt ?? null });
});

// HIDE a conversation from my list ("delete chat" for me only)
router.post('/:id/hide', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id as string;

  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: req.userId! } },
    data: { hiddenAt: new Date() },
  });

  res.json({ success: true });
});

export default router;
