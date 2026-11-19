import { config } from './config'; // loads .env and validates required variables first
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createApp } from './app';
import { createCorsOptions } from './lib/cors';
import { setIo } from './lib/realtime';
import { usingCloudinary } from './lib/storage';
import { registerSocketHandlers } from './socket';
import { prisma } from './prismaClient';

const corsOptions = createCorsOptions(config.allowedOrigins);
const app = createApp(corsOptions);
const httpServer = createServer(app);

const io = new Server(httpServer, { cors: corsOptions });
setIo(io);
registerSocketHandlers(io);

httpServer.listen(config.port, () => {
  console.log(`API + Socket.IO listening on port ${config.port}`);
  console.log(`Allowed origins: ${config.allowedOrigins.join(', ')}`);
  console.log(`File storage: ${usingCloudinary ? 'Cloudinary' : 'local disk (./uploads)'}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  io.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
