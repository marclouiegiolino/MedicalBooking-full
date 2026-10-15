'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/dashboard' : '/welcome');
    }
  }, [user, loading, router]);

  return (
    <div className="loading-page">
      <div className="spinner spinner-lg" />
      <p className="text-muted text-sm">Loading MediBook…</p>
    </div>
  );
}
