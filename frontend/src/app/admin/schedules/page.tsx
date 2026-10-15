'use client';

import { useEffect, useState } from 'react';
import { Calendar, Plus, Search, Edit, Trash2, Clock, CheckCircle, XCircle, Stethoscope } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { doctorScheduleApi, doctorApi } from '@/lib/api';
import type { DoctorSchedule, Doctor } from '@/lib/types';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default function AdminDoctorSchedulesPage() {
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterDoctor, setFilterDoctor] = useState<number>(0);
  const [modal, setModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    doctorId: 0,
    dayOfWeek: 'Monday',
    startTime: '08:00',
    endTime: '17:00',
    slotDuration: 30,
    maxAppointments: 16,
    isActive: true,
  });

  const loadData = () => {
    setLoading(true);
    Promise.all([doctorScheduleApi.getAll(), doctorApi.getAll()])
      .then(([schRes, docRes]) => {
        const schData = schRes?.data;
        const schList: DoctorSchedule[] = Array.isArray(schData)
          ? schData
          : Array.isArray(schData?.items)
          ? schData.items
          : Array.isArray(schData?.data)
          ? schData.data
          : [];

        const docData = docRes?.data;
        const docList: Doctor[] = Array.isArray(docData)
          ? docData
          : Array.isArray(docData?.items)
          ? docData.items
          : Array.isArray(docData?.data)
          ? docData.data
          : Array.isArray(docData?.doctors)
          ? docData.doctors
          : [];

        setSchedules(schList);
        setDoctors(docList);
      })
      .catch((err) => console.error('Failed to load schedule data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setEditingSchedule(null);
    setForm({
      doctorId: doctors[0] ? Number(doctors[0].doctorId ?? (doctors[0] as unknown as Record<string, number>).doctor_id ?? 0) : 0,
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '17:00',
      slotDuration: 30,
      maxAppointments: 16,
      isActive: true,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    if (doctors.length > 0) {
      const firstDocId = Number(doctors[0].doctorId ?? (doctors[0] as unknown as Record<string, number>).doctor_id ?? 0);
      setForm((p) => ({ ...p, doctorId: firstDocId }));
    }
    setModal(true);
  };

  const handleOpenEdit = (schedule: DoctorSchedule) => {
    const raw = schedule as unknown as Record<string, unknown>;
    const sId = Number(schedule.scheduleId ?? raw.schedule_id ?? 0);
    const docId = Number(schedule.doctorId ?? raw.doctor_id ?? 0);
    const day = String(schedule.dayOfWeek ?? raw.day_of_week ?? 'Monday');
    const start = String(schedule.startTime ?? raw.start_time ?? '08:00');
    const end = String(schedule.endTime ?? raw.end_time ?? '17:00');
    const duration = Number(schedule.slotDuration ?? raw.slot_duration ?? 30);
    const maxApp = Number(schedule.maxAppointments ?? raw.max_appointments ?? 16);
    const active = Boolean(schedule.isActive ?? raw.is_active ?? true);

    setEditingSchedule(schedule);
    setForm({
      doctorId: docId,
      dayOfWeek: day,
      startTime: start,
      endTime: end,
      slotDuration: duration,
      maxAppointments: maxApp,
      isActive: active,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.doctorId || form.doctorId <= 0) {
      alert('Please select a valid doctor.');
      return;
    }
    if (!form.dayOfWeek) {
      alert('Day of week is required.');
      return;
    }
    if (!form.startTime || !form.endTime) {
      alert('Start time and end time are required.');
      return;
    }
    if (form.slotDuration <= 0) {
      alert('Slot duration must be greater than 0.');
      return;
    }

    setSaving(true);
    const payload = {
      doctorId: form.doctorId,
      doctor_id: form.doctorId,
      dayOfWeek: form.dayOfWeek,
      day_of_week: form.dayOfWeek,
      startTime: form.startTime,
      start_time: form.startTime,
      endTime: form.endTime,
      end_time: form.endTime,
      slotDuration: form.slotDuration,
      slot_duration: form.slotDuration,
      maxAppointments: form.maxAppointments,
      max_appointments: form.maxAppointments,
      isActive: form.isActive,
      is_active: form.isActive ? 1 : 0,
    };

    try {
      if (editingSchedule) {
        const raw = editingSchedule as unknown as Record<string, unknown>;
        const schId = Number(editingSchedule.scheduleId ?? raw.schedule_id ?? 0);
        await doctorScheduleApi.update(schId, {
          scheduleId: schId,
          schedule_id: schId,
          ...payload,
        });
      } else {
        await doctorScheduleApi.create(payload);
      }

      setModal(false);
      resetForm();
      loadData();
    } catch (err) {
      console.error('Failed to save doctor schedule:', err);
      alert(editingSchedule ? 'Failed to update schedule.' : 'Failed to create schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this schedule entry?')) return;
    try {
      await doctorScheduleApi.delete(id);
      loadData();
    } catch {
      alert('Could not delete schedule.');
    }
  };

  const getDoctorName = (docId: number): { name: string; initials: string; spec: string; pic: string } => {
    const doc = doctors.find((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return Number(d.doctorId ?? raw.doctor_id ?? 0) === docId;
    });

    if (!doc) return { name: `Doctor #${docId}`, initials: 'DR', spec: 'General', pic: '' };

    const rawDoc = doc as unknown as Record<string, unknown>;
    const first = String(doc.firstName ?? rawDoc.first_name ?? '');
    const last = String(doc.lastName ?? rawDoc.last_name ?? '');
    const name = `Dr. ${first} ${last}`.trim() || `Doctor #${docId}`;
    const initials = `${first[0] ?? 'D'}${last[0] ?? 'R'}`.toUpperCase();
    const spec = String(doc.specialtyName ?? rawDoc.specialty_name ?? 'Specialist');
    const pic = String(doc.profilePicturePath || rawDoc.profile_picture_path || '');

    return { name, initials, spec, pic };
  };

  const filtered = schedules.filter((s) => {
    const raw = s as unknown as Record<string, unknown>;
    const docId = Number(s.doctorId ?? raw.doctor_id ?? 0);
    const day = String(s.dayOfWeek ?? raw.day_of_week ?? '');
    const docInfo = getDoctorName(docId);

    const matchSearch = search
      ? docInfo.name.toLowerCase().includes(search.toLowerCase()) ||
        day.toLowerCase().includes(search.toLowerCase())
      : true;

    const matchDay = filterDay ? day.toLowerCase() === filterDay.toLowerCase() : true;
    const matchDoctor = filterDoctor ? docId === filterDoctor : true;

    return matchSearch && matchDay && matchDoctor;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Doctor Schedules</h1>
            <p className="page-subtitle">Manage doctor weekly shifts, working hours, and appointment slots</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Schedule
          </Button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              placeholder="Search by doctor name or day…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-input"
            style={{ width: 180, padding: '8px 12px' }}
            value={filterDoctor}
            onChange={(e) => setFilterDoctor(Number(e.target.value))}
          >
            <option value={0}>All Doctors</option>
            {doctors.map((d, idx) => {
              const rawDoc = d as unknown as Record<string, unknown>;
              const did = Number(d.doctorId ?? rawDoc.doctor_id ?? idx);
              const name = getDoctorName(did).name;
              return (
                <option key={`doc-opt-fltr-${did}-${idx}`} value={did}>
                  {name}
                </option>
              );
            })}
          </select>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className={`filter-chip ${filterDay === '' ? 'active' : ''}`}
              onClick={() => setFilterDay('')}
            >
              All Days
            </button>
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={`day-fltr-${day}`}
                className={`filter-chip ${filterDay === day ? 'active' : ''}`}
                onClick={() => setFilterDay(day)}
              >
                {day.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Day of Week</th>
                  <th>Working Hours</th>
                  <th>Slot Duration</th>
                  <th>Max Appointments</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, index) => {
                  const raw = s as unknown as Record<string, unknown>;
                  const schId = Number(s.scheduleId ?? raw.schedule_id ?? index);
                  const docId = Number(s.doctorId ?? raw.doctor_id ?? 0);
                  const day = String(s.dayOfWeek ?? raw.day_of_week ?? 'Monday');
                  const startTime = String(s.startTime ?? raw.start_time ?? '08:00');
                  const endTime = String(s.endTime ?? raw.end_time ?? '17:00');
                  const duration = Number(s.slotDuration ?? raw.slot_duration ?? 30);
                  const maxApp = Number(s.maxAppointments ?? raw.max_appointments ?? 0);
                  const isActive = Boolean(s.isActive ?? raw.is_active ?? true);

                  const docInfo = getDoctorName(docId);

                  return (
                    <tr key={`sch-row-${schId || index}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar
                            initials={docInfo.initials}
                            src={docInfo.pic}
                            size="sm"
                            zoomable={true}
                            title={docInfo.name}
                            subtitle={docInfo.spec}
                          />
                          <div>
                            <p className="font-medium text-sm">{docInfo.name}</p>
                            <p className="text-xs text-muted">{docInfo.spec}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                          {day}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={14} style={{ color: 'var(--primary)' }} />
                          <span className="text-sm font-medium">
                            {startTime} - {endTime}
                          </span>
                        </div>
                      </td>
                      <td className="text-sm text-muted">
                        {duration} mins / slot
                      </td>
                      <td className="text-sm font-medium">
                        {maxApp} slots
                      </td>
                      <td>
                        {isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="muted">Inactive</Badge>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            onClick={() => handleOpenEdit(s)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(schId)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                      <div className="empty-state">
                        <div className="empty-state-icon">
                          <Calendar size={22} />
                        </div>
                        <p className="empty-state-title">No doctor schedules found</p>
                        <p className="empty-state-desc">Click "Add Schedule" to create a new weekly shift.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* Modal */}
      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          resetForm();
        }}
        title={editingSchedule ? 'Edit Doctor Schedule' : 'Add Doctor Schedule'}
        subtitle={
          editingSchedule
            ? 'Update working hours, shift days, or slot parameters.'
            : 'Assign working days and appointment slots to a doctor.'
        }
        maxWidth={540}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Doctor Dropdown */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Doctor *</label>
            <select
              className="form-input"
              value={form.doctorId}
              onChange={(e) => setForm((p) => ({ ...p, doctorId: Number(e.target.value) }))}
            >
              <option value={0}>Select Doctor…</option>
              {doctors.map((d, idx) => {
                const rawDoc = d as unknown as Record<string, unknown>;
                const did = Number(d.doctorId ?? rawDoc.doctor_id ?? idx);
                const name = getDoctorName(did).name;
                return (
                  <option key={`modal-doc-opt-${did}-${idx}`} value={did}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Day of Week */}
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Day of Week *</label>
            <select
              className="form-input"
              value={form.dayOfWeek}
              onChange={(e) => setForm((p) => ({ ...p, dayOfWeek: e.target.value }))}
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={`opt-day-${day}`} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </div>

          {/* Start Time */}
          <div className="form-group">
            <label className="form-label">Start Time *</label>
            <input
              type="text"
              className="form-input"
              placeholder="08:00"
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
            />
          </div>

          {/* End Time */}
          <div className="form-group">
            <label className="form-label">End Time *</label>
            <input
              type="text"
              className="form-input"
              placeholder="17:00"
              value={form.endTime}
              onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
            />
          </div>

          {/* Slot Duration */}
          <div className="form-group">
            <label className="form-label">Slot Duration (Minutes) *</label>
            <select
              className="form-input"
              value={form.slotDuration}
              onChange={(e) => setForm((p) => ({ ...p, slotDuration: Number(e.target.value) }))}
            >
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes (1 hr)</option>
            </select>
          </div>

          {/* Max Appointments */}
          <div className="form-group">
            <label className="form-label">Max Appointments *</label>
            <input
              type="number"
              min={1}
              className="form-input"
              placeholder="16"
              value={form.maxAppointments}
              onChange={(e) => setForm((p) => ({ ...p, maxAppointments: Number(e.target.value) }))}
            />
          </div>

          {/* Active Status */}
          <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: 4 }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)' }}
              />
              <span className="text-sm font-medium">Active Schedule</span>
            </label>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
