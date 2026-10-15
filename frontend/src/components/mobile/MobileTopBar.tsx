'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Bell, ChevronLeft, Settings, Heart } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/context/NotificationContext';
import Avatar from '@/components/ui/Avatar';

interface MobileTopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export default function MobileTopBar({ title, showBack, onBack, rightAction }: MobileTopBarProps) {
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const router = useRouter();
  const pathname = usePathname();

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : 'U';
  const username = user?.username || 'Robertson';

  // Subpage mode (e.g. Doctor details, settings, etc.)
  if (showBack || (title && pathname !== '/dashboard')) {
    return (
      <header className="hp-mobile-topbar hp-mobile-topbar-sub">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else router.back();
          }}
          className="hp-topbar-circle-btn"
          aria-label="Back"
        >
          <ChevronLeft size={20} />
        </button>

        <h1 className="hp-mobile-title">{title || 'Doctor Detail'}</h1>

        <div className="hp-topbar-right">
          {rightAction || (
            <button type="button" className="hp-topbar-circle-btn" aria-label="Favorite">
              <Heart size={18} />
            </button>
          )}
        </div>
      </header>
    );
  }

  // Dashboard / Home mode matching Screen 2
  return (
    <header className="hp-mobile-topbar">
      <div className="hp-mobile-user">
        <Link href="/profile" className="hp-avatar-link">
          <Avatar
            initials={initials}
            src={user?.profilePicturePath || '/images/user-robertson.jpg'}
            size="md"
            style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid #ffffff' }}
          />
        </Link>
        <div className="hp-user-greeting">
          <span className="hp-greeting-label">Hi,</span>
          <span className="hp-greeting-name">{username}</span>
        </div>
      </div>

      <div className="hp-topbar-right">
        <Link href="/notifications" className="hp-topbar-circle-btn" aria-label="Notifications">
          <Bell size={20} />
          {unreadCount > 0 && <span className="hp-notif-badge" />}
        </Link>
      </div>
    </header>
  );
}
