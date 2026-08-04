'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../src/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });
      router.push('/messages');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0E1621] text-[#E9EDF0] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-[#3390EC] flex items-center justify-center text-2xl font-bold mb-4">
            #
          </div>
          <h1 className="text-2xl font-semibold">Create an account</h1>
          <p className="text-sm text-[#6C7883] mt-1">Join and start messaging</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {error && (
            <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <input
            className="bg-[#182533] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#3390EC] placeholder-[#6C7883]"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            className="bg-[#182533] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#3390EC] placeholder-[#6C7883]"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="bg-[#182533] rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#3390EC] placeholder-[#6C7883]"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-[#3390EC] text-white rounded-lg py-3 font-medium mt-2 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-sm text-[#6C7883] mt-6">
          Already have an account?{' '}
          <Link href="/login" className="text-[#3390EC] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}