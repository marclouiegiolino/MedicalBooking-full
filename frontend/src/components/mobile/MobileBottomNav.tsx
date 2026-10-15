'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calendar, Stethoscope, Video, User } from 'lucide-react';

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Hide on welcome screen or auth pages
  if (pathname === '/welcome' || pathname === '/login' || pathname === '/register' || pathname === '/forgot-password') {
    return null;
  }

  const navItems = [
    { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Schedule', href: '/appointments', icon: Calendar },
    { label: 'Specialists', href: '/doctors', icon: Stethoscope },
    { label: 'Telehealth', href: '/consultations', icon: Video },
    { label: 'Profile', href: '/profile', icon: User },
  ];

  return (
    <nav className="hp-bottom-nav" aria-label="Mobile Navigation">
      <div className="hp-bottom-nav-inner">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`hp-bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <div className="hp-nav-icon-wrapper">
                <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
              </div>
              <span className="hp-bottom-nav-label">{item.label}</span>
              {isActive && <span className="hp-active-dot" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
