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
import messagesRoutes from './routes/messages';
import { parseCookie } from "cookie";
import path from 'path';
import userRoutes from './routes/users';
import conversationRoutes from './routes/conversation';
import uploadRoutes from './routes/uploads'

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
app.use("/api/messages", messagesRoutes);
app.use('/api/users', userRoutes);
app.use("/api/conversations", conversationRoutes)
app.use("/api/upload",uploadRoutes)

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
    const user = await prisma.user.findUnique({
        where: {id: socket.userId},
        select: {username: true}
    });
    socket.data.username = user?.username || "Someone";

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

    socket.on("message:send", async (data: {content?: string, fileType?:string, fileName?:string, fileSize?:number,fileUrl?:string})=> {
        const {content,fileName,fileSize,fileType,fileUrl} = data;
        if (!content?.trim() && !fileUrl) return;

        const message = await prisma.message.create({
            data:{
                content,
                fileName,
                fileUrl,
                fileSize,
                fileType,
                authorId: socket.userId!,
            },
            include: {
                author: { select: {id: true, username:true,avatarUrl:true}}
            }
        });

        io.emit("message:new", message);
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

    socket.on("dm:send",async (data : {conversationId:string,content?:string,fileName?:string,fileUrl?:string,fileType?:string,fileSize?:number})=>{
        const {conversationId,content,fileName,fileSize,fileType,fileUrl} = data
        if(!content?.trim() && fileUrl) return;

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
                sender:{select:{id:true,username:true,avatarUrl:true}}
            }
        });

        io.to(conversationId).emit("dm:new",message);
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