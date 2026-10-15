'use client';
import { useEffect, useState, useMemo } from 'react';
import { Calendar, Users, Stethoscope, TrendingUp, BarChart2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { appointmentApi, doctorApi, userManApi, patientApi, specialtyApi } from '@/lib/api';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
const VIBRANT_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

export default function AdminReportsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      appointmentApi.getAll(),
      doctorApi.getAll(),
      patientApi.getAll(),
      userManApi.getAll(),
      specialtyApi.getAll(),
    ])
      .then(([a, d, p, u, s]) => {
        setAppointments(a.status === 'fulfilled' ? (a.value.data ?? []) : []);
        setDoctors(d.status === 'fulfilled' ? (d.value.data ?? []) : []);
        setPatients(p.status === 'fulfilled' ? (p.value.data ?? []) : []);
        setUsers(u.status === 'fulfilled' ? (u.value.data ?? []) : []);
        setSpecialties(s.status === 'fulfilled' ? (s.value.data ?? []) : []);
      })
      .finally(() => setLoading(false));
  }, []);

  // 1. Calculate Monthly Appointments from real API data
  const monthlyData = useMemo(() => {
    const counts: Record<string, number> = {};
    MONTH_NAMES.forEach((m) => (counts[m] = 0));

    appointments.forEach((apt) => {
      const rawDate = apt.appointmentDate ?? apt.appointment_date ?? apt.createdAt ?? apt.created_at;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          const monthShort = d.toLocaleString('en-US', { month: 'short' });
          if (counts[monthShort] !== undefined) {
            counts[monthShort] += 1;
          }
        }
      }
    });

    return MONTH_NAMES.map((month) => ({
      month,
      appointments: counts[month] || 0,
    }));
  }, [appointments]);

  const maxVal = Math.max(...monthlyData.map((m) => m.appointments), 1);

  // 2. Calculate Top Specialties from real API data
  const specialtyStats = useMemo(() => {
    if (specialties.length === 0) return [];

    const specCounts: Record<number, { name: string; count: number }> = {};
    specialties.forEach((s) => {
      const id = Number(s.specialtyId ?? s.specialty_id);
      const name = s.specialtyName ?? s.specialty_name ?? `Specialty #${id}`;
      specCounts[id] = { name, count: 0 };
    });

    doctors.forEach((d) => {
      const sId = Number(d.specialtyId ?? d.specialty_id);
      if (specCounts[sId]) {
        specCounts[sId].count += 1;
      }
    });

    const totalDoctors = doctors.length || 1;
    const sorted = Object.values(specCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return sorted.map((s, idx) => ({
      name: s.name,
      pct: Math.round((s.count / totalDoctors) * 100),
      color: VIBRANT_COLORS[idx % VIBRANT_COLORS.length],
    }));
  }, [specialties, doctors]);

  // 3. Calculate Appointment Status Counts from real API data
  const statusStats = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let cancelled = 0;
    let completed = 0;

    appointments.forEach((a) => {
      const st = String(a.status ?? '').toLowerCase();
      const stId = Number(a.statusId ?? a.status_id ?? 0);

      if (st === 'confirmed' || stId === 1) confirmed++;
      else if (st === 'pending' || stId === 2) pending++;
      else if (st === 'cancelled' || st === 'canceled' || stId === 3) cancelled++;
      else if (st === 'completed' || stId === 4) completed++;
      else pending++;
    });

    return [
      { label: 'Confirmed', count: confirmed, color: 'var(--success)', bg: 'var(--success-bg)' },
      { label: 'Pending', count: pending, color: 'var(--warning)', bg: 'var(--warning-bg)' },
      { label: 'Cancelled', count: cancelled, color: 'var(--danger)', bg: 'var(--danger-bg)' },
      { label: 'Completed', count: completed, color: 'var(--muted)', bg: '#f1f5f9' },
    ];
  }, [appointments]);

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports & Analytics</h1>
            <p className="page-subtitle">Real-time system statistics and Insights</p>
          </div>
        </div>

        {loading ? (
          <Spinner center />
        ) : (
          <>
            <div className="grid-4">
              <StatCard
                label="Total Appointments"
                value={appointments.length}
                icon={Calendar}
                trend="+12% this month"
              />
              <StatCard
                label="Registered Doctors"
                value={doctors.length}
                icon={Stethoscope}
                iconColor="#6d28d9"
                iconBg="#ede9fe"
              />
              <StatCard
                label="Total Patients"
                value={patients.length}
                icon={Users}
                iconColor="#059669"
                iconBg="#d1fae5"
              />
              <StatCard
                label="Total Users"
                value={users.length}
                icon={TrendingUp}
                iconColor="#d97706"
                iconBg="#fef3c7"
              />
            </div>

            {/* Monthly Appointments Chart */}
            <Card className="card-p">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BarChart2 size={18} style={{ color: 'var(--primary)' }} />
                </div>
                <div>
                  <p className="section-title">Monthly Appointments</p>
                  <p className="text-xs text-muted">Real-time appointment volume from system database</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 200 }}>
                {monthlyData.map((m) => (
                  <div key={m.month} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)' }}>{m.appointments}</span>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div
                        style={{
                          width: '100%',
                          height: `${(m.appointments / maxVal) * 100}%`,
                          minHeight: 8,
                          background: 'linear-gradient(180deg, #3b82f6, #1d4ed8)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.5s ease',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{m.month}</span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid-2">
              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 16 }}>Top Specialties</p>
                {specialtyStats.length === 0 ? (
                  <p className="text-xs text-muted">No specialty data registered.</p>
                ) : (
                  specialtyStats.map((s) => (
                    <div key={s.name} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="text-sm" style={{ color: 'var(--foreground)' }}>
                          {s.name}
                        </span>
                        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                          {s.pct}%
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 99, background: '#f1f5f9' }}>
                        <div style={{ height: '100%', width: `${s.pct}%`, borderRadius: 99, background: s.color }} />
                      </div>
                    </div>
                  ))
                )}
              </Card>

              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 16 }}>Appointment Status</p>
                {statusStats.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius)',
                      background: item.bg,
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: item.color }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 700, color: item.color }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
