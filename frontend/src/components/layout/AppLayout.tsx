'use client';
import { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import MobileTopBar from '@/components/mobile/MobileTopBar';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import MobilePreviewModal from '@/components/mobile/MobilePreviewModal';
import CompleteProfileModal from '@/components/ui/CompleteProfileModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      <CompleteProfileModal />

      {/* Desktop Navigation */}
      <div className="desktop-nav-wrapper">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />
        <TopBar sidebarCollapsed={collapsed} />
      </div>

      {/* Mobile Top Navigation */}
      <div className="mobile-nav-wrapper">
        <MobileTopBar />
      </div>

      <main className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="page-content">{children}</div>
      </main>

      {/* Mobile Bottom 5-Tab Navigation */}
      <MobileBottomNav />

      {/* Interactive Desktop Mobile Preview Simulator */}
      <MobilePreviewModal />
    </div>
  );
}


