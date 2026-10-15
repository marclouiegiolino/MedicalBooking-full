'use client';
import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Settings, User, LogOut, ChevronDown, CheckCheck, X, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import Avatar from '@/components/ui/Avatar';
import { ROLES } from '@/lib/types';

const TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  appointment:    { bg: '#dbeafe', fg: '#1e40af' },
  medical_request:{ bg: '#ede9fe', fg: '#6d28d9' },
  lab_result:     { bg: '#d1fae5', fg: '#065f46' },
  announcement:   { bg: '#fef3c7', fg: '#92400e' },
};
const defaultColor = { bg: '#f1f5f9', fg: '#64748b' };

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface TopBarProps { sidebarCollapsed: boolean; }

export default function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, dismiss } = useNotifications();
  const [dropOpen, setDropOpen]   = useState(false);
  const [bellOpen, setBellOpen]   = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'U';
  const isAdmin  = user?.roleId === ROLES.ADMIN;
  const recent   = notifications.slice(0, 5);

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <header className={`app-topbar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Search */}
      <div className="topbar-search">
        <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
        <input placeholder="Search patients, doctors, appointments…" suppressHydrationWarning />
      </div>

      {/* Actions */}
      <div className="topbar-actions">

        {/* ── Bell with live dropdown ── */}
        <div style={{ position: 'relative' }} ref={bellRef}>
          <button
            className="topbar-icon-btn"
            onClick={() => setBellOpen((v) => !v)}
            aria-label="Notifications"
            style={{ position: 'relative' }}
            suppressHydrationWarning
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--primary)',
                boxShadow: '0 0 0 2px var(--topbar-bg, #fff)',
              }} />
            )}
          </button>

          {bellOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 10px)', right: 0,
              width: 360, background: 'var(--card)', border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
              zIndex: 200, overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px 10px', borderBottom: '1px solid var(--card-border)',
              }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>
                  Notifications {unreadCount > 0 && (
                    <span style={{
                      marginLeft: 6, padding: '2px 7px', borderRadius: 99,
                      background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 600,
                    }}>{unreadCount}</span>
                  )}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {unreadCount > 0 && (
                    <button
                      onClick={() => { markAllAsRead(); }}
                      title="Mark all as read"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11.5, color: 'var(--primary)', fontWeight: 600,
                        background: 'none', border: 'none', cursor: 'pointer', padding: '3px 6px',
                        borderRadius: 6,
                      }}
                    >
                      <CheckCheck size={13} /> Mark all read
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {recent.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                    <Bell size={22} style={{ marginBottom: 8, opacity: 0.4 }} />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  recent.map((n) => {
                    const color = TYPE_COLORS[n.notificationType] ?? defaultColor;
                    return (
                      <div
                        key={n.notificationId}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '12px 16px',
                          background: n.isRead ? 'transparent' : 'var(--accent, #f8fafc)',
                          borderBottom: '1px solid var(--card-border)',
                          transition: 'background 0.15s',
                          cursor: 'default',
                        }}
                      >
                        {/* Type dot */}
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: color.fg, marginTop: 5,
                        }} />

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <p style={{
                              fontSize: 13, fontWeight: n.isRead ? 500 : 700,
                              color: 'var(--foreground)', lineHeight: 1.4, margin: 0,
                            }}>{n.title}</p>
                            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {relativeTime(n.createdAt)}
                            </span>
                          </div>
                          <p style={{
                            fontSize: 12, color: 'var(--muted)',
                            marginTop: 3, lineHeight: 1.5, overflow: 'hidden',
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          }}>{n.message}</p>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                          {!n.isRead && (
                            <button
                              onClick={() => markAsRead(n.notificationId)}
                              title="Mark as read"
                              style={{
                                width: 22, height: 22, border: 'none',
                                background: 'var(--accent)', borderRadius: 4,
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <CheckCheck size={11} style={{ color: 'var(--primary)' }} />
                            </button>
                          )}
                          <button
                            onClick={() => dismiss(n.notificationId)}
                            title="Dismiss"
                            style={{
                              width: 22, height: 22, border: 'none',
                              background: 'transparent', borderRadius: 4,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <X size={11} style={{ color: 'var(--muted)' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div style={{
                padding: '10px 16px',
                borderTop: '1px solid var(--card-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <Link
                  href="/notifications"
                  style={{ fontSize: 12.5, color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}
                  onClick={() => setBellOpen(false)}
                >
                  View all notifications →
                </Link>
                {isAdmin && (
                  <Link
                    href="/notifications?broadcast=1"
                    style={{
                      fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                      color: 'var(--muted)', textDecoration: 'none',
                    }}
                    onClick={() => setBellOpen(false)}
                  >
                    <Megaphone size={12} /> Broadcast
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        <Link href="/settings" className="topbar-icon-btn">
          <Settings size={18} />
        </Link>

        {/* User dropdown */}
        <div className="dropdown" ref={dropRef}>
          <button
            className="flex items-center gap-2"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            onClick={() => setDropOpen((v) => !v)}
            suppressHydrationWarning
          >
            <Avatar initials={initials} src={user?.profilePicturePath} size="sm" />
            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              {user?.username ?? 'User'}
            </span>
            <ChevronDown size={14} style={{ color: 'var(--muted)' }} />
          </button>

          {dropOpen && (
            <div className="dropdown-menu">
              <Link href="/profile" className="dropdown-item" onClick={() => setDropOpen(false)}>
                <User size={15} /> Profile
              </Link>
              <Link href="/settings" className="dropdown-item" onClick={() => setDropOpen(false)}>
                <Settings size={15} /> Settings
              </Link>
              <div className="dropdown-divider" />
              <button
                className="dropdown-item danger"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => { setDropOpen(false); logout(); }}
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

