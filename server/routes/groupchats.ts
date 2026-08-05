import {Router,Response} from "express";
import {prisma} from "../prismaClient";
import {requireAuth,AuthRequest} from "../middleware/auth";
import multer from "multer";
import path from "path";
import { uploadToStorage } from "../lib/storage";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

//create group chat
router.post('/',requireAuth, upload.single('avatar'),async (req: AuthRequest,res:Response) => {
    const { name, memberIds } = req.body;
    const parsedMemberIds = memberIds ? JSON.parse(memberIds) : [];

    if(!name?.trim()) return res.status(400).json({error: "Group name is required"});

    const avatarUrl = req.file ? await uploadToStorage(req.file.buffer, 'group-avatars') : null;

    const allMemberIds = Array.from(new Set([req.userId!, ...parsedMemberIds]));

    const group = await prisma.groupChat.create({
        data: {
            name: name.trim(),
            avatarUrl,
            createdById: req.userId!,
            createdAt: new Date(),
            participants: {
                create: allMemberIds.map((userId) => ({userId}))
            }
        }
    })

    res.status(201).json({id: group.id});
});

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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
      const myParticipant = group.participants.find((p) => p.userId === req.userId);
      const lastMessage = group.messages[0] || null;
      const unread =
        !!lastMessage &&
        myParticipant !== undefined &&
        new Date(lastMessage.createdAt) > new Date(myParticipant.lastReadAt);

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
  } catch (err) {
    console.error('Error in GET /api/groupchats:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;

  const group = await prisma.groupChat.findUnique({
    where: { id: groupId },
    include: {
      participants: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
    },
  });

  if (!group) return res.status(404).json({ error: 'Group not found' });

  const isMember = group.participants.some((p) => p.userId === req.userId);
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  res.json(group);
});

// GET message history for a group
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;

  const isMember = await prisma.groupChatParticipant.findUnique({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
  });
  if (!isMember) return res.status(403).json({ error: 'Not a member of this group' });

  const messages = await prisma.groupMessage.findMany({
    where: { groupChatId: groupId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      reactions: true,
    },
  });

  res.json(messages);
});

router.get('/:id/read-status', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;

  const participants = await prisma.groupChatParticipant.findMany({
    where: { groupChatId: groupId },
    select: { userId: true, lastReadAt: true },
  });

  res.json(participants);
});

// LEAVE a group (any member, including yourself)
router.post('/:id/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;

  await prisma.groupChatParticipant.delete({
    where: { groupChatId_userId: { groupChatId: groupId, userId: req.userId! } },
  });

  res.json({ success: true });
});

// REMOVE a specific member (creator only)
router.delete('/:id/members/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;
  const targetUserId = req.params.userId as string;

  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can remove members' });
  }

  await prisma.groupChatParticipant.delete({
    where: { groupChatId_userId: { groupChatId: groupId, userId: targetUserId } },
  });

  res.json({ success: true });
});

// DELETE an entire group (creator only)
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const groupId = req.params.id as string;

  const group = await prisma.groupChat.findUnique({ where: { id: groupId } });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  if (group.createdById !== req.userId) {
    return res.status(403).json({ error: 'Only the group creator can delete the group' });
  }

  await prisma.$transaction([
    prisma.groupMessageReaction.deleteMany({ where: { message: { groupChatId: groupId } } }),
    prisma.groupMessage.deleteMany({ where: { groupChatId: groupId } }),
    prisma.groupChatParticipant.deleteMany({ where: { groupChatId: groupId } }),
    prisma.groupChat.delete({ where: { id: groupId } }),
  ]);

  res.json({ success: true });
});

export default router;