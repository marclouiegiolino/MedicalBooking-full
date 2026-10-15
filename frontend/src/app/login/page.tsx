'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { Metadata } from 'next';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Username and password are required.'); return; }
    setLoading(true);
    try {
      await login(username, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError?.response?.data?.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      {/* Decorative blobs */}
      <div style={{
        position:'absolute', width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
        top:-100, right:-100, pointerEvents:'none'
      }} />
      <div style={{
        position:'absolute', width:300, height:300, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        bottom:-60, left:-60, pointerEvents:'none'
      }} />

      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand-icon"><HeartPulse size={22} /></div>
          <span className="auth-brand-name">MediBook</span>
        </div>

        <div className="auth-card">
          <div style={{ marginBottom: 28 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--foreground)', letterSpacing:'-0.5px' }}>
              Welcome back
            </h1>
            <p style={{ marginTop:6, fontSize:14, color:'var(--muted)' }}>
              Sign in to your MediBook account to continue
            </p>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom:16 }}>
              <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="form-input-icon">
                <Mail size={15} className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="form-input-icon">
                <Lock size={15} className="input-icon" />
                <input
                  type={showPw ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  style={{ paddingRight: 44 }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  suppressHydrationWarning
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', background:'none', border:'none', cursor:'pointer' }}
                  suppressHydrationWarning
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13 }}>
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', color:'var(--muted)' }}>
                <input type="checkbox" style={{ accentColor:'var(--primary)' }} /> Remember me
              </label>
              <Link href="/forgot-password" style={{ color:'var(--primary)', fontWeight:500 }}>
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg btn-full"
              style={{ marginTop: 8 }}
              suppressHydrationWarning
            >
              {loading ? <span className="spinner" style={{width:16, height:16, borderWidth:2}} /> : null}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:20, fontSize:13.5, color:'var(--muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" style={{ color:'var(--primary)', fontWeight:600 }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
