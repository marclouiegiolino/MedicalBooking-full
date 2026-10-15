'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Calendar, Users, Video, FileText, Bell,
  Settings, User, Stethoscope, Shield, LogOut, HeartPulse,
  ChevronLeft, ChevronRight, MessageSquare, BarChart2,
  ClipboardList, Building2, Briefcase, UserCheck, Star, MapPin
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Avatar from '@/components/ui/Avatar';
import { ROLES } from '@/lib/types';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  doctorOnly?: boolean;
  patientOnly?: boolean;
  hideForDoctor?: boolean;
  hideForReceptionist?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  hideForDoctor?: boolean;
  hideForReceptionist?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Hospitals Near You', href: '/hospitals', icon: MapPin },
      { label: 'Notifications', href: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Appointments',
    items: [
      { label: 'My Appointments', href: '/appointments', icon: Calendar },
      { label: 'Book Appointment', href: '/appointments/book', icon: Calendar, patientOnly: true },
      { label: 'Calendar', href: '/appointments/calendar', icon: Calendar },
    ],
  },
  {
    label: 'Patients & Clinical',
    items: [
      { label: 'Patient Directory', href: '/patients', icon: Users, hideForReceptionist: false },
      { label: 'Doctor Directory', href: '/doctors', icon: Stethoscope, hideForDoctor: true },
      { label: 'Doctor Schedules', href: '/schedules', icon: Calendar },
    ],
  },
  {
    label: 'Telemedicine',
    hideForReceptionist: true,
    items: [
      { label: 'Consultations', href: '/consultations', icon: Video, hideForReceptionist: true },
    ],
  },
  {
    label: 'Medical Records',
    items: [
      { label: 'Records & Results', href: '/records', icon: FileText, hideForReceptionist: true },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'My Profile', href: '/profile', icon: User },
      { label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
  {
    label: 'Administration',
    adminOnly: true,
    items: [
      { label: 'Manage Users', href: '/admin/users', icon: Users, adminOnly: true },
      { label: 'Manage Staff', href: '/admin/staff', icon: UserCheck, adminOnly: true },
      { label: 'Manage Doctors', href: '/admin/doctors', icon: Stethoscope, adminOnly: true },
      { label: 'Manage Reviews', href: '/admin/reviews', icon: Star, adminOnly: true },
      { label: 'Manage Appointments', href: '/admin/appointments', icon: Calendar, adminOnly: true },
      { label: 'Doctor Schedules', href: '/schedules', icon: Calendar, adminOnly: true },
      { label: 'Manage Patients', href: '/admin/patients', icon: User, adminOnly: true },
      { label: 'Hospital Information', href: '/admin/hospital-info', icon: Building2, adminOnly: true },
      { label: 'Departments', href: '/admin/departments', icon: Building2, adminOnly: true },
      { label: 'Job Roles', href: '/admin/job-roles', icon: Briefcase, adminOnly: true },
      { label: 'Specialties', href: '/admin/specialties', icon: ClipboardList, adminOnly: true },
      { label: 'Appointment Types', href: '/admin/appointment-types', icon: Calendar, adminOnly: true },
      { label: 'Request Types', href: '/admin/request-types', icon: FileText, adminOnly: true },
      { label: 'User Roles', href: '/admin/roles', icon: Shield, adminOnly: true },
      { label: 'Reports', href: '/admin/reports', icon: BarChart2, adminOnly: true },
    ],
  },
];

const ROLE_LABELS: Record<number, string> = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.STAFF]: 'Staff',
  [ROLES.USER]: 'User',
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, isAdmin, isPatient, isDoctor, isReceptionist } = useAuth();

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'U';

  // Dynamic role label
  const roleLabel = isAdmin() ? 'Admin'
    : isDoctor() ? 'Doctor'
    : isReceptionist() ? 'Receptionist'
    : 'User';

  const filteredGroups = NAV_GROUPS.filter((g) => {
    if (g.adminOnly && !isAdmin()) return false;
    if (g.hideForDoctor && isDoctor()) return false;
    if (g.hideForReceptionist && isReceptionist()) return false;
    return true;
  });

  return (
    <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <HeartPulse size={18} />
        </div>
        {!collapsed && <span className="sidebar-brand-name">MediBook</span>}
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {filteredGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.adminOnly && !isAdmin()) return false;
            if (item.patientOnly && !isPatient()) return false;
            if (item.doctorOnly && !isDoctor()) return false;
            if (item.hideForDoctor && isDoctor()) return false;
            if (item.hideForReceptionist && isReceptionist()) return false;
            return true;
          });
          if (!visibleItems.length) return null;

          return (
            <div key={group.label} className="sidebar-group">
              {!collapsed && (
                <p className="sidebar-group-label">{group.label}</p>
              )}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={17} />
                    {!collapsed && <span className="sidebar-item-text">{item.label}</span>}
                  </Link>
                );
              })}
              {!collapsed && <div className="sidebar-divider" />}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed ? (
          <>
            <Link
              href="/profile"
              className="sidebar-user"
              style={{ textDecoration: 'none' }}
              title="View your profile"
            >
              <Avatar initials={initials} src={user?.profilePicturePath} size="sm" zoomable={true} />
              <div className="sidebar-user-info">
                <p className="sidebar-user-name">{user?.username ?? 'User'}</p>
                <p className="sidebar-user-role">{roleLabel}</p>
              </div>
            </Link>
            <button
              className="sidebar-item"
              style={{ color: '#ef4444', marginTop: 4 }}
              onClick={logout}
              suppressHydrationWarning
            >
              <LogOut size={17} />
              <span className="sidebar-item-text">Sign out</span>
            </button>
          </>
        ) : (
          <>
            <Link
              href="/profile"
              style={{ display: 'flex', justifyContent: 'center', padding: '4px 0', marginBottom: 4 }}
              title="View your profile"
            >
              <Avatar initials={initials} src={user?.profilePicturePath} size="sm" zoomable={true} />
            </Link>
            <button
              className="sidebar-item"
              style={{ justifyContent: 'center' }}
              onClick={logout}
              title="Sign out"
              suppressHydrationWarning
            >
              <LogOut size={17} style={{ color: '#ef4444' }} />
            </button>
          </>
        )}

        {/* Collapse toggle */}
        <button
          onClick={onToggle}
          className="sidebar-item"
          style={{ justifyContent: collapsed ? 'center' : 'flex-end', marginTop: 8 }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          suppressHydrationWarning
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
