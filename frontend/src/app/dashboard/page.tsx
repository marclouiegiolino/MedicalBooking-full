'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Calendar, Clock, Video, FileText, Plus, MessageSquare, Bell, Users, Activity, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import MobileDashboard from '@/components/mobile/MobileDashboard';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import ModuleStatsChart from '@/components/ui/ModuleStatsChart';
import { appointmentApi, consultationApi, userManApi, doctorApi, appointmentTypeApi, patientApi, medicalRequestApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Appointment, Consultation, AppointmentLiveStats, Doctor, AppointmentType, Patient } from '@/lib/types';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'muted' | 'info'> = {
  confirmed: 'info',
  pending:   'warning',
  scheduled: 'warning',
  completed: 'success',
  cancelled: 'danger',
  noshow:    'danger',
  'no-show': 'danger',
  1: 'warning',
  2: 'info',
  3: 'success',
  4: 'danger',
  5: 'danger',
};

export default function DashboardPage() {
  const { user, isAdmin, isDoctor, isReceptionist } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState<number>(0);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<Doctor[]>([]);
  const [typesList, setTypesList] = useState<AppointmentType[]>([]);
  const [patientsList, setPatientsList] = useState<Patient[]>([]);
  const [medicalRequests, setMedicalRequests] = useState<any[]>([]);
  const [liveStats, setLiveStats] = useState<AppointmentLiveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastLivePing, setLastLivePing] = useState<Date | null>(null);
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLiveStats = useCallback(async () => {
    try {
      const res = await appointmentApi.getLiveToday();
      if (res.data) {
        setLiveStats(res.data);
        setLastLivePing(new Date());
      }
    } catch {
      // Background poll silently fails without crashing UI
    }
  }, []);

  const loadInitialData = useCallback(() => {
    const promises: Promise<any>[] = [
      appointmentApi.getMine().catch(() => ({ data: [] })),
      (isAdmin() ? consultationApi.getAll() : consultationApi.getMine()).catch(() => ({ data: [] })),
      doctorApi.getAll().catch(() => ({ data: [] })),
      appointmentTypeApi.getAll().catch(() => ({ data: [] })),
      patientApi.getAll().catch(() => ({ data: [] })),
      fetchLiveStats(),
      medicalRequestApi.getMine().catch(() => ({ data: [] })),
    ];

    if (isAdmin()) {
      promises.push(userManApi.getAll().catch(() => ({ data: [] })));
    }

    Promise.allSettled(promises).then(([aptRes, consultRes, docRes, typeRes, patRes, _live, medReqRes, userRes]) => {
      if (aptRes.status === 'fulfilled') {
        const d = aptRes.value?.data;
        setAppointments(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (consultRes.status === 'fulfilled') {
        const d = consultRes.value?.data;
        setConsultations(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (docRes && docRes.status === 'fulfilled') {
        const d = docRes.value?.data;
        setDoctorsList(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (typeRes && typeRes.status === 'fulfilled') {
        const d = typeRes.value?.data;
        setTypesList(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (patRes && patRes.status === 'fulfilled') {
        const d = patRes.value?.data;
        setPatientsList(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (medReqRes && medReqRes.status === 'fulfilled') {
        const d = medReqRes.value?.data;
        setMedicalRequests(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (userRes && userRes.status === 'fulfilled') {
        const d = userRes.value?.data;
        const users = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setTotalUsersCount(users.length);
        setAllUsers(users);
      }
    }).finally(() => setLoading(false));
  }, [fetchLiveStats, isAdmin]);

  useEffect(() => {
    loadInitialData();

    // Set up live real-time auto-polling every 6 seconds
    pollTimerRef.current = setInterval(() => {
      fetchLiveStats();
      appointmentApi.getMine().then((res) => {
        const d = res.data;
        setAppointments(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }).catch(() => {});
    }, 6000);

    // Initialise client-side time after mount to prevent hydration mismatch
    setClientNow(new Date());
    setLastLivePing(new Date());

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchLiveStats, loadInitialData]);

  // ── Name & Format Resolvers (avoid ID exposure) ──────────────────────────────

  const getDoctorName = (dId: number): string => {
    const doc = doctorsList.find((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return Number(d.doctorId ?? raw.doctor_id ?? 0) === dId;
    });
    if (!doc) return 'Specialist Doctor';
    const raw = doc as unknown as Record<string, unknown>;
    const first = String(doc.firstName ?? raw.first_name ?? '');
    const last = String(doc.lastName ?? raw.last_name ?? '');
    return `Dr. ${first} ${last}`.trim();
  };

  const getTypeName = (tId: number): string => {
    const t = typesList.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.appointmentTypeId ?? raw.appointment_type_id ?? 0) === tId;
    });
    if (!t) return 'Medical Consultation';
    const raw = t as unknown as Record<string, unknown>;
    return String(
      t.appointmentName ?? raw.appointment_name ?? t.typeName ?? raw.type_name ?? 'Medical Consultation'
    );
  };

  const getPatientName = (pId: number): string => {
    const p = patientsList.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.patientId ?? raw.patient_id ?? 0) === pId;
    });
    if (!p) return '';
    const raw = p as unknown as Record<string, unknown>;
    const first = String(p.firstName ?? raw.first_name ?? '').trim();
    const last = String(p.lastName ?? raw.last_name ?? '').trim();
    return [first, last].filter(Boolean).join(' ');
  };

  const formatDisplayTime = (timeStr: string): string => {
    if (!timeStr) return 'Scheduled';
    const clean = timeStr.split('T')[1] || timeStr;
    const parts = clean.split(':');
    if (parts.length < 2) return timeStr;
    const h = Number(parts[0]);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const todayStr = liveStats?.serverDate || new Date().toISOString().split('T')[0];
  const todayApts = liveStats?.appointments ?? appointments.filter((a) => {
    const raw = a as unknown as Record<string, string>;
    const d = String(a.appointmentDate ?? raw.appointment_date ?? '');
    return d.startsWith(todayStr);
  });

  const todayCount = liveStats ? liveStats.todayCount : todayApts.length;
  const pendingToday = liveStats ? liveStats.pendingCount : todayApts.filter(a => a.statusId === 1 || String(a.status).toLowerCase() === 'pending').length;
  const confirmedToday = liveStats ? liveStats.confirmedCount : todayApts.filter(a => a.statusId === 2 || String(a.status).toLowerCase() === 'confirmed').length;
  const completedToday = liveStats ? liveStats.completedCount : todayApts.filter(a => a.statusId === 4 || String(a.status).toLowerCase() === 'completed').length;
  const todayActiveCount = liveStats?.activeTodayCount ?? (pendingToday + confirmedToday);

  const upcoming = appointments.filter((a) => {
    const raw = a as unknown as Record<string, unknown>;
    const sid = Number(a.statusId ?? raw.status_id ?? 0);
    const s = String(a.status ?? raw.status ?? '').toLowerCase();
    return sid !== 3 && sid !== 4 && sid !== 5 && s !== 'completed' && s !== 'cancelled' && s !== 'no-show';
  });

  const isConsultationDone = (c: Consultation): boolean => {
    if (c.completedAt || (c as any).completed_at) return true;
    const aId = Number(c.appointmentId ?? (c as any).appointment_id ?? 0);
    if (aId) {
      const apt = appointments.find(a => Number(a.appointmentId ?? (a as any).appointment_id) === aId);
      if (apt) {
        const sid = Number(apt.statusId ?? (apt as any).status_id ?? 0);
        const s = String(apt.status ?? (apt as any).status ?? '').toLowerCase();
        if (sid === 3 || s === 'completed') return true;
      }
    }
    return false;
  };

  const activeConsultations = consultations.filter((c) => !isConsultationDone(c));
  const greeting = clientNow
    ? `Good ${clientNow.getHours() < 12 ? 'morning' : clientNow.getHours() < 18 ? 'afternoon' : 'evening'}, ${user?.username ?? 'User'}`
    : `Hello, ${user?.username ?? 'User'}`;

  const quickActions = [
    { label: 'Track Patients',   icon: Users,         href: '/patients',           show: isDoctor() || isAdmin() },
    { label: 'Book Appointment', icon: Calendar,      href: '/appointments/book',  show: !isDoctor() && !isReceptionist() },
    { label: 'Consultations',    icon: Video,         href: '/consultations',      show: true },
    { label: 'View Records',     icon: FileText,       href: '/records',            show: true },
    { label: 'Notifications',    icon: Bell,           href: '/notifications',      show: true },
    { label: 'Chat',             icon: MessageSquare,  href: '/consultations',      show: true },
  ].filter((a) => a.show);

  return (
    <AppLayout>
      {/* ─── Mobile View matching Screen 2 ─── */}
      <div className="mobile-only-section">
        <MobileDashboard
          appointments={appointments}
          doctors={doctorsList}
          appointmentTypes={typesList}
          userName={user?.username || 'Robertson'}
        />
      </div>

      {/* ─── Desktop View ─── */}
      <div className="desktop-only-section space-y-5">
        {/* Header with Live Pulse and User Profile Avatar */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Avatar
              initials={user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
              src={user?.profilePicturePath}
              size="xl"
              zoomable={true}
              title={`@${user?.username ?? 'User'}`}
              subtitle={user?.roleId === 1 ? 'System Administrator' : user?.roleId === 2 ? 'Medical Staff / Doctor' : 'Patient Account'}
              style={{
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.16)',
                border: '2.5px solid var(--primary, #2563eb)',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                flexShrink: 0,
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 className="page-title">{greeting} 👋</h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 9px',
                    borderRadius: 99,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#059669',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#10b981',
                      boxShadow: '0 0 0 0 rgba(16, 185, 129, 1)',
                      animation: 'pulse 1.5s infinite',
                    }}
                  />
                  LIVE APPOINTMENTS
                </span>
              </div>
              <p className="page-subtitle">
                {clientNow
                  ? clientNow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                  : ''}
                {' · '}Live real-time clinical stream{lastLivePing ? ` (updated ${lastLivePing.toLocaleTimeString()})` : ''}
              </p>
            </div>
          </div>
          {!isDoctor() && !isReceptionist() && (
            <Link href="/appointments/book">
              <Button icon={Plus}>Book Appointment</Button>
            </Link>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid-4">
          <StatCard
            label="Total Appointments"
            value={loading ? '—' : appointments.length}
            sub="All time records"
            icon={Calendar}
            trend="+12% this month"
          />

          {/* Today's Live Active Appointments */}
          <div
            style={{
              position: 'relative',
              background: 'var(--card-bg)',
              border: todayActiveCount > 0
                ? '2px solid rgba(59, 130, 246, 0.3)'
                : completedToday > 0
                ? '2px solid rgba(16, 185, 129, 0.3)'
                : '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Active Today</span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  fontWeight: 700,
                  color: todayActiveCount > 0 ? '#2563eb' : '#059669',
                  background: todayActiveCount > 0 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                {todayActiveCount === 0 && completedToday > 0 ? 'ALL DONE ✓' : 'LIVE TODAY'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0' }}>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: todayActiveCount > 0 ? '#2563eb' : completedToday > 0 ? '#059669' : 'var(--foreground)',
                }}
              >
                {loading ? '—' : todayActiveCount}
              </span>
              <span className="text-xs text-muted">
                {todayActiveCount === 0 && completedToday > 0
                  ? `(All ${completedToday} completed)`
                  : isDoctor() ? 'assigned to you' : (isAdmin() || isReceptionist()) ? 'hospital-wide' : 'booked by you'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 4, fontSize: 11 }}>
              <span style={{ color: '#059669', fontWeight: 600 }}>{confirmedToday} Confirmed</span>
              <span className="text-muted">·</span>
              <span style={{ color: '#d97706', fontWeight: 600 }}>{pendingToday} Pending</span>
              <span className="text-muted">·</span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{completedToday} Done</span>
            </div>
          </div>

          <StatCard
            label="Active Consultations"
            value={loading ? '—' : activeConsultations.length}
            sub={activeConsultations.length > 0 ? `${activeConsultations.length} in progress` : 'None active'}
            icon={Video}
            iconColor="#059669"
            iconBg="#d1fae5"
          />

          <StatCard
            label={isAdmin() ? 'Total Users' : 'Pending Appointments'}
            value={loading ? '—' : (isAdmin() ? totalUsersCount : upcoming.filter(a => a.status === 'pending' || a.statusId === 1).length)}
            sub={isAdmin() ? 'Registered accounts' : 'Awaiting review'}
            icon={isAdmin() ? Users : FileText}
            iconColor="#d97706"
            iconBg="#fef3c7"
          />
        </div>

        {/* Quick Actions (Upper prominence) */}
        <Card className="card-p">
          <p className="section-title" style={{ marginBottom: 14 }}>Quick Actions</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(quickActions.length, 4)}, 1fr)`, gap: 12 }}>
            {quickActions.slice(0, 4).map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  href={a.href}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                    padding: '16px 10px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--card-border)',
                    textDecoration: 'none',
                    transition: 'var(--transition)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} style={{ color: 'var(--primary)' }} />
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--foreground)', lineHeight: 1.3 }}>{a.label}</span>
                </Link>
              );
            })}
          </div>
        </Card>

        {/* ── Module Statistics Line Graph ── */}
        <ModuleStatsChart
          loading={loading}
          modules={[
            {
              key: 'appointments',
              label: 'Appointments',
              color: '#3b82f6',
              data: appointments,
            },
            {
              key: 'consultations',
              label: 'Consultations',
              color: '#8b5cf6',
              data: consultations,
            },
            {
              key: 'patients',
              label: 'Patients',
              color: '#10b981',
              data: patientsList,
            },
            {
              key: 'doctors',
              label: 'Doctors',
              color: '#f59e0b',
              data: doctorsList,
            },
            {
              key: 'medicalRequests',
              label: 'Medical Requests',
              color: '#ef4444',
              data: medicalRequests,
            },
            ...(isAdmin()
              ? [{ key: 'users', label: 'Users', color: '#06b6d4', data: allUsers }]
              : []),
          ]}
        />

        {/* Main grid */}
        <div className="grid-main">
          {/* Left column */}
          <div className="space-y-5">
            {/* Today's Appointments Stream */}
            <Card className="card-p">
              <div className="section-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <p className="section-title">Today&apos;s Live Appointments</p>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                  </div>
                  <p className="section-sub">{loading ? 'Loading…' : `${todayApts.length} scheduled for today`}</p>
                </div>
                <Link href="/appointments">
                  <Button variant="ghost" size="sm">View all</Button>
                </Link>
              </div>

              {loading ? (
                <Spinner center />
              ) : todayApts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Calendar size={24} /></div>
                  <p className="empty-state-title">No appointments scheduled for today</p>
                  <p className="empty-state-desc">You have a clear schedule today.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayApts.slice(0, 6).map((apt, idx) => {
                    const raw = apt as unknown as Record<string, unknown>;
                    const aId = Number(apt.appointmentId ?? raw.appointment_id ?? idx);
                    const time = String(apt.appointmentTime ?? raw.appointment_time ?? '');
                    const _sid = Number(apt.statusId ?? raw.status_id ?? 0);
                    const status = String(apt.status ?? raw.status ?? (_sid === 2 ? 'confirmed' : _sid === 3 ? 'completed' : _sid === 4 ? 'cancelled' : _sid === 5 ? 'no-show' : 'pending'));
                    const statusId = Number(apt.statusId ?? raw.status_id ?? 1);
                    const tId = Number(apt.appointmentTypeId ?? raw.appointment_type_id ?? 0);
                    const dId = Number(apt.doctorId ?? raw.doctor_id ?? 0);
                    const pId = Number(apt.patientId ?? raw.patient_id ?? 0);

                    const typeTitle = getTypeName(tId);
                    const docName = getDoctorName(dId);
                    const patName = getPatientName(pId);
                    const displayTime = formatDisplayTime(time);

                    return (
                      <div
                        key={`appt-today-row-${aId}`}
                        className="appt-row"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 8,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={18} style={{ color: 'var(--primary)' }} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                              {typeTitle}
                            </p>
                            <p className="text-xs text-muted">
                              {displayTime ? <strong>{displayTime}</strong> : 'Today'} · {docName}
                              {patName && (isDoctor() || isReceptionist()) ? ` · Patient: ${patName}` : patName ? ` · ${patName}` : ''}
                            </p>
                          </div>
                        </div>
                        <Badge variant={STATUS_VARIANT[statusId] ?? STATUS_VARIANT[status.toLowerCase()] ?? 'muted'}>
                          {status.toUpperCase()}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>



            {/* Admin Management Console */}
            {isAdmin() && (
              <Card className="card-p">
                <div style={{ marginBottom: 14 }}>
                  <p className="section-title">Admin Management Console</p>
                  <p className="section-sub">Direct access to system administration modules</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Manage Users', href: '/admin/users', icon: '👤' },
                    { label: 'Manage Doctors', href: '/admin/doctors', icon: '🩺' },
                    { label: 'Manage Patients', href: '/admin/patients', icon: '🏥' },
                    { label: 'Departments', href: '/admin/departments', icon: '🏢' },
                    { label: 'Specialties', href: '/admin/specialties', icon: '📋' },
                    { label: 'Appointment Types', href: '/admin/appointment-types', icon: '📅' },
                    { label: 'Request Types', href: '/admin/request-types', icon: '📄' },
                    { label: 'User Roles', href: '/admin/roles', icon: '🛡️' },
                    { label: 'Reports', href: '/admin/reports', icon: '📊' },
                  ].map((m) => (
                    <Link
                      key={m.label}
                      href={m.href}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--card-border)',
                        background: 'var(--accent)',
                        textDecoration: 'none',
                        color: 'var(--foreground)',
                        fontWeight: 500,
                        fontSize: 13,
                      }}
                    >
                      <span>{m.icon}</span>
                      <span>{m.label}</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Upcoming Appointments */}
            <Card className="card-p">
              <div className="section-header">
                <p className="section-title">Upcoming Schedule</p>
                <Link href="/appointments"><Button variant="ghost" size="sm">All</Button></Link>
              </div>
              {loading ? (
                <Spinner center />
              ) : upcoming.slice(0, 5).map((apt) => {
                const raw = apt as unknown as Record<string, unknown>;
                const aId = Number(apt.appointmentId ?? raw.appointment_id ?? 0);
                const tId = Number(apt.appointmentTypeId ?? raw.appointment_type_id ?? 0);
                const dId = Number(apt.doctorId ?? raw.doctor_id ?? 0);
                const typeTitle = getTypeName(tId);
                const docName = getDoctorName(dId);
                const _sid2 = Number(apt.statusId ?? raw.status_id ?? 0);
                const status = String(apt.status ?? raw.status ?? (_sid2 === 2 ? 'confirmed' : _sid2 === 3 ? 'completed' : _sid2 === 4 ? 'cancelled' : _sid2 === 5 ? 'no-show' : 'pending'));
                const statusId = Number(apt.statusId ?? raw.status_id ?? 1);

                return (
                  <div key={`upcoming-apt-${aId}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--card-border)' }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{typeTitle}</p>
                      <p className="text-xs text-muted">
                        {new Date(apt.appointmentDate).toLocaleDateString()} · {docName}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[statusId] ?? STATUS_VARIANT[status.toLowerCase()] ?? 'muted'}>
                      {status.toUpperCase()}
                    </Badge>
                  </div>
                );
              })}
              {!loading && upcoming.length === 0 && (
                <p className="text-sm text-muted" style={{ textAlign: 'center', padding: '16px 0' }}>No upcoming appointments</p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

