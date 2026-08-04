'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, apiUpload, getApiUrl } from '@/src/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((data: User) => {
        setUser(data);
        setBio(data.bio || '');
      })
      .catch(() => router.push('/login'));
  }, [router]);

  async function handleSaveBio(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ bio }),
      });
      setUser(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const updated = await apiUpload('/api/users/me/avatar', formData);
      setUser(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0E1621] text-[#E9EDF0]">
        Loading...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#0E1621] text-[#E9EDF0] p-6">
      <div className="w-full max-w-md flex flex-col gap-6 mt-10">
        <h1 className="text-2xl font-bold">Your Profile</h1>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-24 h-24 rounded-full bg-[#182533] flex items-center justify-center overflow-hidden cursor-pointer border-2 border-[#3390EC]"
            onClick={() => fileInputRef.current?.click()}
          >
            {user.avatarUrl ? (
              <img
                src={`${getApiUrl()}${user.avatarUrl}`}
                alt="Avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold">
                {user.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-sm text-[#3390EC]"
          >
            {uploading ? 'Uploading...' : 'Change photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        {/* Info */}
        <div className="bg-[#17212B] rounded-xl p-4 flex flex-col gap-1">
          <p className="text-lg font-medium">{user.username}</p>
          <p className="text-sm text-[#6C7883]">{user.email}</p>
        </div>

        {/* Bio editor */}
        <form onSubmit={handleSaveBio} className="flex flex-col gap-2">
          <label className="text-sm text-[#6C7883]">Bio</label>
          <textarea
            className="bg-[#182533] rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-[#3390EC] resize-none"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-[#3390EC] text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save bio'}
          </button>
        </form>

        <button
          onClick={() => router.push('/messages')}
          className="text-sm text-[#6C7883] hover:text-white"
        >
          ← Back to messages
        </button>
      </div>
    </main>
  );
}