'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../src/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(() => router.replace('/messages'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0E1621]">
      <div className="w-8 h-8 border-2 border-[#3390EC] border-t-transparent rounded-full animate-spin" />
    </main>
  );
}