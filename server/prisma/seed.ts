/**
 * Demo data for local development: three users, a direct chat and a group chat.
 * Run with `npm run db:seed` (or `docker compose exec server npm run db:seed`).
 * Safe to run repeatedly — existing demo users are reused.
 */
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'demo1234';
const DEMO_USERS = [
  { username: 'alice', email: 'alice@demo.local', bio: 'Frontend dev. Coffee first.' },
  { username: 'bob', email: 'bob@demo.local', bio: 'Backend & databases' },
  { username: 'carol', email: 'carol@demo.local', bio: 'Design, UX, cats' },
];

async function main() {
  const password = await bcrypt.hash(DEMO_PASSWORD, 10);
  const [alice, bob, carol] = await Promise.all(
    DEMO_USERS.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: {},
        create: { ...u, password },
      })
    )
  );

  const hasDm = await prisma.conversation.findFirst({
    where: { AND: [{ participants: { some: { userId: alice.id } } }, { participants: { some: { userId: bob.id } } }] },
  });
  if (!hasDm) {
    const dm = await prisma.conversation.create({
      data: { participants: { create: [{ userId: alice.id }, { userId: bob.id }] } },
    });
    const lines: [string, string][] = [
      [bob.id, 'Hey! Did the deploy go through?'],
      [alice.id, 'Yep, both services are green 🚀'],
      [bob.id, 'Nice. Can you check the typing indicator on mobile?'],
      [alice.id, 'On it — will report back in a few minutes'],
    ];
    for (const [senderId, content] of lines) {
      await prisma.directMessage.create({ data: { conversationId: dm.id, senderId, content } });
    }
  }

  const hasGroup = await prisma.groupChat.findFirst({ where: { name: 'Weekend project', createdById: alice.id } });
  if (!hasGroup) {
    const group = await prisma.groupChat.create({
      data: {
        name: 'Weekend project',
        createdById: alice.id,
        participants: { create: [alice, bob, carol].map((u) => ({ userId: u.id })) },
      },
    });
    const welcome = await prisma.groupMessage.create({
      data: { groupChatId: group.id, senderId: alice.id, content: 'Welcome to the group! Ideas for the weekend?' },
    });
    await prisma.groupMessage.create({
      data: { groupChatId: group.id, senderId: carol.id, content: 'A tiny chat app? 😄', replyToId: welcome.id },
    });
    await prisma.groupMessageReaction.create({ data: { messageId: welcome.id, userId: bob.id, emoji: '🔥' } });
  }

  console.log(`Seeded demo users: ${DEMO_USERS.map((u) => u.email).join(', ')} (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
