'use client';

import { useEffect, useState } from 'react';
import {
  Calendar, Search, Edit, Trash2, Eye, RefreshCw,
  CheckCircle, XCircle, Clock, User, Stethoscope, Filter,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { appointmentApi, doctorApi, appointmentTypeApi, patientApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Appointment, Doctor, AppointmentType, Patient } from '@/lib/types';

// ── Status map ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<number, { label: string; variant: 'success' | 'warning' | 'danger' | 'muted' }> = {
  1: { label: 'Scheduled',  variant: 'warning' },
  2: { label: 'Confirmed',  variant: 'success' },
  3: { label: 'Completed',  variant: 'muted'   },
  4: { label: 'Cancelled',  variant: 'danger'  },
  5: { label: 'No-Show',    variant: 'danger'  },
};

function getStatus(apt: Appointment) {
  const raw = apt as unknown as Record<string, unknown>;
  const sid = Number(apt.statusId ?? raw.status_id ?? 0);
  if (sid && STATUS_MAP[sid]) return STATUS_MAP[sid];
  const s = String(apt.status ?? '').toLowerCase();
  if (s === 'confirmed') return { label: 'Confirmed', variant: 'success' as const };
  if (s === 'completed') return { label: 'Completed', variant: 'muted'   as const };
  if (s === 'cancelled') return { label: 'Cancelled', variant: 'danger'  as const };
  return { label: 'Scheduled', variant: 'warning' as const };
}

function aptId(a: Appointment) { return Number((a as unknown as Record<string,unknown>).appointment_id ?? a.appointmentId ?? 0); }
function aptDate(a: Appointment) { return String((a as unknown as Record<string,unknown>).appointment_date ?? a.appointmentDate ?? ''); }
function aptTime(a: Appointment) { return String((a as unknown as Record<string,unknown>).appointment_time ?? a.appointmentTime ?? ''); }
function aptDoctorId(a: Appointment) { return Number((a as unknown as Record<string,unknown>).doctor_id ?? a.doctorId ?? 0); }
function aptTypeId(a: Appointment) { return Number((a as unknown as Record<string,unknown>).appointment_type_id ?? a.appointmentTypeId ?? 0); }
function aptPatientId(a: Appointment) { return Number((a as unknown as Record<string,unknown>).patient_id ?? a.patientId ?? 0); }
function aptRemarks(a: Appointment) {
  const raw = a as unknown as Record<string,unknown>;
  return String(a.remarks ?? raw.remarks ?? a.notes ?? raw.notes ?? a.reason ?? raw.reason ?? '');
}
function aptStatusId(a: Appointment) { return Number((a as unknown as Record<string,unknown>).status_id ?? a.statusId ?? 1); }

function formatDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }); }
  catch { return s; }
}
function formatTime(s: string) { return s ? s.slice(0, 5) : '—'; }

const STATUS_TABS = ['All', 'Scheduled', 'Confirmed', 'Completed', 'Cancelled'];

