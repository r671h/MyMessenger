'use client'

import {useState} from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../src/lib/api';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [username,setUsername] = useState('');
    const [password,setPassword] = useState('');
    const [error,setError] = useState('');
    const router = useRouter();

    async function handleSubmit(e : React.FormEvent) {
        e.preventDefault();
        setError('');
        try{
            await apiFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({email,username,password})
            });
            router.push('/messages');
        }
        catch (err: any) {
            setError(err.message);
        }
    }

    return(
        <main className="flex min-h-screen items-center justify-center">
            <form onSubmit={handleSubmit} className="flex w-80 flex-col gap-3">
                <h1 className="text-2xl font-bold">Login</h1>
                {error && <p className="text-red-500">{error}</p>}
                <input
                className="border rounded p-2"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                />
                <input
                className="border rounded p-2"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                />
                <button className="bg-blue-600 text-white rounded p-2" type="submit">
                Login
                </button>
            </form>
        </main>
    )
}