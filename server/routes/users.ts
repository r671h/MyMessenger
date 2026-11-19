import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../prismaClient';
import { uploadToStorage } from '../lib/storage';
import { imageUpload } from '../lib/imageUpload';
import { MAX_BIO_LENGTH } from '../lib/validation';

const router = Router();

const ownProfileSelect = { id: true, email: true, username: true, bio: true, avatarUrl: true } as const;
const publicProfileSelect = { id: true, username: true, bio: true, avatarUrl: true } as const;

// UPDATE own profile (bio)
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { bio } = req.body ?? {};
  if (bio !== null && typeof bio !== 'string') {
    return res.status(400).json({ error: 'Bio must be a string' });
  }
  if (typeof bio === 'string' && bio.length > MAX_BIO_LENGTH) {
    return res.status(400).json({ error: `Bio must be at most ${MAX_BIO_LENGTH} characters` });
  }

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { bio: bio?.trim() || null },
    select: ownProfileSelect,
  });

  res.json(user);
});

// UPLOAD avatar
router.post('/me/avatar', requireAuth, imageUpload.single('avatar'), async (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const avatarUrl = await uploadToStorage(req.file.buffer, 'avatars', req.file.originalname);
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl },
    select: ownProfileSelect,
  });

  res.json(user);
});

// SEARCH users by username (case-insensitive). Declared before /:id for readability.
router.get('/search/:query', requireAuth, async (req: AuthRequest, res: Response) => {
  const searchQuery = (req.params.query as string).trim().slice(0, 64);
  if (!searchQuery) return res.json([]);

  const users = await prisma.user.findMany({
    where: {
      username: { contains: searchQuery, mode: 'insensitive' },
      id: { not: req.userId },
    },
    select: publicProfileSelect,
    orderBy: { username: 'asc' },
    take: 20,
  });

  res.json(users);
});

// GET any user's public profile by id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id as string },
    select: { ...publicProfileSelect, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// LIST users (for browsing) - excludes yourself
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { id: { not: req.userId } },
    select: publicProfileSelect,
    orderBy: { username: 'asc' },
    take: 100,
  });

  res.json(users);
});

export default router;