export default function AdminAppointmentsPage() {
  const { isAdmin, isDoctor } = useAuth();
  const router = useRouter();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('All');

  // Edit
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

  // View
  const [viewModal, setViewModal] = useState(false);
  const [viewTarget, setViewTarget] = useState<Appointment | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      appointmentApi.getAll(),
      doctorApi.getAll(),
      appointmentTypeApi.getAll(),
      patientApi.getAll().catch(() => ({ data: [] })),
    ])
      .then(([aRes, dRes, tRes, pRes]) => {
        const aData = aRes?.data;
        const aptList: Appointment[] = Array.isArray(aData)
          ? aData
          : Array.isArray(aData?.items) ? aData.items
          : Array.isArray(aData?.data) ? aData.data
          : [];

        const dData = dRes?.data;
        const docList: Doctor[] = Array.isArray(dData)
          ? dData
          : Array.isArray(dData?.items) ? dData.items
          : Array.isArray(dData?.data) ? dData.data
          : Array.isArray(dData?.doctors) ? dData.doctors : [];

        const tData = tRes?.data;
        const typeList: AppointmentType[] = Array.isArray(tData)
          ? tData
          : Array.isArray(tData?.items) ? tData.items
          : [];

        const pData = pRes?.data;
        const ptList: Patient[] = Array.isArray(pData)
          ? pData
          : Array.isArray(pData?.items) ? pData.items
          : [];

        setAppointments(aptList);
        setDoctors(docList);
        setTypes(typeList);
        setPatients(ptList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isDoctor()) {
      router.replace('/appointments');
      return;
    }
    load();
  }, [isDoctor, router]);

  const getPatientName = (pId: number) => {
    const p = patients.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.patientId ?? raw.patient_id ?? 0) === pId;
    });
    if (!p) return 'Patient';
    const raw = p as unknown as Record<string, unknown>;
    const first = String(p.firstName ?? raw.first_name ?? '').trim();
    const middle = String(p.middleName ?? raw.middle_name ?? '').trim();
    const last = String(p.lastName ?? raw.last_name ?? '').trim();
    const full = [first, middle, last].filter(Boolean).join(' ');
    return full || 'Patient';
  };

  const getDoctorName = (dId: number) => {
    const doc = doctors.find((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return Number(d.doctorId ?? raw.doctor_id) === dId;
    });
    if (!doc) return `Doctor #${dId}`;
    const raw = doc as unknown as Record<string, unknown>;
    return `Dr. ${doc.firstName ?? raw.first_name ?? ''} ${doc.lastName ?? raw.last_name ?? ''}`.trim();
  };

  const getTypeName = (tId: number) => {
    const t = types.find((x) => {
      const raw = x as unknown as Record<string, unknown>;
      return Number(x.appointmentTypeId ?? raw.appointment_type_id) === tId;
    });
    if (!t) return `Type #${tId}`;
    const raw = t as unknown as Record<string, unknown>;
    return String(t.appointmentName ?? raw.appointment_name ?? t.typeName ?? raw.type_name ?? `Type #${tId}`);
  };

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = appointments.filter((a) => {
    const status = getStatus(a);
    const matchStatus = statusTab === 'All' ? true : status.label === statusTab;
    const matchSearch = search
      ? `${aptId(a)} ${getPatientName(aptPatientId(a))} ${getDoctorName(aptDoctorId(a))} ${aptRemarks(a)} ${formatDate(aptDate(a))}`
          .toLowerCase().includes(search.toLowerCase())
      : true;
    return matchStatus && matchSearch;
  });

  // ── Edit ──────────────────────────────────────────────────────────────────

  const handleOpenEdit = (apt: Appointment) => {
    setEditTarget(apt);
    setEditForm({
      doctorId: aptDoctorId(apt),
      appointmentTypeId: aptTypeId(apt),
      appointmentDate: aptDate(apt).split('T')[0],
      appointmentTime: formatTime(aptTime(apt)),
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
        appointment_id:      id,
        appointmentId:       id,
        doctor_id:           editForm.doctorId,
        doctorId:            editForm.doctorId,
        appointment_type_id: editForm.appointmentTypeId,
        appointmentTypeId:   editForm.appointmentTypeId,
        appointment_date:    editForm.appointmentDate,
        appointmentDate:     editForm.appointmentDate,
        appointment_time:    editForm.appointmentTime ? `${editForm.appointmentTime}:00` : '',
        appointmentTime:     editForm.appointmentTime ? `${editForm.appointmentTime}:00` : '',
        status_id:           editForm.statusId,
        statusId:            editForm.statusId,
        remarks:             editForm.remarks,
        patient_id:          aptPatientId(editTarget),
        patientId:           aptPatientId(editTarget),
      });
      setEditModal(false);
      load();
    } catch {
      alert('Failed to update appointment.');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (apt: Appointment) => {
    if (!confirm(`Delete Appointment #${aptId(apt)}? This cannot be undone.`)) return;
    try {
      await appointmentApi.delete(aptId(apt));
      load();
    } catch {
      alert('Could not delete appointment.');
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = Object.entries(STATUS_MAP).map(([sid, info]) => ({
    label: info.label,
    count: appointments.filter((a) => aptStatusId(a) === Number(sid)).length,
    variant: info.variant,
  }));

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {isAdmin() ? 'Appointment Management' : 'My Patient Appointments'}
            </h1>
            <p className="page-subtitle">
              {isAdmin()
                ? 'View, edit, and manage all system appointments'
                : 'View and manage appointments assigned to you'}
            </p>
          </div>
          <Button icon={RefreshCw} variant="ghost" onClick={load}>
            Refresh
          </Button>
        </div>

        {/* Stats cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12 }}>
          <div style={{ padding:'14px 18px', borderRadius:'var(--radius)', background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
            <p style={{ fontSize:24, fontWeight:700, color:'var(--foreground)' }}>{appointments.length}</p>
            <p className="text-xs text-muted" style={{ marginTop:2 }}>Total Appointments</p>
          </div>
          {stats.map((s) => (
            <div key={s.label} style={{ padding:'14px 18px', borderRadius:'var(--radius)', background:'var(--card-bg)', border:'1px solid var(--card-border)' }}>
              <p style={{ fontSize:24, fontWeight:700, color:'var(--foreground)' }}>{s.count}</p>
              <p className="text-xs text-muted" style={{ marginTop:2 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div className="search-bar" style={{ flex:'1 1 240px', maxWidth:380 }}>
            <Search size={15} style={{ color:'var(--muted)', flexShrink:0 }} />
            <input
              placeholder="Search by doctor, patient, date, notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {STATUS_TABS.map((t) => (
              <button
                key={t}
                className={`filter-chip ${statusTab === t ? 'active' : ''}`}
                onClick={() => setStatusTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#ID</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Type</th>
                  <th>Date & Time</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((apt, index) => {
                  const id = aptId(apt);
                  const status = getStatus(apt);
                  const dId = aptDoctorId(apt);
                  const tId = aptTypeId(apt);
                  const pId = aptPatientId(apt);
                  const date = aptDate(apt);
                  const time = aptTime(apt);
                  const remarks = aptRemarks(apt);
                  const isFinished = status.label === 'Completed' || status.label === 'Cancelled' || status.label === 'No-Show';

                  return (
                    <tr key={`admin-apt-${id || index}`}>
                      <td>
                        <span className="font-mono text-sm font-semibold" style={{ color:'var(--primary)' }}>
                          #{id}
                        </span>
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <User size={13} style={{ color:'var(--muted)' }} />
                          </div>
                          <span className="text-sm font-medium">{getPatientName(pId)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--primary-light)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <Stethoscope size={13} style={{ color:'var(--primary)' }} />
                          </div>
                          <span className="text-sm">{getDoctorName(dId)}</span>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{getTypeName(tId)}</td>
                      <td>
                        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5 }}>
                            <Calendar size={11} style={{ color:'var(--primary)' }} />
                            {formatDate(date)}
                          </span>
                          {time && (
                            <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--muted)' }}>
                              <Clock size={10} />
                              {formatTime(time)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </td>
                      <td className="text-sm text-muted" style={{ maxWidth:160 }}>
                        {remarks ? remarks.slice(0, 50) + (remarks.length > 50 ? '…' : '') : '—'}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Eye}
                            onClick={() => { setViewTarget(apt); setViewModal(true); }}
                          >
                            View
                          </Button>
                          {!isFinished && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Edit}
                              onClick={() => handleOpenEdit(apt)}
                            >
                              Edit
                            </Button>
                          )}
                          {isAdmin() && !isFinished && (
                            <Button
                              variant="danger"
                              size="sm"
                              icon={Trash2}
                              onClick={() => handleDelete(apt)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', padding:'36px', color:'var(--muted)' }}>
                      <div className="empty-state">
                        <div className="empty-state-icon"><Calendar size={22} /></div>
                        <p className="empty-state-title">No appointments found</p>
                        <p className="empty-state-desc">
                          {statusTab === 'All'
                            ? 'No appointments in the system yet.'
                            : `No ${statusTab.toLowerCase()} appointments.`}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── Edit Modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit Appointment #${editTarget ? aptId(editTarget) : ''}`}
        subtitle="Update appointment details. Changes are saved immediately."
        maxWidth={540}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button loading={saving} onClick={handleSaveEdit}>Save Changes</Button>
          </>
        }
      >
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
          {/* Doctor */}
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
                  <option key={`em-doc-${did}`} value={did}>{getDoctorName(did)}</option>
                );
              })}
            </select>
          </div>

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
                  <option key={`em-type-${tid}`} value={tid}>{getTypeName(tid)}</option>
                );
              })}
            </select>
          </div>

          {/* Date */}
          <div className="form-group">
            <label className="form-label">Appointment Date</label>
            <input
              type="date"
              className="form-input"
              value={editForm.appointmentDate}
              onChange={(e) => setEditForm((p) => ({ ...p, appointmentDate: e.target.value }))}
            />
          </div>

          {/* Time */}
          <div className="form-group">
            <label className="form-label">Appointment Time</label>
            <input
              type="time"
              className="form-input"
              value={editForm.appointmentTime}
              onChange={(e) => setEditForm((p) => ({ ...p, appointmentTime: e.target.value }))}
            />
          </div>

          {/* Status */}
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

          {/* Remarks */}
          <div className="form-group" style={{ gridColumn:'1 / -1' }}>
            <label className="form-label">Remarks / Notes</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Add clinical notes or appointment remarks…"
              value={editForm.remarks}
              onChange={(e) => setEditForm((p) => ({ ...p, remarks: e.target.value }))}
            />
          </div>
        </div>
      </Modal>

      {/* ── View Modal ───────────────────────────────────────────────────────── */}
      <Modal
        open={viewModal}
        onClose={() => setViewModal(false)}
        title={`Appointment #${viewTarget ? aptId(viewTarget) : ''}`}
        subtitle="Full appointment details"
        maxWidth={480}
        footer={
          <>
            <Button
              variant="ghost"
              icon={Edit}
              onClick={() => {
                setViewModal(false);
                if (viewTarget) handleOpenEdit(viewTarget);
              }}
            >
              Edit
            </Button>
            <Button onClick={() => setViewModal(false)}>Close</Button>
          </>
        }
      >
        {viewTarget && (() => {
          const status = getStatus(viewTarget);
          const rows = [
            { label:'Appointment ID', value:`#${aptId(viewTarget)}` },
            { label:'Patient',        value: getPatientName(aptPatientId(viewTarget)) },
            { label:'Doctor',         value: getDoctorName(aptDoctorId(viewTarget)) },
            { label:'Type',           value: getTypeName(aptTypeId(viewTarget)) },
            { label:'Date',           value: formatDate(aptDate(viewTarget)) },
            { label:'Time',           value: formatTime(aptTime(viewTarget)) || '—' },
            { label:'Status',         value: status.label, badge: status.variant },
            { label:'Remarks',        value: aptRemarks(viewTarget) || '—' },
          ];
          return (
            <div className="space-y-3">
              {rows.map((r) => (
                <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13.5, borderBottom:'1px solid var(--card-border)', paddingBottom:8 }}>
                  <span className="text-muted font-medium" style={{ minWidth:130 }}>{r.label}</span>
                  {r.badge
                    ? <Badge variant={r.badge as 'success' | 'warning' | 'danger' | 'muted'}>{r.value}</Badge>
                    : <span className="font-medium" style={{ color:'var(--foreground)', maxWidth:260, textAlign:'right' }}>{r.value}</span>
                  }
                </div>
              ))}
            </div>
          );
        })()}
      </Modal>
    </AppLayout>
  );
}
