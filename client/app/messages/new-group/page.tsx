'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, Camera } from 'lucide-react';
import { apiFetch, apiUpload } from '../../../src/lib/api';
import Avatar from '../../../src/components/Avatar';

interface UserSummary {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export default function NewGroupPage() {
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch('/api/users').then(setAllUsers);
  }, []);

  function toggleUser(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    if (selectedIds.size === 0) {
      setError('Select at least one member');
      return;
    }

    setCreating(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('name', groupName.trim());
      formData.append('memberIds', JSON.stringify(Array.from(selectedIds)));
      if (avatarFile) formData.append('avatar', avatarFile);

      const group = await apiUpload('/api/groupchats', formData);
      router.push(`/messages/group/${group.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col bg-[#0E1621] text-[#E9EDF0] overflow-y-auto">
      <header className="flex items-center justify-between px-6 py-4 border-b border-black/30">
        <h1 className="text-lg font-semibold">New Group</h1>
        <button
          onClick={() => router.push('/messages')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-[#6C7883] hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </header>

      <div className="p-6 flex flex-col gap-6 max-w-md">
        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-4">
          <div
            className="relative w-16 h-16 rounded-full bg-[#182533] flex items-center justify-center cursor-pointer border-2 border-dashed border-[#3390EC] overflow-hidden shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
            ) : (
              <Camera size={22} className="text-[#3390EC]" />
            )}
          </div>
          <input
            className="flex-1 bg-[#242F3D] rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#3390EC]"
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarPick} />
        </div>

        <div>
          <p className="text-sm text-[#6C7883] mb-2">
            Add members {selectedIds.size > 0 && `(${selectedIds.size} selected)`}
          </p>
          <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
            {allUsers.map((user) => {
              const isSelected = selectedIds.has(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                    isSelected ? 'bg-[#2B5278]' : 'hover:bg-[#182533]'
                  }`}
                >
                  <Avatar name={user.username} avatarUrl={user.avatarUrl} size={36} />
                  <span className="flex-1 font-medium">{user.username}</span>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-[#3390EC] border-[#3390EC]' : 'border-[#6C7883]'
                    }`}
                  >
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-[#3390EC] text-white rounded-lg py-2.5 font-medium disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Group'}
        </button>
      </div>
    </main>
  );
}