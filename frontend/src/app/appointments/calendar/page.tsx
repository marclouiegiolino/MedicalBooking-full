'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, X, Clock,
  User, Stethoscope, Calendar,
  CheckCircle2, XCircle, AlertCircle, Info, AlertOctagon, UserX, RefreshCw,
  Navigation, MapPin,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import PatientDetailsModal from '@/components/ui/PatientDetailsModal';
import PatientTransitTrackerModal from '@/components/ui/PatientTransitTrackerModal';
import { appointmentApi, doctorApi, patientApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Appointment, Doctor, Patient } from '@/lib/types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Status style map ─────────────────────────────────────────────────────────
interface SS { bg: string; border: string; accent: string; text: string; icon: React.ElementType; label: string }
const STATUS_STYLES: Record<string, SS> = {
  confirmed: { bg:'rgba(59,130,246,0.08)',  border:'rgba(59,130,246,0.2)',   accent:'#3b82f6', text:'#1d4ed8', icon:CheckCircle2,  label:'Confirmed' },
  pending:   { bg:'var(--warning-bg)',       border:'rgba(217,119,6,0.25)',  accent:'var(--warning)', text:'var(--warning-text)', icon:AlertCircle,   label:'Pending'   },
  scheduled: { bg:'var(--warning-bg)',       border:'rgba(217,119,6,0.25)',  accent:'var(--warning)', text:'var(--warning-text)', icon:AlertCircle,   label:'Pending'   },
  completed: { bg:'rgba(16,185,129,0.08)',  border:'rgba(16,185,129,0.2)',   accent:'#10b981', text:'#059669', icon:CheckCircle2,  label:'Completed' },
  cancelled: { bg:'rgba(239,68,68,0.08)',   border:'rgba(239,68,68,0.2)',    accent:'#ef4444', text:'#dc2626', icon:XCircle,       label:'Cancelled' },
  // ── special past-date states ──
  overdue:   { bg:'rgba(220,38,38,0.10)',   border:'rgba(220,38,38,0.28)',   accent:'#dc2626', text:'#991b1b', icon:AlertOctagon,  label:'Overdue'   },
  noshow:    { bg:'rgba(139,92,246,0.10)',  border:'rgba(139,92,246,0.25)',  accent:'#7c3aed', text:'#5b21b6', icon:UserX,         label:'No-Show'   },
};
const DEF_STYLE: SS = { bg:'rgba(100,116,139,0.08)', border:'rgba(100,116,139,0.18)', accent:'#64748b', text:'#475569', icon:Info, label:'Scheduled' };

// statusId → status string (DB: 1=Pending, 2=Confirmed, 3=Completed, 4=Cancelled, 5=No-Show)
const STATUS_ID_MAP: Record<number, string> = {
  1:'pending', 2:'confirmed', 3:'completed', 4:'cancelled', 5:'noshow',
};

// Returns the visual style for an appointment, ensuring all statuses
// (Pending, Confirmed, Completed, Cancelled, No-Show) map correctly
const getS = (apt: Appointment, todayMidnight?: Date): SS => {
  const sid = Number(apt.statusId ?? (apt as any).status_id ?? 0);
  const sStr = (apt.status ?? '').toLowerCase().replace(/[\s-_]/g, '');

  // Completed status (green success)
  if (sid === 3 || sStr === 'completed') return STATUS_STYLES.completed;

  // Cancelled status (red danger)
  if (sid === 4 || sStr === 'cancelled' || sStr === 'canceled') return STATUS_STYLES.cancelled;

  // Explicit no-show
  if (sid === 5 || sStr === 'noshow') return STATUS_STYLES.noshow;

  // Pending / Scheduled status (amber warning)
  if (sid === 1 || sStr === 'pending' || sStr === 'scheduled') return STATUS_STYLES.pending;

  // Confirmed status (blue info, or overdue if in past without completion)
  if (sid === 2 || sStr === 'confirmed') {
    if (todayMidnight && apt.appointmentDate) {
      const aptDate = new Date(apt.appointmentDate.split('T')[0] + 'T00:00:00');
      if (aptDate < todayMidnight) return STATUS_STYLES.overdue;
    }
    return STATUS_STYLES.confirmed;
  }

  // Normal lookup fallback
  const byString = STATUS_STYLES[sStr];
  if (byString) return byString;
  const byId = STATUS_STYLES[STATUS_ID_MAP[sid] ?? ''];
  return byId ?? DEF_STYLE;
};

