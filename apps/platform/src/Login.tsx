import { useState } from 'react';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('admin@minsk.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || 'Login failed');
      return;
    }
    onLogin(data.user);
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-surface border border-border rounded-xl p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-text mb-1">Platform Admin</h1>
        <p className="text-sm text-text-muted mb-5">Sign in to manage sites</p>

        <label className="block text-xs font-medium text-text-muted mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full h-9 px-3 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent mb-4"
        />

        <label className="block text-xs font-medium text-text-muted mb-1">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-9 px-3 border border-border rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent mb-4"
        />

        {error && <p className="text-xs text-danger mb-3">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-9 rounded text-sm font-medium text-text-inverse bg-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
