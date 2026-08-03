import express, {Request,Response} from "express";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth";
import cookie from "cookie";
import {Server} from "socket.io";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { prisma } from "./prismaClient";
import { parseCookie } from "cookie";
import path from 'path';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversation';
import uploadRoutes from './routes/uploads';
import groupChatRoutes from './routes/groupchats';

const PORT = process.env.PORT || 4000;
const app = express();
const httpServer = createServer(app);
const onlineUsers = new Map<string,number>();

const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        credentials: true
    }
});

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use("/api/auth", authRoutes);
app.use('/api/users', userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/upload",uploadRoutes);
app.use("/api/groupchats", groupChatRoutes);

app.get("/api/health", (req: Request, res: Response) => {
    res.json({status: "ok"});
})

const JWT_SECRET = process.env.JWT_SECRET as string;

declare module 'socket.io' {
    interface Socket {
        userId?: string;
    }
};

io.use((socket, next) => {
    try {
    const rawCookie = socket.handshake.headers.cookie || '';

    const cookies = parseCookie(rawCookie);
    const token = cookies.token;

    if (!token) {
      return next(new Error('Not authenticated'));
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Not authenticated'));
  }
});

io.on("connection", async (socket)=> {
    
    socket.join(`user:${socket.userId}`);

    prisma.user.findUnique({
        where: { id: socket.userId },
        select: { username: true },
    }).then((user) => {
        socket.data.username = user?.username || "Someone";
    });

    const currentCount =  onlineUsers.get(socket.userId!) || 0;
    onlineUsers.set(socket.userId!, currentCount + 1);
    if(currentCount === 0) {
        socket.broadcast.emit("presence:update", {userId: socket.userId, online: true});
    }
    socket.emit("presence:list", Array.from(onlineUsers.keys()));
    
    console.log("User connected: "+ socket.userId);

    socket.on("typing:start", () => {
        socket.broadcast.emit("typing:update", {userId: socket.userId,username: socket.data.username, typing:true})
    });
    socket.on("typing:stop",()=>{
        socket.broadcast.emit("typing:update", {userId: socket.userId, typing:false})
    });

    socket.on("groupchat:send", async (data: { groupChatId: string; content?: string; fileName?: string; fileUrl?: string; fileType?: string; fileSize?: number }) => {
        try {
            const { groupChatId, content, fileName, fileSize, fileType, fileUrl } = data;
            if (!content?.trim() && !fileUrl) return;

            const isParticipant = await prisma.groupChatParticipant.findUnique({
            where: { groupChatId_userId: { groupChatId, userId: socket.userId! } },
            });
            if (!isParticipant) return;

            const message = await prisma.groupMessage.create({
            data: {
                content: content || null,
                fileUrl, fileName, fileType, fileSize,
                groupChatId,
                senderId: socket.userId!,
            },
            include: {
                sender: { select: { id: true, username: true, avatarUrl: true } },
                reactions: true,
            },
            });

            const members = await prisma.groupChatParticipant.findMany({
            where: { groupChatId },
            select: { userId: true },
            });

            members.forEach((m) => {
            io.to(`user:${m.userId}`).emit("groupchat:new", { ...message, groupChatId });
            });
        } catch (err) {
            console.error("Error in groupchat:send handler:", err);
        }
    });

    socket.on("groupchat:read", async (groupChatId: string) => {
        try {
            if (!groupChatId) return; // guard against missing/malformed calls

            const isMember = await prisma.groupChatParticipant.findUnique({
            where: { groupChatId_userId: { groupChatId, userId: socket.userId! } },
            });
            if (!isMember) return;

            const now = new Date();
            await prisma.groupChatParticipant.update({
            where: { groupChatId_userId: { groupChatId, userId: socket.userId! } },
            data: { lastReadAt: now },
            });

            const members = await prisma.groupChatParticipant.findMany({
            where: { groupChatId },
            select: { userId: true },
            });

            members
            .filter((m) => m.userId !== socket.userId)
            .forEach((m) => {
                io.to(`user:${m.userId}`).emit("groupchat:read-update", { groupChatId, userId: socket.userId, readAt: now });
            });
        } catch (err) {
            console.error("Error in groupchat:read handler:", err);
        }
        });

    socket.on("conversation:join",async (conversationId:string)=>{
        const isParticipant = await prisma.conversationParticipant.findUnique({
            where:{
                conversationId_userId:{conversationId, userId:socket.userId!}
            }
        });

        if(!isParticipant) {
            return socket.emit('error',"Not authorized for this conversation");
        }

        socket.join(conversationId);
    });

    socket.on("conversation:leave",(conversationId:string)=>{
        socket.leave(conversationId);
    })

    socket.on("conversation:read", async (conversationId:string) => {
        const isParticipant = await prisma.conversationParticipant.findUnique({
            where: {conversationId_userId:{conversationId,userId: socket.userId!}}
        });
        if(!isParticipant) return;

        const now = new Date();

        await prisma.conversationParticipant.update({
            where:{conversationId_userId:{conversationId,userId:socket.userId!}},
            data:{lastReadAt:now}
        });

        const participants = await prisma.conversationParticipant.findMany({
            where:{conversationId},
            select:{userId:true}
        });

        participants
            .filter((p) => p.userId !== socket.userId)
            .forEach((p) => {
                io.to(`user:${p.userId}`).emit('conversation:read-update', {
                    conversationId,
                    readedId: socket.userId,
                    readAt: now
                });
            });
    });

    socket.on("dm:send",async (data : {conversationId:string,content?:string,fileName?:string,fileUrl?:string,fileType?:string,fileSize?:number})=>{
        const {conversationId,content,fileName,fileSize,fileType,fileUrl} = data
        if(!content?.trim() && !fileUrl) {
            return;
        }

        const isParticipant = await prisma.conversationParticipant.findUnique({
            where:{
                conversationId_userId:{conversationId:conversationId,userId:socket.userId!}
            }
        });

        if(!isParticipant) return;

        const message = await prisma.directMessage.create({
            data:{
                content,
                fileName,
                fileSize,
                fileType,
                fileUrl,
                conversationId,
                senderId: socket.userId!
            },
            include:{
                sender:{select:{id:true,username:true,avatarUrl:true}},
                reactions: true,
            }
        });

        const participants = await prisma.conversationParticipant.findMany(
            {
                where:{conversationId},
                select:{userId:true}
            }
        )

        participants.forEach((p)=>{
            io.to(`user:${p.userId}`).emit("dm:new",{...message, conversationId});
        })
    });

    socket.on("dm:edit", async ({ messageId, content }: { messageId: string; content: string }) => {
        try {
            if (!content?.trim()) return;

            const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
            if (!message || message.senderId !== socket.userId) return; // only the sender can edit

            const updated = await prisma.directMessage.update({
            where: { id: messageId },
            data: { content, editedAt: new Date() },
            include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
            });

            const participants = await prisma.conversationParticipant.findMany({
                where: { conversationId: message.conversationId },
                select: { userId: true },
                });
                participants.forEach((p) => {
                io.to(`user:${p.userId}`).emit("dm:updated", { ...updated, conversationId: message.conversationId });
            });
        } catch (err) {
            console.error("Error in dm:edit handler:", err);
        }
        });

        socket.on("dm:delete", async ({ messageId }: { messageId: string }) => {
        try {
            const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
            if (!message || message.senderId !== socket.userId) return;

            const updated = await prisma.directMessage.update({
            where: { id: messageId },
            data: { content: null, fileUrl: null, fileName: null, fileType: null, fileSize: null, deletedAt: new Date() },
            include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
            });

            const participants = await prisma.conversationParticipant.findMany({
            where: { conversationId: message.conversationId },
            select: { userId: true },
            });
            participants.forEach((p) => {
            io.to(`user:${p.userId}`).emit("dm:updated", { ...updated, conversationId: message.conversationId });
            });
        } catch (err) {
            console.error("Error in dm:delete handler:", err);
        }
        });

        socket.on("groupchat:edit", async ({ messageId, content }: { messageId: string; content: string }) => {
        try {
            if (!content?.trim()) return;

            const message = await prisma.groupMessage.findUnique({ where: { id: messageId } });
            if (!message || message.senderId !== socket.userId) return;

            const updated = await prisma.groupMessage.update({
            where: { id: messageId },
            data: { content, editedAt: new Date() },
            include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
            });

            const members = await prisma.groupChatParticipant.findMany({
            where: { groupChatId: message.groupChatId },
            select: { userId: true },
            });
            members.forEach((m) => {
            io.to(`user:${m.userId}`).emit("groupchat:updated", { ...updated, groupChatId: message.groupChatId });
            });
        } catch (err) {
            console.error("Error in groupchat:edit handler:", err);
        }
        });

        socket.on("groupchat:delete", async ({ messageId }: { messageId: string }) => {
        try {
            const message = await prisma.groupMessage.findUnique({ where: { id: messageId } });
            if (!message || message.senderId !== socket.userId) return;

            const updated = await prisma.groupMessage.update({
            where: { id: messageId },
            data: { content: null, fileUrl: null, fileName: null, fileType: null, fileSize: null, deletedAt: new Date() },
            include: { sender: { select: { id: true, username: true, avatarUrl: true } } },
            });

            const members = await prisma.groupChatParticipant.findMany({
            where: { groupChatId: message.groupChatId },
            select: { userId: true },
            });
            members.forEach((m) => {
            io.to(`user:${m.userId}`).emit("groupchat:updated", { ...updated, groupChatId: message.groupChatId });
            });
        } catch (err) {
            console.error("Error in groupchat:delete handler:", err);
        }
    });

    socket.on("dm:react", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
        try {
            const message = await prisma.directMessage.findUnique({ where: { id: messageId } });
            if (!message) return;

            const existing = await prisma.directMessageReaction.findUnique({
            where: { messageId_userId_emoji: { messageId, userId: socket.userId!, emoji } },
            });

            if (existing) {
            await prisma.directMessageReaction.delete({ where: { id: existing.id } });
            } else {
            await prisma.directMessageReaction.create({
                data: { messageId, userId: socket.userId!, emoji },
            });
            }

            const reactions = await prisma.directMessageReaction.findMany({ where: { messageId } });

            const participants = await prisma.conversationParticipant.findMany({
            where: { conversationId: message.conversationId },
            select: { userId: true },
            });
            participants.forEach((p) => {
            io.to(`user:${p.userId}`).emit("dm:reactions-updated", { messageId, reactions });
            });
        } catch (err) {
            console.error("Error in dm:react handler:", err);
        }
        });

        socket.on("groupchat:react", async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
        try {
            const message = await prisma.groupMessage.findUnique({ where: { id: messageId } });
            if (!message) return;

            const existing = await prisma.groupMessageReaction.findUnique({
            where: { messageId_userId_emoji: { messageId, userId: socket.userId!, emoji } },
            });

            if (existing) {
            await prisma.groupMessageReaction.delete({ where: { id: existing.id } });
            } else {
            await prisma.groupMessageReaction.create({
                data: { messageId, userId: socket.userId!, emoji },
            });
            }

            const reactions = await prisma.groupMessageReaction.findMany({ where: { messageId } });

            const members = await prisma.groupChatParticipant.findMany({
            where: { groupChatId: message.groupChatId },
            select: { userId: true },
            });
            members.forEach((m) => {
            io.to(`user:${m.userId}`).emit("groupchat:reactions-updated", { messageId, reactions });
            });
        } catch (err) {
            console.error("Error in groupchat:react handler:", err);
        }
        });

    socket.on("disconnect",() => {
        console.log("User disconnected: " + socket.data.username);
    
        const count = (onlineUsers.get(socket.userId!) || 1) - 1;
        if(count <= 0) {
            onlineUsers.delete(socket.userId!);
            socket.broadcast.emit('presence:update', {userId:socket.userId,online:false});
        }
        else{
            onlineUsers.set(socket.userId!,count);
        }
    });
});

httpServer.listen(PORT, ()=>{
    console.log("Server is running on PORT: " + PORT);
});