'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HeartPulse, User, Lock, AlertCircle, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { registerUser } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const rules = [
    { label: 'Username: 6–12 characters', ok: username.length >= 6 && username.length <= 12 },
    { label: 'Password: 5–12 characters', ok: password.length >= 5 && password.length <= 12 },
    { label: 'Passwords match', ok: password.length > 0 && password === confirm },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Username and password are required.'); return; }
    if (username.length < 6 || username.length > 12) { setError('Username must be between 6 and 12 characters.'); return; }
    if (password.length < 5 || password.length > 12) { setError('Password must be between 5 and 12 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await registerUser(username, password, firstName.trim(), middleName.trim(), lastName.trim());
      router.push('/dashboard');
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } | string; status?: number } };
      if (axiosError?.response?.status === 409) {
        setError('Username already exists.');
      } else if (axiosError?.response?.status === 400) {
        const data = axiosError?.response?.data;
        if (typeof data === 'string') {
          setError(data);
        } else if (data?.errors) {
          const msgs = Object.values(data.errors).flat().join(' ');
          setError(msgs || 'Validation failed. Check your inputs.');
        } else {
          setError(data?.message || 'Invalid input. Username: 6–12 chars, Password: 5–12 chars.');
        }
      } else {
        setError('Registration failed. Please try again.');
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
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'var(--foreground)', letterSpacing:'-0.5px' }}>
              Create an account
            </h1>
            <p style={{ marginTop:6, fontSize:14, color:'var(--muted)' }}>
              Register as a patient to access MediBook services
            </p>
          </div>

          {error && (
            <div className="alert alert-error">
              <AlertCircle size={15} style={{ flexShrink:0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Username</label>
              <div className="form-input-icon">
                <User size={15} className="input-icon" />
                <input
                  type="text"
                  className="form-input"
                  placeholder="6–12 characters"
                  value={username}
                  maxLength={12}
                  onChange={(e) => setUsername(e.target.value)}
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  suppressHydrationWarning
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Middle Name <span style={{ fontWeight:400, color:'var(--muted)', fontSize:11 }}>(optional)</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Middle name or initial"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                suppressHydrationWarning
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="form-input-icon">
                <Lock size={15} className="input-icon" />
                <input
                  type="password"
                  className="form-input"
                  placeholder="5–12 characters"
                  value={password}
                  maxLength={12}
                  onChange={(e) => setPassword(e.target.value)}
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="form-input-icon">
                <Lock size={15} className="input-icon" />
                <input
                  type="password"
                  className="form-input"
                  placeholder="Repeat your password"
                  value={confirm}
                  maxLength={12}
                  onChange={(e) => setConfirm(e.target.value)}
                  suppressHydrationWarning
                />
              </div>
            </div>

            {/* Password strength */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {rules.map((r) => (
                <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color: r.ok ? 'var(--success)' : 'var(--muted)' }}>
                  <Check size={12} style={{ opacity: r.ok ? 1 : 0.3 }} />
                  {r.label}
                </div>
              ))}
            </div>

            <div style={{ padding:'12px 14px', borderRadius:'var(--radius)', background:'var(--accent)', fontSize:12.5, color:'var(--muted)', border:'1px solid var(--accent-border)' }}>
              🏥 You will be registered as a <strong>Patient</strong>. To register as a Doctor or Admin, contact your hospital administrator.
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full">
              {loading ? <span className="spinner" style={{width:16, height:16, borderWidth:2}} /> : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:20, fontSize:13.5, color:'var(--muted)' }}>
            Already have an account?{' '}
            <Link href="/login" style={{ color:'var(--primary)', fontWeight:600 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
