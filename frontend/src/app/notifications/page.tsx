'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Bell, CheckCheck, X, Trash2, Megaphone, Users, Send,
  ClipboardList, FlaskConical, Calendar, Info,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { useNotifications } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { notificationApi, userManApi, patientApi, doctorApi } from '@/lib/api';
import { ROLES } from '@/lib/types';
import type { Notification } from '@/lib/types';

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { icon: React.ElementType; bg: string; fg: string; label: string }> = {
  appointment:     { icon: Calendar,      bg: '#dbeafe', fg: '#1e40af', label: 'Appointment' },
  medical_request: { icon: ClipboardList, bg: '#ede9fe', fg: '#6d28d9', label: 'Medical Request' },
  lab_result:      { icon: FlaskConical,  bg: '#d1fae5', fg: '#065f46', label: 'Lab Result' },
  announcement:    { icon: Megaphone,     bg: '#fef3c7', fg: '#92400e', label: 'Announcement' },
};
const defaultCfg = { icon: Info, bg: '#f1f5f9', fg: '#64748b', label: 'System' };

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000)     return 'just now';
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface UserOption {
  userId: number;
  username: string;
  fullName: string;
  displayName: string;
  roleId: number;
  roleName: string;
}

function extractList<T = unknown>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.users)) return obj.users as T[];
    if (Array.isArray(obj.doctors)) return obj.doctors as T[];
    if (Array.isArray(obj.patients)) return obj.patients as T[];
  }
  return [];
}

// ─── Broadcast modal ──────────────────────────────────────────────────────────

function BroadcastModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'all' | 'specific'>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingUsers(true);
    setError(null);
    setSent(null);

    Promise.all([
      userManApi.getAll().catch(() => ({ data: [] })),
      doctorApi.getAll().catch(() => ({ data: [] })),
      patientApi.getAll().catch(() => ({ data: [] })),
    ])
      .then(([userRes, docRes, patRes]) => {
        const usersRaw = extractList<Record<string, unknown>>(userRes.data);
        const docsRaw = extractList<Record<string, unknown>>(docRes.data);
        const patsRaw = extractList<Record<string, unknown>>(patRes.data);

        const docMap = new Map<number, string>();
        docsRaw.forEach((d) => {
          const uid = Number(d.userId ?? d.user_id ?? 0);
          const first = String(d.firstName ?? d.first_name ?? '');
          const last = String(d.lastName ?? d.last_name ?? '');
          const name = [first, last].filter(Boolean).join(' ');
          if (uid && name) docMap.set(uid, `Dr. ${name}`);
        });

        const patMap = new Map<number, string>();
        patsRaw.forEach((p) => {
          const uid = Number(p.userId ?? p.user_id ?? 0);
          const first = String(p.firstName ?? p.first_name ?? '');
          const middle = String(p.middleName ?? p.middle_name ?? '');
          const last = String(p.lastName ?? p.last_name ?? '');
          const name = [first, middle, last].filter(Boolean).join(' ');
          if (uid && name) patMap.set(uid, name);
        });

        const list: UserOption[] = usersRaw
          .map((u) => {
            const uid = Number(u.userId ?? u.user_id ?? 0);
            const uname = String(u.userName ?? u.user_name ?? '');
            const roleId = Number(u.userRoleId ?? u.user_role_id ?? 3);
            const roleName = roleId === 1 ? 'Admin' : roleId === 2 ? 'Doctor' : 'Patient';

            let fullName = '';
            let displayName = `@${uname}`;

            if (docMap.has(uid)) {
              fullName = docMap.get(uid)!;
              displayName = `${fullName} (@${uname})`;
            } else if (patMap.has(uid)) {
              fullName = patMap.get(uid)!;
              displayName = `${fullName} (@${uname})`;
            }

            return {
              userId: uid,
              username: uname,
              fullName,
              displayName,
              roleId,
              roleName,
            };
          })
          .filter((u) => u.userId > 0);

        setAvailableUsers(list);
      })
      .catch((err) => console.error('Failed loading users for broadcast modal:', err))
      .finally(() => setLoadingUsers(false));
  }, [open]);

  const handleSelectUser = (userIdNum: number) => {
    if (!userIdNum) return;
    setSelectedUserIds((prev) => (prev.includes(userIdNum) ? prev : [...prev, userIdNum]));
  };

  const handleRemoveUser = (userIdNum: number) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userIdNum));
  };

  const handleSelectAllUsers = () => {
    setSelectedUserIds(availableUsers.map((u) => u.userId));
  };

  const handleClearSelected = () => {
    setSelectedUserIds([]);
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required.');
      return;
    }
    if (mode === 'specific' && selectedUserIds.length === 0) {
      setError('Please select at least one recipient user from the dropdown.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const payload =
        mode === 'all'
          ? { send_to_all: true, title: title.trim(), message: message.trim() }
          : {
              user_ids: selectedUserIds,
              title: title.trim(),
              message: message.trim(),
            };
      const res = await notificationApi.broadcast(payload);
      setSent(res.data?.message ?? `Announcement delivered to ${res.data?.recipients ?? (mode === 'all' ? 'all' : selectedUserIds.length)} user(s).`);
    } catch {
      setError('Failed to send broadcast. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const unselectedUsers = availableUsers.filter((u) => !selectedUserIds.includes(u.userId));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Broadcast Announcement"
      subtitle="Send instant notification to clinic users"
      maxWidth={540}
      footer={
        sent ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={sending}>
              Cancel
            </Button>
            <Button icon={Send} loading={sending} onClick={handleSend}>
              Send Broadcast
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: '#d1fae5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Send size={24} style={{ color: '#059669' }} />
          </div>
          <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--foreground)', margin: 0 }}>
            {sent}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, margin: '6px 0 0' }}>
            The notification is now visible in the recipients&apos; feed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Target Toggle */}
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)', display: 'block', marginBottom: 8 }}>
              Recipients Target
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                onClick={() => setMode('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: mode === 'all' ? '2px solid var(--primary, #2563eb)' : '1px solid var(--card-border, #e2e8f0)',
                  background: mode === 'all' ? 'rgba(37, 99, 235, 0.08)' : 'var(--card-bg, transparent)',
                  color: mode === 'all' ? 'var(--primary, #2563eb)' : 'var(--muted, #64748b)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Users size={15} />
                <span>All Users</span>
              </button>

              <button
                type="button"
                onClick={() => setMode('specific')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '9px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  border: mode === 'specific' ? '2px solid var(--primary, #2563eb)' : '1px solid var(--card-border, #e2e8f0)',
                  background: mode === 'specific' ? 'rgba(37, 99, 235, 0.08)' : 'var(--card-bg, transparent)',
                  color: mode === 'specific' ? 'var(--primary, #2563eb)' : 'var(--muted, #64748b)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <Send size={15} />
                <span>Specific Users</span>
              </button>
            </div>
          </div>

          {/* Specific Users Dropdown Picker */}
          {mode === 'specific' && (
            <div
              style={{
                background: 'var(--accent, #f8fafc)',
                border: '1px solid var(--card-border, #e2e8f0)',
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--foreground)' }}>
                  Select User by Name
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selectedUserIds.length < availableUsers.length && availableUsers.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllUsers}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary, #2563eb)',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Select All
                    </button>
                  )}
                  {selectedUserIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelected}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Dropdown list */}
              <select
                className="form-input"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: 13,
                  background: 'var(--card-bg, #ffffff)',
                }}
                value=""
                onChange={(e) => handleSelectUser(Number(e.target.value))}
                disabled={loadingUsers}
              >
                <option value="" disabled>
                  {loadingUsers ? 'Loading user list…' : '➕ Choose a user to add…'}
                </option>
                {unselectedUsers.map((u) => (
                  <option key={`opt-u-${u.userId}`} value={u.userId}>
                    {u.fullName ? `${u.fullName} (@${u.username})` : `@${u.username}`} — [{u.roleName}]
                  </option>
                ))}
                {!loadingUsers && unselectedUsers.length === 0 && (
                  <option value="" disabled>
                    All available users are already selected
                  </option>
                )}
              </select>

              {/* Selected Users Chips */}
              <div style={{ marginTop: 12 }}>
                <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Selected Recipients ({selectedUserIds.length})
                </span>

                {selectedUserIds.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', margin: '4px 0 0' }}>
                    No recipients selected yet. Choose users from the dropdown above.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
                    {selectedUserIds.map((uId) => {
                      const userObj = availableUsers.find((x) => x.userId === uId);
                      const label = userObj ? (userObj.fullName || `@${userObj.username}`) : `User #${uId}`;
                      const role = userObj?.roleName || 'User';
                      const initials = userObj?.fullName
                        ? userObj.fullName.replace('Dr. ', '').slice(0, 2).toUpperCase()
                        : userObj?.username.slice(0, 2).toUpperCase() || 'U';

                      return (
                        <div
                          key={`selected-chip-${uId}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 99,
                            background: 'var(--card-bg, #ffffff)',
                            border: '1px solid var(--card-border, #cbd5e1)',
                            fontSize: 12,
                            color: 'var(--foreground)',
                          }}
                        >
                          <Avatar initials={initials} size="sm" />
                          <span style={{ fontWeight: 600 }}>{label}</span>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: role === 'Doctor' ? '#dcfce7' : role === 'Admin' ? '#fee2e2' : '#e0f2fe',
                              color: role === 'Doctor' ? '#166534' : role === 'Admin' ? '#991b1b' : '#075985',
                              fontWeight: 700,
                            }}
                          >
                            {role}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveUser(uId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              marginLeft: 2,
                              display: 'flex',
                              alignItems: 'center',
                              color: 'var(--muted)',
                            }}
                            title="Remove recipient"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Announcement Title */}
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 600 }}>
              Announcement Title
            </label>
            <input
              className="form-input"
              placeholder="e.g. Clinic Closed for Maintenance"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Announcement Message */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                Message Content
              </label>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {message.length}/2000
              </span>
            </div>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Write your announcement message here…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              style={{ resize: 'vertical' }}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: 12.5,
                color: '#b91c1c',
                background: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                padding: '9px 12px',
                margin: 0,
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Notification Item ────────────────────────────────────────────────────────

function NotifItem({
  n, onMarkRead, onDismiss,
}: {
  n: Notification;
  onMarkRead: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  const cfg = TYPE_CONFIG[n.notificationType] ?? defaultCfg;
  const Icon = cfg.icon;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 20px',
        background: n.isRead ? 'transparent' : 'rgba(99,102,241,0.04)',
        borderBottom: '1px solid var(--card-border)',
        transition: 'background 0.2s',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 40, height: 40, borderRadius: 12, flexShrink: 0,
        background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color: cfg.fg }} />
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <p style={{
              fontSize: 14, fontWeight: n.isRead ? 500 : 700,
              color: 'var(--foreground)', margin: 0, lineHeight: 1.4,
            }}>
              {n.title}
              {!n.isRead && (
                <span style={{
                  display: 'inline-block', width: 7, height: 7,
                  borderRadius: '50%', background: 'var(--primary)',
                  marginLeft: 8, verticalAlign: 'middle',
                }} />
              )}
            </p>
            <span style={{
              display: 'inline-block', marginTop: 4,
              fontSize: 11, fontWeight: 600, color: cfg.fg,
              background: cfg.bg, borderRadius: 99, padding: '2px 8px',
            }}>{cfg.label}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {relativeTime(n.createdAt)}
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.55 }}>
          {n.message}
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginTop: 2 }}>
        {!n.isRead && (
          <button
            onClick={() => onMarkRead(n.notificationId)}
            title="Mark as read"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 600, color: 'var(--primary)',
              background: 'var(--accent)', border: 'none', borderRadius: 7,
              padding: '5px 10px', cursor: 'pointer', transition: 'opacity 0.15s',
            }}
          >
            <CheckCheck size={13} /> Read
          </button>
        )}
        <button
          onClick={() => onDismiss(n.notificationId)}
          title="Dismiss"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 30, height: 30, background: 'transparent', border: '1px solid var(--card-border)',
            borderRadius: 7, cursor: 'pointer', color: 'var(--muted)', transition: 'color 0.15s',
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Page (inner — needs Suspense boundary for useSearchParams) ──────────

function NotificationsInner() {
  const searchParams  = useSearchParams();
  const { user }      = useAuth();
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, dismiss, refresh } =
    useNotifications();
  const [filter,         setFilter]         = useState<'all' | 'unread'>('all');
  const [showBroadcast,  setShowBroadcast]  = useState(false);

  const isAdmin = user?.roleId === ROLES.ADMIN;

  // Open broadcast modal if ?broadcast=1 in URL
  useEffect(() => {
    if (searchParams.get('broadcast') === '1' && isAdmin) {
      setShowBroadcast(true);
    }
  }, [searchParams, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);

  const displayed = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {unreadCount > 0 && (
              <Button variant="ghost" icon={CheckCheck} size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
            {isAdmin && (
              <Button icon={Megaphone} size="sm" onClick={() => setShowBroadcast(true)}>
                Broadcast
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="tabs">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              className={`tab-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <Spinner center />
        ) : displayed.length === 0 ? (
          <Card>
            <div className="empty-state">
              <div className="empty-state-icon">
                <Bell size={26} />
              </div>
              <p className="empty-state-title">
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </p>
              <p className="empty-state-desc">
                {filter === 'unread'
                  ? 'Switch to "All" to see your full history.'
                  : 'Notifications from appointments, medical requests, and announcements will appear here.'}
              </p>
            </div>
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {displayed.map((n) => (
              <NotifItem
                key={n.notificationId}
                n={n}
                onMarkRead={markAsRead}
                onDismiss={dismiss}
              />
            ))}
          </Card>
        )}
      </div>

      {/* Broadcast modal */}
      <BroadcastModal open={showBroadcast} onClose={() => setShowBroadcast(false)} />
    </AppLayout>
  );
}

// ─── Export with Suspense (required for useSearchParams) ──────────────────────

export default function NotificationsPage() {
  return (
    <Suspense fallback={<AppLayout><Spinner center /></AppLayout>}>
      <NotificationsInner />
    </Suspense>
  );
}
