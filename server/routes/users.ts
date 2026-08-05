import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { prisma } from '../prismaClient';
import { uploadToStorage } from '../lib/storage';

const router = Router();

// Configure where/how uploaded avatars are stored
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

// GET current user's full profile (already covered by /api/auth/me, but let's add bio/avatar)
// UPDATE own profile (bio)
router.patch('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const { bio } = req.body;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { bio },
    select: { id: true, email: true, username: true, bio: true, avatarUrl: true },
  });

  res.json(user);
});

// UPLOAD avatar
router.post(
  '/me/avatar',
  requireAuth,
  upload.single('avatar'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const avatarUrl = await uploadToStorage(req.file.buffer, 'avatars');

      const user = await prisma.user.update({
        where: { id: req.userId },
        data: { avatarUrl },
        select: { id: true, email: true, username: true, bio: true, avatarUrl: true },
      });

      res.json(user);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      res.status(500).json({ error: (err as Error).message || 'Upload failed' });
    }
  }
);

// GET any user's public profile by id
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.params.id as string;
    const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, bio: true, avatarUrl: true, createdAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

// LIST all users (for browsing) - excludes yourself
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where: { id: { not: req.userId } },
    select: { id: true, username: true, bio: true, avatarUrl: true },
    orderBy: { username: 'asc' },
  });

  res.json(users);
});

// SEARCH users by username
router.get('/search/:query', requireAuth, async (req: AuthRequest, res: Response) => {
    const searchQuery = req.params.query as string;
    const users = await prisma.user.findMany({
    where: {
      username: { contains: searchQuery },
      id: { not: req.userId },
    },
    select: { id: true, username: true, bio: true, avatarUrl: true },
    take: 20,
  });

  res.json(users);
});

export default router;