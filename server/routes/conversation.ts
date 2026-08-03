import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../prismaClient';

const router = Router();



router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    console.log('GET /api/conversations hit, userId:', req.userId);

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: req.userId } },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const shaped = conversations.map((conv) => {
      const myParticipant = conv.participants.find((p) => p.userId === req.userId);
      const other = conv.participants.find((p) => p.userId !== req.userId)?.user;
      const lastMessage = conv.messages[0] || null;

      const unread =
        !!lastMessage &&
        myParticipant !== undefined &&
        new Date(lastMessage.createdAt) > new Date(myParticipant.lastReadAt);
      return {
        id: conv.id,
        otherUser: other,
        lastMessage,
        unread,
      };
    });

    res.json(shaped);
  } catch (err) {
    console.error('Error in GET /api/conversations:', err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
    const { userId: otherUserId } = req.body;

    if (!otherUserId || otherUserId === req.userId) {
        return res.status(400).json({ error: 'Invalid user' });
    }

    // Check if a conversation between these two already exists
    const existing = await prisma.conversation.findFirst({
        where: {
        AND: [
            { participants: { some: { userId: req.userId } } },
            { participants: { some: { userId: otherUserId } } },
        ],
        },
    });

    if (existing) {
        return res.json({ id: existing.id });
    }

    const conversation = await prisma.conversation.create({
        data: {
        participants: {
            create: [{ userId: req.userId! }, { userId: otherUserId }],
        },
        },
    });

    res.status(201).json({ id: conversation.id });
});

router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  const conversationId = req.params.id as string;

  const isParticipant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: req.userId! } },
  });

  if (!isParticipant) {
    return res.status(403).json({ error: 'Not a participant in this conversation' });
  }

  const messages = await prisma.directMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: { select: { id: true, username: true, avatarUrl: true } },
      reactions: true,
    },
  });

  res.json(messages);
});

router.post('/:id/read',requireAuth, async(req:AuthRequest,res:Response) => {
  const conversationId = req.params.id as string;

  await prisma.conversationParticipant.update({
    where:{
      conversationId_userId:{conversationId, userId: req.userId!}
    },
    data:{lastReadAt: new Date()}
  });

  res.json({success:true})
});

router.get('/:id/read-status',requireAuth, async(req:AuthRequest,res:Response) => {
  const conversationId = req.params.id as string;

  const otherParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId: { not:req.userId }
    },
    select: {lastReadAt: true}
  });

  if(!otherParticipant){
    return res.status(404).json({error: 'Conversation not found'});
  }

  res.json({otherLastReadAt:otherParticipant.lastReadAt})
})

export default router;