import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversation';
import uploadRoutes from './routes/uploads';
import groupChatRoutes from './routes/groupchats';
import { errorHandler } from './middleware/error';
import { LOCAL_UPLOAD_DIR } from './lib/storage';

export function createApp(corsOptions: CorsOptions) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Vercel/ALB/Render proxies
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Files saved by the local-disk storage fallback (when Cloudinary isn't configured).
  app.use(
    '/uploads',
    express.static(LOCAL_UPLOAD_DIR, {
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  );

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/conversations', conversationRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/groupchats', groupChatRoutes);

  app.use('/api', (req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  return app;
}
