'use client';
import { useState } from 'react';
import Link from 'next/link';
import { HeartPulse, Mail, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) { setError('Please enter your username.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authApi.forgotPassword({ username });
      setSent(true);
      if (res.data?.resetToken) setResetToken(res.data.resetToken);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } | string; status?: number } };
      const data = axiosError?.response?.data;
      if (typeof data === 'string') {
        setError(data);
      } else {
        setError(data?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand-icon"><HeartPulse size={22} /></div>
          <span className="auth-brand-name">MediBook</span>
        </div>

        <div className="auth-card">
          <Link href="/login" style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, color:'var(--muted)', marginBottom:20 }}>
            <ChevronLeft size={15} /> Back to login
          </Link>

          {!sent ? (
            <>
              <div style={{ marginBottom:24 }}>
                <h1 style={{ fontSize:22, fontWeight:700, color:'var(--foreground)' }}>Forgot password</h1>
                <p style={{ marginTop:6, fontSize:14, color:'var(--muted)' }}>
                  Enter your username and we&apos;ll generate a reset token.
                </p>
              </div>

              {error && (
                <div className="alert alert-error">
                  <AlertCircle size={15} style={{ flexShrink:0 }} />{error}
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
                      placeholder="Your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
                  {loading ? <span className="spinner" style={{width:16, height:16, borderWidth:2}} /> : null}
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'12px 0' }}>
              <div style={{ width:60, height:60, borderRadius:'50%', background:'var(--success-bg)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                <CheckCircle size={28} style={{ color:'var(--success)' }} />
              </div>
              <h2 style={{ fontSize:18, fontWeight:700, color:'var(--foreground)' }}>Check your account</h2>
              <p style={{ fontSize:14, color:'var(--muted)', marginTop:8 }}>
                If this username exists, a reset token has been generated.
              </p>
              {resetToken && (
                <div style={{ marginTop:16, padding:'12px 16px', background:'var(--accent)', borderRadius:'var(--radius)', border:'1px solid var(--accent-border)', fontSize:12, wordBreak:'break-all', textAlign:'left' }}>
                  <p style={{ fontWeight:600, color:'var(--foreground)', marginBottom:4 }}>Dev mode — Reset Token:</p>
                  <p style={{ color:'var(--muted)', fontFamily:'monospace' }}>{resetToken}</p>
                </div>
              )}
              <Link href="/reset-password" className="btn btn-primary btn-md" style={{ marginTop:20, display:'inline-flex' }}>
                Reset password
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
