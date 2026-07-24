import {Router, Response} from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../prismaClient';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
    const messages = await prisma.message.findMany({
        orderBy: {createdAt: 'asc'},
        include: {
            author: {select: {id:true, username: true, avatarUrl:true}}
        },
        take: 50
    });

    res.json(messages);
});

export default router;

