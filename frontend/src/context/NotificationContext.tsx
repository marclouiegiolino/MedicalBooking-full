'use client';

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from 'react';
import { notificationApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Notification } from '@/lib/types';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => void;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

const POLL_INTERVAL_MS = 30_000; // 30 s

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [nRes, cRes] = await Promise.all([
        notificationApi.getMy(),
        notificationApi.getUnreadCount(),
      ]);
      setNotifications(Array.isArray(nRes.data) ? nRes.data : []);
      setUnreadCount(cRes.data?.unreadCount ?? cRes.data?.unread_count ?? 0);
    } catch {
      // silently ignore — polling will retry
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch + start polling when logged in
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchAll();
    intervalRef.current = setInterval(fetchAll, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchAll]);

  const markAsRead = useCallback(async (id: number) => {
    await notificationApi.markAsRead(id).catch(() => {});
    setNotifications((prev) =>
      prev.map((n) => n.notificationId === id ? { ...n, isRead: true } : n)
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllAsRead = useCallback(async () => {
    await notificationApi.markAllAsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const dismiss = useCallback(async (id: number) => {
    await notificationApi.dismiss(id).catch(() => {});
    setNotifications((prev) => {
      const removed = prev.find((n) => n.notificationId === id);
      const next = prev.filter((n) => n.notificationId !== id);
      if (removed && !removed.isRead) setUnreadCount((c) => Math.max(0, c - 1));
      return next;
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, loading, refresh: fetchAll, markAsRead, markAllAsRead, dismiss }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be inside <NotificationProvider>');
  return ctx;
}
