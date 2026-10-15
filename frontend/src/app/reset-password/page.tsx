'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, Lock, Key, AlertCircle, Check } from 'lucide-react';
import { authApi } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rules = [
    { label: 'At least 6 characters', ok: newPassword.length >= 6 },
    { label: 'Passwords match', ok: newPassword.length > 0 && newPassword === confirm },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newPassword) { setError('Token and new password are required.'); return; }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ token, newPassword });
      router.push('/login');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError?.response?.data?.message || 'Invalid or expired reset token.');
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
          <div style={{ marginBottom:24 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--foreground)' }}>Set new password</h1>
            <p style={{ marginTop:6, fontSize:14, color:'var(--muted)' }}>Enter your reset token and choose a new password.</p>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={15} style={{ flexShrink:0 }} />{error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Reset Token</label>
              <div className="form-input-icon">
                <Key size={15} className="input-icon" />
                <input type="text" className="form-input" placeholder="Paste your reset token"
                  value={token} onChange={(e) => setToken(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="form-input-icon">
                <Lock size={15} className="input-icon" />
                <input type="password" className="form-input" placeholder="At least 6 characters"
                  value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="form-input-icon">
                <Lock size={15} className="input-icon" />
                <input type="password" className="form-input" placeholder="Repeat password"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {rules.map((r) => (
                <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color: r.ok ? 'var(--success)' : 'var(--muted)' }}>
                  <Check size={12} style={{ opacity: r.ok ? 1 : 0.3 }} />{r.label}
                </div>
              ))}
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
              {loading ? <span className="spinner" style={{width:16, height:16, borderWidth:2}} /> : null}
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:20, fontSize:13.5, color:'var(--muted)' }}>
            Back to{' '}<Link href="/login" style={{ color:'var(--primary)', fontWeight:600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
