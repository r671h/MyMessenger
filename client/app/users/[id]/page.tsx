'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { apiFetch } from '../../../src/lib/api';
import Avatar from '../../../src/components/Avatar'

interface PublicUser {
  id: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

function formatJoinDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const router = useRouter();

  const [user, setUser] = useState<PublicUser | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [startingChat, setStartingChat] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/me').then((u) => setCurrentUserId(u.id));

    apiFetch(`/api/users/${userId}`)
      .then(setUser)
      .catch(() => setNotFound(true));
  }, [userId]);

  // If you view your own profile via this route, send you to the editable version instead
  useEffect(() => {
    if (currentUserId && userId === currentUserId) {
      router.replace('/profile');
    }
  }, [currentUserId, userId, router]);

  async function handleMessage() {
    setStartingChat(true);
    try {
      const conv = await apiFetch('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });
      router.push(`/messages/dm/${conv.id}`);
    } finally {
      setStartingChat(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0E1621] text-[#E9EDF0]">
        <div className="text-center">
          <p className="text-lg mb-2">User not found</p>
          <button onClick={() => router.back()} className="text-[#3390EC] hover:underline text-sm">
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#0E1621] text-[#E9EDF0]">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-black/30">
        <button onClick={() => router.back()} className="text-[#6C7883] hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <p className="font-medium">Profile</p>
      </header>

      {!user ? (
        <div className="flex-1 flex items-center justify-center text-[#6C7883]">Loading...</div>
      ) : (
        <div className="flex flex-col items-center gap-4 p-6 mt-6">
          <Avatar name={user.username} avatarUrl={user.avatarUrl} size={96} />

          <div className="text-center">
            <h1 className="text-xl font-semibold">{user.username}</h1>
            <p className="text-sm text-[#6C7883] mt-1">Joined {formatJoinDate(user.createdAt)}</p>
          </div>

          {user.bio && (
            <div className="w-full max-w-sm bg-[#17212B] rounded-xl p-4">
              <p className="text-xs text-[#6C7883] mb-1">Bio</p>
              <p className="text-sm whitespace-pre-wrap break-words">{user.bio}</p>
            </div>
          )}

          <button
            onClick={handleMessage}
            disabled={startingChat}
            className="w-full max-w-sm bg-[#3390EC] text-white rounded-lg py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            <MessageCircle size={18} />
            {startingChat ? 'Opening...' : 'Send Message'}
          </button>
        </div>
      )}
    </main>
  );
}