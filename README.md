MyMessanger
https://my-messanger-xi.vercel.app/

A real-time messaging web app with direct messages, group chats, file/image/video sharing, reactions, replies, typing indicators, and online presence — built with Next.js, Express, Socket.IO, and PostgreSQL (Prisma).

Features
Authentication — email/password registration and login with JWT stored in an HTTP-only cookie
Direct messages — 1:1 conversations with edit, delete, reply, and emoji reactions
Group chats — create groups with multiple members, group avatars, and management (add/remove members, delete group)
Real-time messaging — instant delivery via WebSockets (Socket.IO), no polling
Typing indicators — see when someone is typing
Online presence — live online/offline status for users
Read receipts — per-conversation and per-group "last read" tracking
File & media sharing — images, videos, PDFs, Office docs, zip files, and more, uploaded to Cloudinary
Message reactions — emoji reactions on both direct and group messages
Message replies — quote/reply to a specific message in a thread
User profiles — bio and avatar upload
Tech Stack

Client

Next.js 16 (App Router) + React 19 + TypeScript
Tailwind CSS 4
Socket.IO client
Lucide icons

Server

Node.js + Express 5 + TypeScript
Socket.IO for real-time events
Prisma ORM + PostgreSQL
JWT authentication (jsonwebtoken) with bcrypt password hashing
Multer for multipart uploads, Cloudinary for file storage
Project Structure
MyMessanger/
├── client/                 # Next.js frontend
│   ├── app/                 # App Router pages (login, register, messages, profile...)
│   └── src/
│       ├── components/      # Chat UI: message bubbles, chat input, avatars, skeletons...
│       ├── lib/              # API client, socket helpers
│       └── types/            # Shared TypeScript types
└── server/                 # Express backend
    ├── index.ts             # App entry point + Socket.IO event handlers
    ├── routes/               # REST endpoints (auth, users, conversations, groupchats, uploads)
    ├── middleware/            # Auth middleware
    ├── lib/                   # Cloudinary storage helper
    └── prisma/                # Prisma schema and migrations
Getting Started
Prerequisites
Node.js 18+
A PostgreSQL database
A Cloudinary account (for file/image/video uploads)
1. Clone the repository
bash
git clone https://github.com/<your-username>/MyMessanger.git
cd MyMessanger
2. Set up the server
bash
cd server
npm install

Create a .env file in server/ with:

env
DATABASE_URL="postgresql://user:password@localhost:5432/mymessanger"
JWT_SECRET="your-secret-key"
FRONTEND_URL="http://localhost:3000"
PORT=4000

CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

Run database migrations and generate the Prisma client:

bash
npx prisma migrate deploy
npx prisma generate

Start the server in development mode:

bash
npm run dev

The API will be available at http://localhost:4000.

3. Set up the client

In a new terminal:

bash
cd client
npm install

Create a .env.local file in client/ with the server URL your frontend should talk to (check src/lib/api.ts for the expected variable name), e.g.:

env
NEXT_PUBLIC_API_URL="http://localhost:4000"

Start the frontend:

bash
npm run dev

The app will be available at http://localhost:3000.

Available Scripts

Server (server/package.json)

Command	Description
npm run dev	Start the API with hot-reload (nodemon + tsx)
npm run build	Compile TypeScript to dist/
npm start	Run the compiled server

Client (client/package.json)

Command	Description
npm run dev	Start Next.js in development mode
npm run build	Build for production
npm start	Serve the production build
npm run lint	Run ESLint
API Overview
Route prefix	Purpose
/api/auth	Register, login, logout, current user (/me)
/api/users	Profile updates, avatar upload
/api/conversations	Direct-message conversations and message history
/api/groupchats	Create/manage group chats and members
/api/upload	General file uploads (chat attachments)
/api/health	Health check

Real-time features (new messages, edits, deletes, reactions, typing, presence, read receipts) are handled over Socket.IO rather than REST — see server/index.ts for the full list of socket events.

Database

The schema (server/prisma/schema.prisma) defines:

User — accounts, profile info
Conversation / ConversationParticipant / DirectMessage / DirectMessageReaction — 1:1 chats
GroupChat / GroupChatParticipant / GroupMessage / GroupMessageReaction — group chats
Support for message replies via self-relations on DirectMessage and GroupMessage

Run npx prisma studio from server/ to browse the database visually.
