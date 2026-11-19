import { Router, Response } from 'express';
import { prisma } from '../prismaClient';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { uploadToStorage } from '../lib/storage';
import { imageUpload } from '../lib/imageUpload';
import { emitToUsers } from '../lib/realtime';
import { MAX_GROUP_NAME_LENGTH, parseMemberIds } from '../lib/validation';

const router = Router();

async function isGroupMember(groupChatId: string, userId: string) {
  const membership = await prisma.groupChatParticipant.findUnique({
    where: { groupChatId_userId: { groupChatId, userId } },
  });
  return membership !== null;
}

// CREATE a group chat (optionally with an avatar)
router.post('/', requireAuth, imageUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  if (name.length > MAX_GROUP_NAME_LENGTH) {
    return res.status(400).json({ error: `Group name must be at most ${MAX_GROUP_NAME_LENGTH} characters` });
  }

  const requestedIds = Array.from(new Set([req.userId!, ...parseMemberIds(req.body?.memberIds)]));
  // Silently drop ids that don't belong to real users.
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: requestedIds } },
    select: { id: true },
  });

  const avatarUrl = req.file ? await uploadToStorage(req.file.buffer, 'group-avatars', req.file.originalname) : null;

  const group = await prisma.groupChat.create({
    data: {
      name,
      avatarUrl,
      createdById: req.userId!,
      participants: { create: existingUsers.map(({ id }) => ({ userId: id })) },
    },
  });

  res.status(201).json({ id: group.id });
});

// LIST my groups with last message + unread flag
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const groups = await prisma.groupChat.findMany({
    where: { participants: { some: { userId: req.userId } } },
    include: {
      participants: true,
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { sender: { select: { id: true, username: true } } },
      },
    },
  });

  const shaped = groups.map((group) => {
    const me = group.participants.find((p) => p.userId === req.userId);
    const lastMessage = group.messages[0] || null;
    const unread =
      !!lastMessage &&
      lastMessage.senderId !== req.userId &&
      me !== undefined &&
      lastMessage.createdAt > me.lastReadAt;

    return {
      id: group.id,
      name: group.name,
      avatarUrl: group.avatarUrl,
      memberCount: group.participants.length,
      lastMessage,
      unread,
      lastActivity: lastMessage?.createdAt || group.createdAt,
    };
  });

  res.json(shaped);
});

// GET group details + members
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const group = await prisma.groupChat.findUnique({
    where: { id: req.params.id as string },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (!group.participants.some((p) => p.userId === req.userId)) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  res.json(group);
});

// GET message history
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupChatId = req.params.id as string;
  if (!(await isGroupMember(groupChatId, req.userId!))) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  const messages = await prisma.groupMessage.findMany({
    where: { groupChatId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      reactions: true,
      replyTo: { include: { sender: { select: { id: true, username: true } } } },
    },
  });

  res.json(messages);
});

// Per-member lastReadAt (for "Seen by N")
router.get('/:id/read-status', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupChatId = req.params.id as string;
  if (!(await isGroupMember(groupChatId, req.userId!))) {
    return res.status(403).json({ error: 'Not a member of this group' });
  }

  const participants = await prisma.groupChatParticipant.findMany({
    where: { groupChatId },
    select: { userId: true, lastReadAt: true },
  });

  res.json(participants);
});

// LEAVE a group
router.post('/:id/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  await prisma.groupChatParticipant.delete({
    where: { groupChatId_userId: { groupChatId: req.params.id as string, userId: req.userId! } },
  });

  res.json({ success: true });
});

// REMOVE a member (creator only); the removed user is notified in real time
router.delete('/:id/members/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupChatId = req.params.id as string;
  const targetUserId = req.params.userId as string;

  const group = await prisma.groupChat.findUnique({ where: { id: groupChatId } });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can remove members' });
  }
  if (targetUserId === req.userId) {
    return res.status(400).json({ error: 'Use "leave" or delete the group instead' });
  }

  await prisma.groupChatParticipant.delete({
    where: { groupChatId_userId: { groupChatId, userId: targetUserId } },
  });

  emitToUsers([targetUserId], 'groupchat:removed', { groupChatId });
  res.json({ success: true });
});

// DELETE the whole group (creator only); all members are notified in real time
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupChatId = req.params.id as string;

  const group = await prisma.groupChat.findUnique({
    where: { id: groupChatId },
    include: { participants: { select: { userId: true } } },
  });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can delete the group' });
  }

  await prisma.$transaction([
    prisma.groupMessageReaction.deleteMany({ where: { message: { groupChatId } } }),
    prisma.groupMessage.deleteMany({ where: { groupChatId } }),
    prisma.groupChatParticipant.deleteMany({ where: { groupChatId } }),
    prisma.groupChat.delete({ where: { id: groupChatId } }),
  ]);

  emitToUsers(
    group.participants.map((p) => p.userId),
    'groupchat:deleted',
    { groupChatId }
  );
  res.json({ success: true });
});

export default router;
