import { Router, Response, Request, CookieOptions } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../prismaClient';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { config, TOKEN_TTL_SECONDS } from '../config';
import { validateRegistration } from '../lib/validation';

const router = Router();

// Frontend and API live on different sites in production, so the cookie must be SameSite=None; Secure.
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'none',
  secure: true,
};

function issueSession(res: Response, userId: string) {
  const token = jwt.sign({ userId }, config.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS });
  res.cookie('token', token, { ...cookieOptions, maxAge: TOKEN_TTL_SECONDS * 1000 });
  return token;
}

router.post('/register', async (req: Request, res: Response) => {
  const { data, error } = validateRegistration(req.body);
  if (!data) {
    return res.status(400).json({ error });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: data.email, mode: 'insensitive' } },
        { username: { equals: data.username, mode: 'insensitive' } },
      ],
    },
    select: { email: true },
  });
  if (existing) {
    const field = existing.email.toLowerCase() === data.email ? 'Email' : 'Username';
    return res.status(409).json({ error: `${field} is already taken` });
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { email: data.email, username: data.username, password: hashedPassword },
  });

  const token = issueSession(res, user.id);
  res.status(201).json({ id: user.id, email: user.email, username: user.username, token });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email.trim(), mode: 'insensitive' } },
  });

  // Same response for unknown email and wrong password, so accounts can't be enumerated.
  const valid = user ? await bcrypt.compare(password, user.password) : false;
  if (!user || !valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = issueSession(res, user.id);
  res.json({ id: user.id, email: user.email, username: user.username, token });
});

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, bio: true, avatarUrl: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token', cookieOptions);
  res.json({ message: 'Logged out successfully' });
});

export default router;
