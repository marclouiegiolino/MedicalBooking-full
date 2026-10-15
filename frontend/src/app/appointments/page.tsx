'use client';
import { useEffect, useState } from 'react';
import {
  Calendar, Plus, Search, Clock, Edit, XCircle, Eye, CheckCircle,
  AlertTriangle, Filter, RefreshCw, Stethoscope, User, LayoutList, Users2, ChevronDown, ChevronUp,
  Navigation, MapPin,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import Modal from '@/components/ui/Modal';
import PatientDetailsModal from '@/components/ui/PatientDetailsModal';
import PatientTransitTrackerModal from '@/components/ui/PatientTransitTrackerModal';
import { appointmentApi, doctorApi, appointmentTypeApi, consultationApi, patientApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Appointment, Doctor, AppointmentType, Patient } from '@/lib/types';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' | 'info' }> = {
  1: { label: 'Scheduled',  variant: 'warning' },
  2: { label: 'Confirmed',  variant: 'info'    },
  3: { label: 'Completed',  variant: 'success' },
  4: { label: 'Cancelled',  variant: 'danger'  },
  5: { label: 'No-Show',    variant: 'danger'  },
};

function getStatus(apt: Appointment) {
  const raw = apt as unknown as Record<string, unknown>;
  const sid = Number(apt.statusId ?? raw.status_id ?? 0);
  const s = String(apt.status ?? raw.status ?? '').toLowerCase().replace(/[\s-_]/g, '');
  if (s === 'completed' || sid === 3) return { label: 'Completed',  variant: 'success' as const };
  if (s === 'cancelled' || s === 'canceled' || sid === 4) return { label: 'Cancelled',  variant: 'danger'  as const };
  if (s === 'confirmed' || sid === 2) return { label: 'Confirmed',  variant: 'info'     as const };
  if (s === 'noshow'    || sid === 5) return { label: 'No-Show',    variant: 'danger'   as const };
  if (sid && STATUS_MAP[sid]) return STATUS_MAP[sid];
  return { label: 'Scheduled', variant: 'warning' as const };
}

function aptId(a: Appointment): number {
  const raw = a as unknown as Record<string, unknown>;
  return Number(a.appointmentId ?? raw.appointment_id ?? 0);
}
function aptDate(a: Appointment): string {
  const raw = a as unknown as Record<string, unknown>;
  return String(a.appointmentDate ?? raw.appointment_date ?? '');
}
function aptTime(a: Appointment): string {
  const raw = a as unknown as Record<string, unknown>;
  return String(a.appointmentTime ?? raw.appointment_time ?? '');
}
function aptDoctorId(a: Appointment): number {
  const raw = a as unknown as Record<string, unknown>;
  return Number(a.doctorId ?? raw.doctor_id ?? 0);
}
function aptTypeId(a: Appointment): number {
  const raw = a as unknown as Record<string, unknown>;
  return Number(a.appointmentTypeId ?? raw.appointment_type_id ?? 0);
}
function aptRemarks(a: Appointment): string {
  const raw = a as unknown as Record<string, unknown>;
  return String(a.remarks ?? raw.remarks ?? a.notes ?? raw.notes ?? a.reason ?? raw.reason ?? '');
}
function aptStatusId(a: Appointment): number {
  const raw = a as unknown as Record<string, unknown>;
  return Number(a.statusId ?? raw.status_id ?? 1);
}
function aptPatientId(a: Appointment): number {
  const raw = a as unknown as Record<string, unknown>;
  return Number(a.patientId ?? raw.patient_id ?? 0);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return dateStr; }
}

function formatTime(timeStr: string): string {
  if (!timeStr) return '—';
  return timeStr.slice(0, 5); // HH:mm
}