// ─── Appointment pill ─────────────────────────────────────────────────────────
function Pill({ apt, todayMidnight }: { apt: Appointment; todayMidnight: Date }) {
  const s = getS(apt, todayMidnight);
  const time = apt.appointmentTime?.slice(0, 5) ?? '';
  const sid = Number(apt.statusId ?? (apt as any).status_id ?? 0);
  const statusLabel = apt.status || STATUS_ID_MAP[sid] || 'consultation';
  const label = apt.reason || apt.remarks || statusLabel;
  return (
    <div
      title={`${time} - ${s.label}`}
      style={{
        display:'flex', alignItems:'center', gap:4,
        padding:'3px 6px 3px 8px', borderRadius:5, marginBottom:3,
        fontSize:10.5, fontWeight:600,
        background:s.bg, border:`1px solid ${s.border}`, borderLeft:`3px solid ${s.accent}`,
        color:s.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}
    >
      {time && <span style={{ flexShrink:0, opacity:0.85, marginRight:2 }}>{time}</span>}
      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
    </div>
  );
}

// ─── Day detail modal ─────────────────────────────────────────────────────────
function DayModal({ date, apts, onClose, doctorView, adminView, todayMidnight, getDoctorName, getPatientName, onOpenPatientDetails, onOpenTransitTracker, canViewPatientDetails }: {
  date: Date;
  apts: Appointment[];
  onClose: () => void;
  doctorView: boolean;
  adminView: boolean;
  todayMidnight: Date;
  getDoctorName: (id: number) => string;
  getPatientName: (id: number) => string;
  onOpenPatientDetails?: (patientId: number) => void;
  onOpenTransitTracker?: (appointment: Appointment) => void;
  canViewPatientDetails?: boolean;
}) {
  const dayLabel = date.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  return (
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, zIndex:1000,
        background:'rgba(0,0,0,0.45)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:20, backdropFilter:'blur(3px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background:'var(--card-bg)', border:'1px solid var(--card-border)',
          borderRadius:'var(--radius-lg)', width:'100%', maxWidth:520,
          maxHeight:'80vh', overflowY:'auto',
          boxShadow:'0 24px 60px rgba(0,0,0,0.22)',
        }}
      >
        {/* header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'18px 20px 16px', borderBottom:'1px solid var(--card-border)',
          position:'sticky', top:0, background:'var(--card-bg)', zIndex:1,
        }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <Calendar size={17} style={{ color:'var(--primary)' }} />
              <span style={{ fontSize:15, fontWeight:700, color:'var(--foreground)' }}>{dayLabel}</span>
            </div>
            <p style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>
              {apts.length === 0 ? 'No appointments scheduled'
                : `${apts.length} appointment${apts.length > 1 ? 's' : ''} scheduled`}
            </p>
          </div>
          <button onClick={onClose} style={{
            width:30, height:30, borderRadius:'50%', border:'1px solid var(--card-border)',
            background:'var(--accent)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)',
          }}>
            <X size={14} />
          </button>
        </div>

        {/* body */}
        <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {apts.length === 0 ? (
            <div style={{ padding:'32px 0', textAlign:'center', color:'var(--muted)' }}>
              <Calendar size={28} style={{ margin:'0 auto 10px', opacity:0.4 }} />
              <p style={{ fontWeight:600, fontSize:14 }}>No appointments</p>
              <p style={{ fontSize:12, marginTop:4 }}>Nothing scheduled for this day.</p>
            </div>
          ) : (
            [...apts]
              .sort((a, b) => (a.appointmentTime || '').localeCompare(b.appointmentTime || ''))
              .map((apt) => {
                const s = getS(apt, todayMidnight);
                const StatusIcon = s.icon;
                const time = apt.appointmentTime?.slice(0, 5) ?? '--:--';
                return (
                  <div key={apt.appointmentId} style={{
                    borderRadius:'var(--radius)',
                    background:'transparent',
                    borderLeft:`4px solid ${s.accent}`,
                    borderBottom:'1px solid var(--card-border)',
                    padding:'12px 14px', display:'flex', flexDirection:'column', gap:6,
                  }}>
                    {/* time + badge row */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <Clock size={13} style={{ color:s.accent, flexShrink:0 }} />
                        <span style={{ fontWeight:700, fontSize:13, color:'var(--foreground)' }}>{time}</span>
                      </div>
                      <span style={{
                        fontSize:10.5, fontWeight:700, textTransform:'uppercase' as const,
                        letterSpacing:'0.06em', padding:'3px 8px', borderRadius:20,
                        background:s.accent, color:'white',
                        display:'flex', alignItems:'center', gap:4,
                      }}>
                        <StatusIcon size={10} />{s.label}
                      </span>
                    </div>
                    {/* reason */}
                    {(apt.reason || apt.notes) && (
                      <p style={{ fontSize:12.5, color:'var(--foreground)', fontWeight:500, margin:0 }}>
                        {apt.reason || apt.notes}
                      </p>
                    )}
                    {/* doctor / patient name */}
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--muted)', flexWrap:'wrap' }}>
                      {doctorView ? (
                        <>
                          <User size={12} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          {canViewPatientDetails && Number(apt.patientId ?? (apt as any).patient_id ?? 0) > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const pId = Number(apt.patientId ?? (apt as any).patient_id ?? 0);
                                  if (pId && onOpenPatientDetails) onOpenPatientDetails(pId);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'var(--primary)',
                                  background: 'rgba(59, 130, 246, 0.08)',
                                  border: '1px solid rgba(59, 130, 246, 0.2)',
                                  padding: '2px 8px',
                                  borderRadius: 5,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title="Click to view patient details and records"
                              >
                                <span>{getPatientName(Number(apt.patientId ?? (apt as any).patient_id ?? 0))}</span>
                                {adminView && apt.patientId ? <span style={{ opacity: 0.7 }}>#{apt.patientId}</span> : null}
                                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>→</span>
                              </button>
                              {onOpenTransitTracker && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenTransitTracker(apt);
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: '#059669',
                                    background: 'rgba(5, 150, 105, 0.08)',
                                    border: '1px solid rgba(5, 150, 105, 0.25)',
                                    padding: '2px 6px',
                                    borderRadius: 5,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  title="Track patient on map"
                                >
                                  <Navigation size={10} />
                                  <span>Map</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span>
                              {getPatientName(Number(apt.patientId ?? (apt as any).patient_id ?? 0))}
                              {adminView && apt.patientId ? ` (#${apt.patientId})` : ''}
                            </span>
                          )}
                        </>
                      ) : (
                        <><Stethoscope size={12} /><span>
                          {getDoctorName(Number(apt.doctorId ?? (apt as any).doctor_id ?? 0))}
                          {adminView && apt.doctorId ? ` (#${apt.doctorId})` : ''}
                        </span></>
                      )}
                      {apt.remarks && (
                        <><span style={{ opacity:0.4 }}>•</span>
                        <span style={{ fontStyle:'italic', opacity:0.8 }}>{apt.remarks}</span></>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Legend pill ──────────────────────────────────────────────────────────────
function LegendPill({ s }: { s: SS }) {
  const Icon = s.icon;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6,
      padding:'5px 11px', borderRadius:20,
      background:s.bg, border:`1px solid ${s.border}`,
      fontSize:12, fontWeight:600, color:s.text,
    }}>
      <Icon size={12} />{s.label}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { isDoctor, isPatient, isAdmin, isReceptionist } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors]   = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const today = useMemo(() => new Date(), []);
  // today at midnight (local) — used for overdue detection
  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<{ day: number; apts: Appointment[] } | null>(null);

  // Patient details modal state
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientObj, setSelectedPatientObj] = useState<Patient | null>(null);

  // Patient Transit Tracker modal state
  const [transitModalOpen, setTransitModalOpen] = useState(false);
  const [transitAppointment, setTransitAppointment] = useState<Appointment | null>(null);
  const [transitPatient, setTransitPatient] = useState<Patient | null>(null);

  const handleOpenPatientDetails = (pId: number) => {
    if (!pId) return;
    const found = patients.find((p) => {
      const raw = p as unknown as Record<string, unknown>;
      return Number(p.patientId ?? raw.patient_id ?? 0) === pId;
    });
    setSelectedPatientId(pId);
    setSelectedPatientObj(found ?? null);
    setPatientModalOpen(true);
  };

  const handleOpenTransitTracker = (apt: Appointment) => {
    const pId = Number(apt.patientId ?? (apt as any).patient_id ?? 0);
    const found = patients.find((p) => {
      const raw = p as unknown as Record<string, unknown>;
      return Number(p.patientId ?? raw.patient_id ?? 0) === pId;
    });
    setTransitAppointment(apt);
    setTransitPatient(found ?? null);
    setTransitModalOpen(true);
  };

  const fetchCalendarData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const [aRes, dRes, pRes] = await Promise.all([
        appointmentApi.getMine(),
        doctorApi.getAll().catch(() => ({ data: [] })),
        patientApi.getAll().catch(() => ({ data: [] })),
      ]);
      const aData = aRes?.data;
      setAppointments(Array.isArray(aData) ? aData : Array.isArray(aData?.items) ? aData.items : []);

      const dData = dRes?.data;
      setDoctors(
        Array.isArray(dData) ? dData
        : Array.isArray(dData?.items) ? dData.items
        : Array.isArray(dData?.data) ? dData.data : []
      );

      const pData = pRes?.data;
      setPatients(
        Array.isArray(pData) ? pData
        : Array.isArray(pData?.items) ? pData.items : []
      );
      setLastUpdated(new Date());
    } catch {
      // keep existing state on background fetch error
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendarData(false);
    const timer = setInterval(() => {
      fetchCalendarData(true);
    }, 6000);
    return () => clearInterval(timer);
  }, [fetchCalendarData]);

  // ── Name resolvers ─────────────────────────────────────────────────
  const getDoctorName = (dId: number): string => {
    const doc = doctors.find((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return Number(d.doctorId ?? raw.doctor_id ?? 0) === dId;
    });
    if (!doc) return dId > 0 ? `Dr. #${dId}` : '—';
    const raw = doc as unknown as Record<string, unknown>;
    const first = String(doc.firstName ?? raw.first_name ?? '').trim();
    const last  = String(doc.lastName  ?? raw.last_name  ?? '').trim();
    return `Dr. ${[first, last].filter(Boolean).join(' ')}`.trim() || `Dr. #${dId}`;
  };

  const getPatientName = (pId: number): string => {
    const p = patients.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.patientId ?? raw.patient_id ?? 0) === pId;
    });
    if (!p) return pId > 0 ? `Patient #${pId}` : '—';
    const raw = p as unknown as Record<string, unknown>;
    const first  = String(p.firstName  ?? raw.first_name  ?? '').trim();
    const middle = String(p.middleName  ?? raw.middle_name ?? '').trim();
    const last   = String(p.lastName   ?? raw.last_name   ?? '').trim();
    return [first, middle, last].filter(Boolean).join(' ') || `Patient #${pId}`;
  };

  // calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getAptsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return appointments.filter((a) => a.appointmentDate?.startsWith(dateStr));
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const goToToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  // role-aware labels
  const pageTitle = isDoctor() ? 'My Schedule Calendar'
    : isReceptionist() ? 'All Appointments Calendar'
    : isPatient() ? 'My Scheduled Appointments'
    : 'Appointment Calendar';
  const pageSubtitle = isDoctor()
    ? 'View your scheduled patient appointments by month'
    : isReceptionist()
    ? 'Monthly overview of all appointments received by doctors'
    : isPatient()
    ? 'Track your upcoming and past appointments by date'
    : 'Monthly overview of all scheduled appointments';

  // monthly stats
  const monthApts = useMemo(() =>
    appointments.filter((a) => {
      const d = new Date(a.appointmentDate);
      return d.getFullYear() === year && d.getMonth() === month;
    }),
  [appointments, year, month]);

  const statCounts = useMemo(() => {
    const counts: Record<string, number> = {
      pending:0, confirmed:0, completed:0, cancelled:0, overdue:0, noshow:0,
    };
    monthApts.forEach((a) => {
      const s = getS(a, todayMidnight);
      const k = s.label.toLowerCase().replace(/[\s-_]/g, '');
      const keyMap: Record<string, string> = {
        pending:'pending', scheduled:'pending', confirmed:'confirmed',
        completed:'completed', cancelled:'cancelled', overdue:'overdue',
        noshow:'noshow',
      };
      const key = keyMap[k] ?? '';
      if (key in counts) counts[key]++;
    });
    return counts;
  }, [monthApts, todayMidnight]);

  return (
    <AppLayout>
      <div className="space-y-5" style={{ paddingBottom:40 }}>

        {/* ── Header ── */}
        <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title" style={{ margin: 0 }}>{pageTitle}</h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: '#059669',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '3px 8px',
                  borderRadius: 99,
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#10b981',
                  }}
                />
                LIVE
              </span>
            </div>
            <p className="page-subtitle" style={{ marginTop: 4 }}>
              {pageSubtitle} · Updated {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fetchCalendarData(false)}
              disabled={isRefreshing}
              title="Refresh calendar appointments"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '6px 12px' }}
            >
              <RefreshCw size={13} style={{ animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }} />
              <span>{isRefreshing ? 'Fetching…' : 'Refresh'}</span>
            </button>
            <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={14} /></button>
            <button className="btn btn-secondary btn-sm" onClick={goToToday} style={{ fontSize:12, fontWeight:600, padding:'6px 14px' }}>Today</button>
            <span style={{ padding:'6px 16px', fontWeight:700, fontSize:14, background:'var(--primary)', color:'white', borderRadius:'var(--radius-full)' }}>
              {MONTHS[month]} {year}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={14} /></button>
          </div>
        </div>

        {/* ── Monthly stat chips ── */}
        {!loading && monthApts.length > 0 && (
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            {Object.entries(statCounts).map(([status, count]) => {
              if (!count) return null;
              const s = STATUS_STYLES[status] ?? DEF_STYLE;
              const Icon = s.icon;
              return (
                <div key={status} style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'7px 13px', borderRadius:'var(--radius)',
                  background:s.bg, border:`1px solid ${s.border}`, borderLeft:`3px solid ${s.accent}`,
                  fontSize:12.5, color:s.text, fontWeight:600,
                }}>
                  <Icon size={13} /><span>{count} {s.label}</span>
                </div>
              );
            })}
            <div style={{
              display:'flex', alignItems:'center', gap:8,
              padding:'7px 13px', borderRadius:'var(--radius)',
              background:'var(--accent)', border:'1px solid var(--card-border)',
              fontSize:12.5, color:'var(--muted)', fontWeight:600,
            }}>
              <Calendar size={13} /><span>{monthApts.length} total this month</span>
            </div>
          </div>
        )}

        {/* ── Calendar ── */}
        {loading ? <Spinner center /> : (
          <Card style={{ overflow:'hidden' }}>
            {/* Day-name header */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:'1px solid var(--card-border)', background:'var(--accent)' }}>
              {DAYS.map((d, i) => (
                <div key={d} style={{
                  padding:'11px 0', textAlign:'center', fontSize:11, fontWeight:700,
                  color: i === 0 || i === 6 ? '#ef4444' : 'var(--muted)',
                  textTransform:'uppercase', letterSpacing:'0.07em',
                }}>{d}</div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)' }}>
              {cells.map((day, idx) => {
                const isToday  = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const dayApts  = day ? getAptsForDay(day) : [];
                const hasApts  = dayApts.length > 0;
                const weekend  = idx % 7 === 0 || idx % 7 === 6;
                const isPast   = day ? new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate()) : false;
                const baseBg   = !day ? 'var(--accent)' : isToday ? 'rgba(59,130,246,0.05)' : weekend ? 'rgba(248,250,252,0.7)' : 'var(--card-bg)';

                return (
                  <div
                    key={idx}
                    onClick={() => day && setSelectedDay({ day, apts: dayApts })}
                    onMouseEnter={(e) => { if (day) (e.currentTarget as HTMLDivElement).style.background = isToday ? 'rgba(59,130,246,0.09)' : 'var(--accent)'; }}
                    onMouseLeave={(e) => { if (day) (e.currentTarget as HTMLDivElement).style.background = baseBg; }}
                    style={{
                      minHeight:108, padding:8,
                      borderRight:'1px solid var(--card-border)',
                      borderBottom:'1px solid var(--card-border)',
                      background:baseBg,
                      cursor: day ? 'pointer' : 'default',
                      transition:'background 0.12s',
                      position:'relative',
                    }}
                  >
                    {day && (
                      <>
                        {/* day number bubble */}
                        <div style={{
                          width:26, height:26, borderRadius:'50%',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          marginBottom:5, fontSize:12.5,
                          fontWeight: isToday ? 800 : hasApts ? 600 : 400,
                          background: isToday ? 'var(--primary)' : 'transparent',
                          color: isToday ? 'white' : weekend ? '#ef4444' : isPast ? 'var(--muted)' : 'var(--foreground)',
                          boxShadow: isToday ? '0 2px 8px rgba(59,130,246,0.35)' : 'none',
                        }}>{day}</div>

                        {/* appointment pills (max 3 shown) */}
                        {dayApts.slice(0, 3).map((a) => <Pill key={a.appointmentId} apt={a} todayMidnight={todayMidnight} />)}
                        {dayApts.length > 3 && (
                          <div style={{ fontSize:10, color:'var(--primary)', fontWeight:700, marginTop:2, paddingLeft:4 }}>
                            +{dayApts.length - 3} more
                          </div>
                        )}

                        {/* small dot when day has appointments */}
                        {hasApts && (
                          <div style={{
                            position:'absolute', bottom:5, right:7,
                            width:6, height:6, borderRadius:'50%',
                            background:'var(--primary)', opacity:0.5,
                          }} />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Status Legend ── */}
        <div style={{
          display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
          padding: '12px 16px', background: 'var(--card-bg)', border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius)',
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Status:
          </span>
          {[
            STATUS_STYLES.pending,
            STATUS_STYLES.confirmed,
            STATUS_STYLES.completed,
            STATUS_STYLES.cancelled,
            STATUS_STYLES.overdue,
            STATUS_STYLES.noshow,
          ].map((s) => <LegendPill key={s.label} s={s} />)}
          <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 'auto' }}>
            Click any day to view details
          </span>
        </div>
      </div>

      {/* ── Day detail modal ── */}
      {selectedDay && (
        <DayModal
          date={new Date(year, month, selectedDay.day)}
          apts={selectedDay.apts}
          onClose={() => setSelectedDay(null)}
          doctorView={isDoctor() || isReceptionist() || isAdmin()}
          adminView={isAdmin()}
          todayMidnight={todayMidnight}
          getDoctorName={getDoctorName}
          getPatientName={getPatientName}
          onOpenPatientDetails={handleOpenPatientDetails}
          onOpenTransitTracker={handleOpenTransitTracker}
          canViewPatientDetails={isDoctor() || isReceptionist() || isAdmin()}
        />
      )}

      {/* ── Patient Details Modal ── */}
      <PatientDetailsModal
        open={patientModalOpen}
        patientId={selectedPatientId}
        initialPatient={selectedPatientObj}
        onClose={() => {
          setPatientModalOpen(false);
          setSelectedPatientId(null);
          setSelectedPatientObj(null);
        }}
      />

      {/* ── Patient Transit Tracker Map Modal ── */}
      <PatientTransitTrackerModal
        open={transitModalOpen}
        appointment={transitAppointment}
        patient={transitPatient}
        onClose={() => {
          setTransitModalOpen(false);
          setTransitAppointment(null);
          setTransitPatient(null);
        }}
      />
    </AppLayout>
  );
}
