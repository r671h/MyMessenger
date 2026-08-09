const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function apiFetch(path: string, options: RequestInit = {}){
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type' : 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok){
        const data = await res.json().catch(()=>({}));
        throw new Error(data.error || 'Something went wrong');
    }

    return res.json();
}

export async function apiUpload(path: string, formData: FormData) {
    const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        credentials: 'include',
        body: formData
    });

    if(!res.ok){
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong');
    }

    return res.json();
}

export function formatFileSize(bytes:number){
    if(bytes < 1024) return `${bytes} B`;
    if(bytes < 1024 * 1024) return `${bytes/1024} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getApiUrl() {
  return API_URL;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null; 
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}