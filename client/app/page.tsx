'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/src/lib/api';

export default function Home() {
  const [status,setStatus] = useState<string>('checking...');
  const router = useRouter();

  useEffect(() => {
    router.push('/register');
    fetch(`${getApiUrl()}/api/health`)
      .then((res) =>res.json())
      .then((data: { status: string }) => setStatus(data.status))
      .catch(() => setStatus('Server not reachable'));
    router.push('/register');
  }, []);

  return(
    <main className="flex min-h-hscreen flex-col items-center justify-center">
      <h1 className="text-2xl">Backend status: {status}</h1>
    </main>
  )
}