const TABS = ['All', 'Today', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

export default function AppointmentsPage() {
  const { isDoctor, isAdmin, isPatient, isReceptionist } = useAuth();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('All');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'byDoctor'>('byDoctor');
  const [collapsedDoctors, setCollapsedDoctors] = useState<Record<number, boolean>>({});

  // Edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    doctorId: 0,
    appointmentTypeId: 0,
    appointmentDate: '',
    appointmentTime: '',
    statusId: 1,
    remarks: '',
  });

  // View modal
  const [viewModal, setViewModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<Appointment | null>(null);

  // Patient details modal
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientObj, setSelectedPatientObj] = useState<Patient | null>(null);

  // Patient Transit Tracker map modal
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
    const pId = aptPatientId(apt);
    const found = patients.find((p) => {
      const raw = p as unknown as Record<string, unknown>;
      return Number(p.patientId ?? raw.patient_id ?? 0) === pId;
    });
    setTransitAppointment(apt);
    setTransitPatient(found ?? null);
    setTransitModalOpen(true);
  };

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      appointmentApi.getMine(),
      doctorApi.getAll(),
      appointmentTypeApi.getAll(),
      patientApi.getAll().catch(() => ({ data: [] })),
    ])
      .then(([aRes, dRes, tRes, pRes]) => {
        const aData = aRes?.data;
        const aptList: Appointment[] = Array.isArray(aData)
          ? aData : Array.isArray(aData?.items) ? aData.items : [];

        const dData = dRes?.data;
        const docList: Doctor[] = Array.isArray(dData)
          ? dData
          : Array.isArray(dData?.items) ? dData.items
          : Array.isArray(dData?.data) ? dData.data
          : Array.isArray(dData?.doctors) ? dData.doctors : [];

        const tData = tRes?.data;
        const typeList: AppointmentType[] = Array.isArray(tData)
          ? tData : Array.isArray(tData?.items) ? tData.items : [];

        const pData = pRes?.data;
        const ptList: Patient[] = Array.isArray(pData)
          ? pData
          : Array.isArray(pData?.items) ? pData.items
          : [];

        setAppointments(aptList);
        setDoctors(docList);
        setTypes(typeList);
        setPatients(ptList);
        setLastUpdated(new Date());
      })
      .catch(() => {})
      .finally(() => {
        if (!silent) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      load(true);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getPatientName = (pId: number): string => {
    const p = patients.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.patientId ?? raw.patient_id ?? 0) === pId;
    });
    if (!p) return 'Patient';
    const raw = p as unknown as Record<string, unknown>;
    const first = String(p.firstName ?? raw.first_name ?? '').trim();
    const middle = String(p.middleName ?? raw.middle_name ?? '').trim();
    const last  = String(p.lastName  ?? raw.last_name  ?? '').trim();
    const full = [first, middle, last].filter(Boolean).join(' ');
    return full || 'Patient';
  };

  const getDoctorName = (dId: number): string => {
    const doc = doctors.find((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return Number(d.doctorId ?? raw.doctor_id ?? 0) === dId;
    });
    if (!doc) return `Doctor #${dId}`;
    const raw = doc as unknown as Record<string, unknown>;
    const first = String(doc.firstName ?? raw.first_name ?? '');
    const last  = String(doc.lastName  ?? raw.last_name  ?? '');
    return `Dr. ${first} ${last}`.trim();
  };

  const getTypeName = (tId: number): string => {
    const t = types.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.appointmentTypeId ?? raw.appointment_type_id ?? 0) === tId;
    });
    if (!t) return `Type #${tId}`;
    const raw = t as unknown as Record<string, unknown>;
    return String(
      t.appointmentName ?? raw.appointment_name ?? t.typeName ?? raw.type_name ?? `Type #${tId}`
    );
  };

  // ── Filtering ────────────────────────────────────────────────────────────────

  const todayStr = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((a) => aptDate(a).startsWith(todayStr));
  const todayTotalCount = todayAppointments.length;
  const todayActiveCount = todayAppointments.filter((a) => {
    const sid = aptStatusId(a);
    return sid === 1 || sid === 2; // Scheduled or Confirmed
  }).length;
  const todayCompletedCount = todayAppointments.filter((a) => aptStatusId(a) === 3).length;

  const filtered = appointments.filter((a) => {
    const status = getStatus(a);
    let matchTab = true;
    if (tab === 'Today') {
      matchTab = aptDate(a).startsWith(todayStr);
    } else if (tab !== 'All') {
      matchTab = status.label === tab;
    }
    const matchSearch = search
      ? `${aptId(a)} ${getPatientName(aptPatientId(a))} ${getDoctorName(aptDoctorId(a))} ${aptRemarks(a)} ${aptDate(a)}`
          .toLowerCase().includes(search.toLowerCase())
      : true;
    return matchTab && matchSearch;
  });

  // ── Group by Doctor ──────────────────────────────────────────────────────────
  const groupedByDoctor = (() => {
    const groups: Record<number, { doctorName: string; appointments: Appointment[] }> = {};
    filtered.forEach((apt) => {
      const dId = aptDoctorId(apt);
      if (!groups[dId]) {
        groups[dId] = { doctorName: getDoctorName(dId), appointments: [] };
      }
      groups[dId].appointments.push(apt);
    });
    // Sort groups: doctors with active appointments first
    return Object.entries(groups)
      .map(([dId, g]) => ({ dId: Number(dId), ...g }))
      .sort((a, b) => {
        const aActive = a.appointments.filter(x => aptStatusId(x) === 1 || aptStatusId(x) === 2).length;
        const bActive = b.appointments.filter(x => aptStatusId(x) === 1 || aptStatusId(x) === 2).length;
        return bActive - aActive || a.doctorName.localeCompare(b.doctorName);
      });
  })();

  const toggleDoctorCollapse = (dId: number) => {
    setCollapsedDoctors(prev => ({ ...prev, [dId]: !prev[dId] }));
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────

  const handleOpenEdit = (apt: Appointment) => {
    const status = getStatus(apt);
    const isFinished = status.label === 'Completed' || status.label === 'Cancelled' || status.label === 'No-Show';
    if (isFinished) {
      alert('Completed, cancelled, or no-show appointments cannot be edited.');
      return;
    }
    setEditTarget(apt);
    const date = aptDate(apt).split('T')[0];
    const time = formatTime(aptTime(apt));
    setEditForm({
      doctorId: aptDoctorId(apt),
      appointmentTypeId: aptTypeId(apt),
      appointmentDate: date,
      appointmentTime: time,
      statusId: aptStatusId(apt),
      remarks: aptRemarks(apt),
    });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      const id = aptId(editTarget);
      await appointmentApi.update(id, {
        appointment_id:       id,
        appointmentId:        id,
        doctor_id:            editForm.doctorId,
        doctorId:             editForm.doctorId,
        appointment_type_id:  editForm.appointmentTypeId,
        appointmentTypeId:    editForm.appointmentTypeId,
        appointment_date:     editForm.appointmentDate,
        appointmentDate:      editForm.appointmentDate,
        appointment_time:     editForm.appointmentTime ? `${editForm.appointmentTime}:00` : '',
        appointmentTime:      editForm.appointmentTime ? `${editForm.appointmentTime}:00` : '',
        status_id:            editForm.statusId,
        statusId:             editForm.statusId,
        remarks:              editForm.remarks,
        patient_id:           aptPatientId(editTarget),
        patientId:            aptPatientId(editTarget),
      });
      setEditModal(false);
      load();
    } catch {
      alert('Failed to update appointment.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (apt: Appointment) => {
    const status = getStatus(apt);
    const isFinished = status.label === 'Completed' || status.label === 'Cancelled' || status.label === 'No-Show';
    if (isFinished) {
      alert('Completed, cancelled, or no-show appointments cannot be deleted.');
      return;
    }
    const action = isPatient() ? 'cancel' : 'delete';
    const confirmed = confirm(
      `Are you sure you want to ${action} Appointment #${aptId(apt)}?`
    );
    if (!confirmed) return;
    try {
      await appointmentApi.delete(aptId(apt));
      load();
    } catch {
      alert('Could not delete appointment.');
    }
  };

  const router = useRouter();
  const [startingConsultationId, setStartingConsultationId] = useState<number | null>(null);

  // ── Start/Open Consultation ──────────────────────────────────────────────────

  const handleStartConsultation = async (apt: Appointment) => {
    const aId = aptId(apt);
    setStartingConsultationId(aId);
    try {
      // 1. Check if consultation already exists for this appointment
      const existingRes = await consultationApi.getByAppointment(aId);
      const existingList: any[] = Array.isArray(existingRes.data)
        ? existingRes.data
        : Array.isArray(existingRes.data?.items)
        ? existingRes.data.items
        : [];

      if (existingList.length > 0) {
        const cId = Number(existingList[0].consultationId ?? existingList[0].consultation_id ?? 0);
        router.push(`/consultations?id=${cId}`);
        return;
      }

      // 2. Create consultation for this appointment
      const dId = aptDoctorId(apt);
      const pId = aptPatientId(apt);
      const newRes = await consultationApi.create({
        appointmentId: aId,
        appointment_id: aId,
        doctorId: dId,
        doctor_id: dId,
        patientId: pId,
        patient_id: pId,
        diagnosis: '',
        consultationNotes: '',
        consultation_notes: '',
        treatmentPlan: '',
        treatment_plan: '',
        prescription: '',
      });

      const created = newRes.data;
      const createdId = Number(created?.consultationId ?? created?.consultation_id ?? 0);
      if (createdId > 0) {
        router.push(`/consultations?id=${createdId}`);
      } else {
        router.push(`/consultations?appointmentId=${aId}`);
      }
    } catch (err: unknown) {
      console.error(err);
      router.push(`/consultations?appointmentId=${aId}`);
    } finally {
      setStartingConsultationId(null);
    }
  };

  // ── View ─────────────────────────────────────────────────────────────────────

  const handleView = (apt: Appointment) => {
    setViewTarget(apt);
    setViewModal(true);
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {isAdmin() || isReceptionist()
                ? 'All Appointments'
                : isDoctor()
                ? 'My Scheduled Appointments'
                : 'My Appointments'}
            </h1>
            <p className="page-subtitle">
              {isAdmin()
                ? 'View and manage all system appointments'
                : isReceptionist()
                ? 'View and manage all appointments received by doctors'
                : isDoctor()
                ? 'View your scheduled patient appointments'
                : 'View and manage your scheduled visits'}
            </p>
          </div>
          {isPatient() && (
            <Link href="/appointments/book">
              <Button icon={Plus}>Book New</Button>
            </Link>
          )}
        </div>

        {/* View Mode Toggle — Receptionist & Admin only */}
        {(isAdmin() || isReceptionist()) && (
          <div style={{ display: 'flex', gap: 6, padding: '10px 0 4px' }}>
            <button
              className={`filter-chip ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              suppressHydrationWarning
            >
              <LayoutList size={14} />
              <span>List View</span>
            </button>
            <button
              className={`filter-chip ${viewMode === 'byDoctor' ? 'active' : ''}`}
              onClick={() => setViewMode('byDoctor')}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              suppressHydrationWarning
            >
              <Users2 size={14} />
              <span>By Doctor</span>
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div className="search-bar" style={{ flex:'1 1 240px', maxWidth:360 }}>
            <Search size={15} style={{ color:'var(--muted)', flexShrink:0 }} />
            <input
              placeholder="Search by doctor, date, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              suppressHydrationWarning
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => load(false)}
              title="Refresh"
              style={{ display:'flex', alignItems:'center', gap:4 }}
              suppressHydrationWarning
            >
              <RefreshCw size={14} /> Refresh
            </button>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
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
              LIVE UPDATES
            </span>
          </div>

          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {TABS.map((t) => {
              const countBadge = t === 'All'
                ? appointments.length
                : t === 'Today'
                ? todayTotalCount
                : appointments.filter((a) => getStatus(a).label === t).length;

              return (
                <button
                  key={t}
                  className={`filter-chip ${tab === t ? 'active' : ''}`}
                  onClick={() => setTab(t)}
                  suppressHydrationWarning
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <span>{t}</span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '1px 6px',
                      borderRadius: 99,
                      background: tab === t ? 'rgba(255,255,255,0.25)' : 'var(--card-border)',
                      fontWeight: 700,
                    }}
                  >
                    {countBadge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <div
            style={{
              padding:'8px 16px',
              borderRadius:'var(--radius)',
              background: todayActiveCount > 0
                ? 'rgba(59, 130, 246, 0.08)'
                : todayCompletedCount > 0
                ? 'rgba(16, 185, 129, 0.08)'
                : 'var(--card-bg)',
              border: todayActiveCount > 0
                ? '1.5px solid rgba(59, 130, 246, 0.3)'
                : todayCompletedCount > 0
                ? '1.5px solid rgba(16, 185, 129, 0.3)'
                : '1px solid var(--card-border)',
              fontSize:12,
              display:'flex',
              alignItems:'center',
              gap:8,
            }}
          >
            <span
              className="font-bold"
              style={{
                fontSize:16,
                color: todayActiveCount > 0 ? '#2563eb' : todayCompletedCount > 0 ? '#059669' : 'var(--foreground)',
              }}
            >
              {todayActiveCount}
            </span>
            <span
              style={{
                fontWeight: 600,
                color: todayActiveCount > 0 ? '#1d4ed8' : todayCompletedCount > 0 ? '#047857' : 'var(--muted)',
              }}
            >
              {todayActiveCount === 0 && todayCompletedCount > 0
                ? `Active Today (${todayCompletedCount} Completed ✓)`
                : `Active Today`}
            </span>
          </div>

          {Object.entries(STATUS_MAP).map(([sid, info]) => {
            const count = appointments.filter((a) => aptStatusId(a) === Number(sid)).length;
            return (
              <div
                key={sid}
                style={{
                  padding:'8px 16px',
                  borderRadius:'var(--radius)',
                  background:'var(--card-bg)',
                  border:'1px solid var(--card-border)',
                  fontSize:12,
                  display:'flex',
                  alignItems:'center',
                  gap:6,
                }}
              >
                <span className="font-bold" style={{ fontSize:15 }}>{count}</span>
                <span style={{ color:'var(--muted)' }}>{info.label}</span>
              </div>
            );
          })}
        </div>

        {/* Content Section */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:48 }}>
            <Spinner size="lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:'var(--muted)' }}>
            <p className="font-medium text-sm">No appointments found</p>
          </div>
        ) : viewMode === 'byDoctor' ? (
          /* ── By Doctor card-grid view (matches schedule card design) ── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(440px, 1fr))', gap: 20 }}>
            {groupedByDoctor.map(({ dId, doctorName, appointments: docApts }) => {
              const doc = doctors.find(d => {
                const raw = d as unknown as Record<string, unknown>;
                return Number(d.doctorId ?? raw.doctor_id ?? 0) === dId;
              });
              const raw = doc as unknown as Record<string, unknown> | undefined;
              const specialty = String(doc?.specialtyName ?? raw?.specialty_name ?? doc?.departmentName ?? raw?.department_name ?? '');
              const department = String(doc?.departmentName ?? raw?.department_name ?? '');

              const scheduledCount  = docApts.filter(a => aptStatusId(a) === 1).length;
              const confirmedCount  = docApts.filter(a => aptStatusId(a) === 2).length;
              const completedCount  = docApts.filter(a => aptStatusId(a) === 3).length;
              const cancelledCount  = docApts.filter(a => aptStatusId(a) === 4).length;
              const noShowCount     = docApts.filter(a => aptStatusId(a) === 5).length;
              const activeCount     = scheduledCount + confirmedCount;

              // Status row color palette (mirrors the day-of-week colors from schedule cards)
              const STATUS_ROW_STYLES: Record<string, { bg: string; border: string; labelColor: string; dotColor: string }> = {
                Scheduled:  { bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.22)',  labelColor: '#b45309', dotColor: '#f59e0b' },
                Pending:    { bg: 'rgba(245,158,11,0.06)',  border: 'rgba(245,158,11,0.22)',  labelColor: '#b45309', dotColor: '#f59e0b' },
                Confirmed:  { bg: 'rgba(59,130,246,0.06)',  border: 'rgba(59,130,246,0.2)',   labelColor: '#1d4ed8', dotColor: '#3b82f6' },
                Completed:  { bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.2)',   labelColor: '#059669', dotColor: '#10b981' },
                Cancelled:  { bg: 'rgba(239,68,68,0.05)',   border: 'rgba(239,68,68,0.18)',   labelColor: '#dc2626', dotColor: '#ef4444' },
                'No-Show':  { bg: 'rgba(139,92,246,0.05)',  border: 'rgba(139,92,246,0.2)',   labelColor: '#7c3aed', dotColor: '#7c3aed' },
              };

              // Group appointments by status label for the row display
              const statusGroups: { label: string; apts: Appointment[] }[] = [
                { label: 'Scheduled',  apts: docApts.filter(a => aptStatusId(a) === 1) },
                { label: 'Confirmed',  apts: docApts.filter(a => aptStatusId(a) === 2) },
                { label: 'Completed',  apts: docApts.filter(a => aptStatusId(a) === 3) },
                { label: 'Cancelled',  apts: docApts.filter(a => aptStatusId(a) === 4) },
                { label: 'No-Show',    apts: docApts.filter(a => aptStatusId(a) === 5) },
              ].filter(g => g.apts.length > 0);

              return (
                <div
                  key={`doctor-card-${dId}`}
                  style={{
                    borderRadius: 16,
                    border: activeCount > 0 ? '1.5px solid rgba(59,130,246,0.22)' : '1.5px solid var(--card-border)',
                    background: 'var(--card-bg)',
                    boxShadow: activeCount > 0
                      ? '0 4px 20px rgba(59,130,246,0.09)'
                      : '0 2px 10px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* ── Doctor Header ── */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '18px 20px 14px',
                    gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                      {/* Avatar circle */}
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: activeCount > 0
                          ? 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(99,102,241,0.12) 100%)'
                          : 'var(--accent)',
                        border: activeCount > 0 ? '1.5px solid rgba(59,130,246,0.25)' : '1.5px solid var(--card-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Stethoscope size={22} style={{ color: activeCount > 0 ? '#2563eb' : 'var(--muted)' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.2 }}>
                          {doctorName}
                        </p>
                        {(specialty || department) && (
                          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                            {specialty}{specialty && department && specialty !== department ? ` · ${department}` : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Active badge */}
                    {activeCount > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 700,
                        background: 'rgba(16,185,129,0.1)',
                        color: '#059669',
                        border: '1px solid rgba(16,185,129,0.25)',
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                        {activeCount} Active Appt{activeCount !== 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 99,
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'var(--accent)',
                        color: 'var(--muted)',
                        border: '1px solid var(--card-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        {docApts.length} Appt{docApts.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* ── Section label ── */}
                  <div style={{ padding: '0 20px 8px' }}>
                    <p style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                    }}>
                      APPOINTMENTS BY STATUS
                    </p>
                  </div>

                  {/* ── Status Rows ── */}
                  <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {statusGroups.map(({ label, apts: groupApts }) => {
                      const style = STATUS_ROW_STYLES[label] ?? STATUS_ROW_STYLES['Scheduled'];
                      // Get earliest appointment time for the group
                      const times = groupApts.map(a => aptTime(a)).filter(Boolean).sort();
                      const firstTime = times[0] ? formatTime(times[0]) : '';
                      const lastTime  = times[times.length - 1] ? formatTime(times[times.length - 1]) : '';
                      const timeRange = firstTime && lastTime && firstTime !== lastTime
                        ? `${firstTime} – ${lastTime}`
                        : firstTime || '—';

                      return (
                        <div
                          key={`status-row-${dId}-${label}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '9px 12px',
                            borderRadius: 8,
                            background: style.bg,
                            border: `1px solid ${style.border}`,
                          }}
                        >
                          {/* Status label */}
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: style.labelColor,
                            minWidth: 78,
                          }}>
                            {label}
                          </span>

                          {/* Time range */}
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            color: style.labelColor,
                            flex: 1,
                          }}>
                            <Clock size={11} style={{ opacity: 0.8 }} />
                            {timeRange}
                          </span>

                          {/* Appointment count + patient chip */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
                              {groupApts.length} patient{groupApts.length !== 1 ? 's' : ''}
                            </span>
                            {/* Quick patient names (up to 2) */}
                            <div style={{ display: 'flex', gap: 3 }}>
                              {groupApts.slice(0, 2).map((apt) => {
                                const pName = getPatientName(aptPatientId(apt));
                                const initials = pName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                                return (
                                  <button
                                    key={`mini-avatar-${aptId(apt)}`}
                                    type="button"
                                    title={pName}
                                    onClick={() => handleOpenPatientDetails(aptPatientId(apt))}
                                    style={{
                                      width: 22,
                                      height: 22,
                                      borderRadius: '50%',
                                      background: style.dotColor,
                                      color: '#fff',
                                      fontSize: 9,
                                      fontWeight: 700,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      border: 'none',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {initials}
                                  </button>
                                );
                              })}
                              {groupApts.length > 2 && (
                                <span style={{
                                  width: 22, height: 22, borderRadius: '50%',
                                  background: 'var(--card-border)',
                                  fontSize: 9, fontWeight: 700, color: 'var(--muted)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  +{groupApts.length - 2}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Footer summary ── */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    margin: '14px 20px 0',
                    padding: '12px 14px',
                    borderRadius: 8,
                    background: 'var(--accent)',
                    border: '1px solid var(--card-border)',
                  }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Total Appointments: </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>
                        {docApts.length} appointment{docApts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>Active: </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: activeCount > 0 ? '#2563eb' : 'var(--muted)' }}>
                        {activeCount} patients
                      </span>
                    </div>
                  </div>

                  {/* ── View Details button ── */}
                  <div style={{ padding: '12px 20px 18px' }}>
                    <button
                      type="button"
                      onClick={() => toggleDoctorCollapse(dId)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 16px',
                        borderRadius: 8,
                        border: '1.5px solid var(--card-border)',
                        background: 'transparent',
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--primary)',
                        transition: 'all 0.15s ease',
                      }}
                      suppressHydrationWarning
                    >
                      <Eye size={14} />
                      {collapsedDoctors[dId] ? `Show Appointments (${docApts.length})` : `Hide Appointments (${docApts.length})`}
                    </button>
                  </div>

                  {/* ── Expanded appointment rows ── */}
                  {!collapsedDoctors[dId] && (
                    <div style={{
                      borderTop: '1px solid var(--card-border)',
                      padding: '12px 20px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      {docApts.map((apt) => {
                        const id = aptId(apt);
                        const status = getStatus(apt);
                        const tId = aptTypeId(apt);
                        const date = aptDate(apt);
                        const time = aptTime(apt);
                        const remarks = aptRemarks(apt);
                        const isFinished = status.label === 'Completed' || status.label === 'Cancelled' || status.label === 'No-Show';
                        const rowStyle = STATUS_ROW_STYLES[status.label] ?? STATUS_ROW_STYLES['Scheduled'];

                        return (
                          <div
                            key={`expanded-apt-${id}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: rowStyle.bg,
                              border: `1px solid ${rowStyle.border}`,
                            }}
                          >
                            {/* Colored dot */}
                            <span style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: rowStyle.dotColor,
                              flexShrink: 0,
                            }} />

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
                                {getTypeName(tId)}
                              </p>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenPatientDetails(aptPatientId(apt)); }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 3,
                                    fontSize: 11, fontWeight: 600,
                                    color: rowStyle.labelColor,
                                    background: 'transparent',
                                    border: 'none',
                                    padding: 0, cursor: 'pointer',
                                    textDecoration: 'underline',
                                    textDecorationStyle: 'dotted',
                                    textUnderlineOffset: 2,
                                  }}
                                >
                                  <User size={9} />
                                  {getPatientName(aptPatientId(apt))}
                                </button>
                                <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Calendar size={9} /> {formatDate(date)}
                                </span>
                                {time && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <Clock size={9} /> {formatTime(time)}
                                  </span>
                                )}
                                {remarks && (
                                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                                    · {remarks.slice(0, 40)}{remarks.length > 40 ? '…' : ''}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              {aptPatientId(apt) > 0 && (
                                <Button variant="ghost" size="sm" icon={User}
                                  onClick={() => handleOpenPatientDetails(aptPatientId(apt))}>
                                  Patient
                                </Button>
                              )}
                              {(isReceptionist() || isDoctor() || isAdmin()) && !isFinished && aptPatientId(apt) > 0 && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  icon={Navigation}
                                  onClick={() => handleOpenTransitTracker(apt)}
                                  style={{
                                    borderColor: 'rgba(5, 150, 105, 0.4)',
                                    color: '#059669',
                                    background: 'rgba(5, 150, 105, 0.08)',
                                  }}
                                  title="Track if patient is on the way via live map"
                                >
                                  Track on Map
                                </Button>
                              )}
                              {!isFinished && (
                                <Button variant="primary" size="sm" icon={Stethoscope}
                                  loading={startingConsultationId === id}
                                  onClick={() => handleStartConsultation(apt)}>
                                  Consult
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" icon={Eye} onClick={() => handleView(apt)}>
                                View
                              </Button>
                              {!isFinished && (
                                <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(apt)}>
                                  Edit
                                </Button>
                              )}
                              {!isFinished && (
                                <Button variant="danger" size="sm" icon={XCircle} onClick={() => handleDelete(apt)}>
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Default list view ── */
          <div className="space-y-3">
            {filtered.map((apt) => {
              const id = aptId(apt);
              const status = getStatus(apt);
              const dId = aptDoctorId(apt);
              const tId = aptTypeId(apt);
              const date = aptDate(apt);
              const time = aptTime(apt);
              const remarks = aptRemarks(apt);
              const isCancelled = status.label === 'Cancelled';
              const isCompleted = status.label === 'Completed';
              const isFinished  = isCompleted || isCancelled || status.label === 'No-Show';

              return (
                <Card key={`apt-${id}`} className="card-p">
                  <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                    {/* Icon / Avatar */}
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'var(--primary-light)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      flexShrink: 0,
                    }}>
                      {isDoctor() || isReceptionist() ? <User size={20} style={{ color:'var(--primary)' }} /> : <Stethoscope size={20} style={{ color:'var(--primary)' }} />}
                    </div>

                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
                        <div>
                          <p className="font-semibold text-sm" style={{ color:'var(--foreground)' }}>
                            {getTypeName(tId)}
                          </p>
                          {isDoctor() || isReceptionist() || isAdmin() ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 3 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenPatientDetails(aptPatientId(apt));
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
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title="Click to view full patient details and medical profile"
                              >
                                <User size={11} />
                                Patient: {getPatientName(aptPatientId(apt))}
                              </button>
                              <span className="text-xs text-muted">
                                {isDoctor() ? `· ${getTypeName(tId)}` : `· Dr. ${getDoctorName(aptDoctorId(apt))} · ${getTypeName(tId)}`}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                              {getDoctorName(dId)}
                              {' · '}
                              {getTypeName(tId)}
                            </p>
                          )}
                          {remarks && (
                            <p className="text-xs text-muted" style={{ marginTop:2 }}>
                              {remarks.slice(0, 80)}{remarks.length > 80 ? '…' : ''}
                            </p>
                          )}
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>

                      <div style={{ display:'flex', alignItems:'center', gap:16, marginTop:8 }}>
                        <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--muted)' }}>
                          <Calendar size={11} />
                          {formatDate(date)}
                        </span>
                        {time && (
                          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color:'var(--muted)' }}>
                            <Clock size={11} />
                            {formatTime(time)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                      {/* Patient Details button - Doctor, Receptionist, Admin */}
                      {(isDoctor() || isReceptionist() || isAdmin()) && aptPatientId(apt) > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={User}
                          onClick={() => handleOpenPatientDetails(aptPatientId(apt))}
                        >
                          Patient
                        </Button>
                      )}

                      {/* Track On Map button - Receptionist, Doctor, Admin */}
                      {(isReceptionist() || isDoctor() || isAdmin()) && !isFinished && aptPatientId(apt) > 0 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Navigation}
                          onClick={() => handleOpenTransitTracker(apt)}
                          style={{
                            borderColor: 'rgba(5, 150, 105, 0.4)',
                            color: '#059669',
                            background: 'rgba(5, 150, 105, 0.08)',
                          }}
                          title="Track if patient is on the way via live map"
                        >
                          Track on Map
                        </Button>
                      )}

                      {/* Consultation button - receptionist & admin only, not for finished appointments */}
                      {(isReceptionist() || isAdmin()) && !isFinished && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Stethoscope}
                          loading={startingConsultationId === id}
                          onClick={() => handleStartConsultation(apt)}
                        >
                          Consultation
                        </Button>
                      )}

                      {/* View — always visible */}
                      <Button variant="ghost" size="sm" icon={Eye} onClick={() => handleView(apt)}>
                        View
                      </Button>

                      {/* Edit — admin & receptionist only; active appointments only */}
                      {(isAdmin() || isReceptionist()) && !isFinished && (
                        <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(apt)}>
                          Edit
                        </Button>
                      )}

                      {/* Cancel — patient only (their own appointment) */}
                      {isPatient() && !isFinished && (
                        <Button variant="danger" size="sm" icon={XCircle} onClick={() => handleDelete(apt)}>
                          Cancel
                        </Button>
                      )}

                      {/* Delete — admin & receptionist only; active appointments only */}
                      {(isAdmin() || isReceptionist()) && !isFinished && (
                        <Button variant="danger" size="sm" icon={XCircle} onClick={() => handleDelete(apt)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Appointment"
        subtitle="Update appointment details below."
        maxWidth={520}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button>
          </>
        }
      >
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Doctor - admin & receptionist can reassign */}
          {(isAdmin() || isReceptionist()) && (
            <div className="form-group" style={{ gridColumn:'1 / -1' }}>
              <label className="form-label">Doctor</label>
              <select
                className="form-input"
                value={editForm.doctorId}
                onChange={(e) => setEditForm((p) => ({ ...p, doctorId: Number(e.target.value) }))}
              >
                <option value={0}>Select doctor…</option>
                {doctors.map((d, idx) => {
                  const raw = d as unknown as Record<string, unknown>;
                  const did = Number(d.doctorId ?? raw.doctor_id ?? idx);
                  return (
                    <option key={`edit-doc-${did}`} value={did}>
                      {getDoctorName(did)}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Appointment Type */}
          <div className="form-group" style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Appointment Type</label>
            <select
              className="form-input"
              value={editForm.appointmentTypeId}
              onChange={(e) => setEditForm((p) => ({ ...p, appointmentTypeId: Number(e.target.value) }))}
            >
              <option value={0}>Select type…</option>
              {types.map((t, idx) => {
                const raw = t as unknown as Record<string, unknown>;
                const tid = Number(t.appointmentTypeId ?? raw.appointment_type_id ?? idx);
                return (
                  <option key={`edit-type-${tid}`} value={tid}>
                    {getTypeName(tid)}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label">Date</label>
            <input
              type="date"
              className="form-input"
              value={editForm.appointmentDate}
              onChange={(e) => setEditForm((p) => ({ ...p, appointmentDate: e.target.value }))}
            />
          </div>

          {/* Time */}
          <div className="form-group">
            <label className="form-label">Time</label>
            <input
              type="time"
              className="form-input"
              value={editForm.appointmentTime}
              onChange={(e) => setEditForm((p) => ({ ...p, appointmentTime: e.target.value }))}
            />
          </div>

          {/* Status — admin & receptionist can change status */}
          {(isAdmin() || isReceptionist()) && (
            <div className="form-group" style={{ gridColumn:'1 / -1' }}>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={editForm.statusId}
                onChange={(e) => setEditForm((p) => ({ ...p, statusId: Number(e.target.value) }))}
              >
                {Object.entries(STATUS_MAP).map(([sid, info]) => (
                  <option key={sid} value={Number(sid)}>{info.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Remarks */}
          <div className="form-group" style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Remarks / Notes</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Add notes or reason for visit…"
              value={editForm.remarks}
              onChange={(e) => setEditForm((p) => ({ ...p, remarks: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* ── View Modal ──────────────────────────────────────────────────────── */}
      <Modal
        open={viewModal}
        onClose={() => setViewModal(false)}
        title="Appointment Details"
        subtitle="Full appointment details"
        maxWidth={500}
        footer={
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', width:'100%' }}>
            {(isReceptionist() || isAdmin()) && viewTarget && (() => {
              const status = getStatus(viewTarget);
              const isFinished = status.label === 'Completed' || status.label === 'Cancelled' || status.label === 'No-Show';
              return !isFinished ? (
                <Button
                  variant="primary"
                  icon={Stethoscope}
                  loading={startingConsultationId === aptId(viewTarget)}
                  onClick={() => {
                    setViewModal(false);
                    handleStartConsultation(viewTarget);
                  }}
                >
                  Start / Open Consultation
                </Button>
              ) : null;
            })()}
            <Button variant="ghost" onClick={() => setViewModal(false)}>Close</Button>
          </div>
        }
      >
        {viewTarget && (() => {
          const status = getStatus(viewTarget);
          const rows = [
            ...((isDoctor() || isReceptionist() || isAdmin()) ? [{
              label: 'Patient',
              value: getPatientName(aptPatientId(viewTarget)),
              patientId: aptPatientId(viewTarget),
            }] : []),
            { label: 'Doctor',           value: getDoctorName(aptDoctorId(viewTarget)) },
            { label: 'Appointment Type', value: getTypeName(aptTypeId(viewTarget)) },
            { label: 'Date',             value: formatDate(aptDate(viewTarget)) },
            { label: 'Time',             value: formatTime(aptTime(viewTarget)) || '—' },
            { label: 'Status',           value: status.label, badge: status.variant },
            { label: 'Remarks',          value: aptRemarks(viewTarget) || '—' },
          ];
          return (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13.5, borderBottom:'1px solid var(--card-border)', paddingBottom:8 }}>
                  <span className="text-muted">{r.label}</span>
                  {r.badge ? (
                    <Badge variant={r.badge as 'success' | 'warning' | 'danger' | 'muted'}>{r.value}</Badge>
                  ) : (r as { patientId?: number }).patientId ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{r.value}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={User}
                        style={{ padding: '2px 8px', height: 26, fontSize: 11 }}
                        onClick={() => {
                          const pId = (r as { patientId?: number }).patientId;
                          if (pId) handleOpenPatientDetails(pId);
                        }}
                      >
                        Details
                      </Button>
                    </div>
                  ) : (
                    <span className="font-medium" style={{ color:'var(--foreground)', maxWidth:260, textAlign:'right' }}>{r.value}</span>
                  )}
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>

      {/* ── Patient Details Modal ────────────────────────────────────────────── */}
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

      {/* ── Patient Transit Tracker Map Modal ──────────────────────────────────── */}
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
