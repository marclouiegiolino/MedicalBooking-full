'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Calendar, Plus, Search, Edit, Trash2, Clock, CheckCircle,
  XCircle, Stethoscope, Filter, User, ArrowRight, Eye, Building2,
  Users, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { doctorScheduleApi, doctorApi, specialtyApi, departmentApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { DoctorSchedule, Doctor, Specialty, Department } from '@/lib/types';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const DAY_ORDER: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

const DAY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Monday:    { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', border: 'rgba(59, 130, 246, 0.2)' },
  Tuesday:   { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6', border: 'rgba(139, 92, 246, 0.2)' },
  Wednesday: { bg: 'rgba(236, 72, 153, 0.1)', text: '#ec4899', border: 'rgba(236, 72, 153, 0.2)' },
  Thursday:  { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.2)' },
  Friday:    { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', border: 'rgba(16, 185, 129, 0.2)' },
  Saturday:  { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366f1', border: 'rgba(99, 102, 241, 0.2)' },
  Sunday:    { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.2)' },
};

export default function DoctorSchedulesPage() {
  const { isAdmin, isPatient, isDoctor, user } = useAuth();
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState<number | 'all'>('all');

  // Details Modal State (Doctor View Details)
  const [selectedDoctorForDetails, setSelectedDoctorForDetails] = useState<Doctor | null>(null);

  // Admin Create/Edit Modal State
  const [modal, setModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DoctorSchedule | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

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
    Promise.allSettled([
      isAdmin() ? doctorScheduleApi.getAll() : doctorScheduleApi.getMine(),
      doctorApi.getAll(),
      specialtyApi.getAll(),
      departmentApi.getAll(),
    ])
      .then(([schRes, docRes, spRes, deptRes]) => {
        if (schRes.status === 'fulfilled') {
          const schData = schRes.value?.data;
          const schList: DoctorSchedule[] = Array.isArray(schData)
            ? schData
            : Array.isArray(schData?.items)
            ? schData.items
            : [];
          setSchedules(schList);
        }

        if (docRes.status === 'fulfilled') {
          const docData = docRes.value?.data;
          const docList: Doctor[] = Array.isArray(docData)
            ? docData
            : Array.isArray(docData?.items)
            ? docData.items
            : [];
          setDoctors(docList);
        }

        if (spRes.status === 'fulfilled') {
          const spData = spRes.value?.data;
          setSpecialties(Array.isArray(spData) ? spData : Array.isArray(spData?.items) ? spData.items : []);
        }

        if (deptRes.status === 'fulfilled') {
          const deptData = deptRes.value?.data;
          setDepartments(Array.isArray(deptData) ? deptData : Array.isArray(deptData?.items) ? deptData.items : []);
        }
      })
      .catch((err) => console.error('Error loading schedule data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDoctor = (doctorId: number): Doctor | undefined => {
    return doctors.find((d) => {
      const raw = d as unknown as Record<string, number>;
      return Number(d.doctorId ?? raw.doctor_id) === doctorId;
    });
  };

  const getDoctorSpecialty = (doctorId: number): string => {
    const doc = getDoctor(doctorId);
    if (!doc) return 'General Practice';
    if (doc.specialtyName) return doc.specialtyName;
    const raw = doc as unknown as Record<string, unknown>;
    const spId = Number(doc.specialtyId ?? raw.specialty_id);
    const sp = specialties.find((s) => Number(s.specialtyId ?? (s as any).specialty_id) === spId);
    return sp?.specialtyName ?? 'Specialist';
  };

  const getDoctorDepartment = (doctorId: number): string => {
    const doc = getDoctor(doctorId);
    if (!doc) return 'General';
    if (doc.departmentName) return doc.departmentName;
    const raw = doc as unknown as Record<string, unknown>;
    const deptId = Number(doc.departmentId ?? raw.department_id);
    const dept = departments.find((d) => Number(d.departmentId ?? (d as any).department_id) === deptId);
    return dept?.departmentName ?? 'General Department';
  };

  const currentDoctor = useMemo(() => {
    if (!isDoctor() || !user) return null;
    return doctors.find((d) => {
      const raw = d as unknown as Record<string, number>;
      return Number(d.userId ?? raw.user_id) === user.userId;
    }) ?? null;
  }, [isDoctor, user, doctors]);

  const resetForm = (preselectedDoctorId?: number) => {
    setEditingSchedule(null);
    const firstDocId = preselectedDoctorId || (doctors[0] ? Number(doctors[0].doctorId ?? (doctors[0] as any).doctor_id ?? 0) : 0);
    setForm({
      doctorId: firstDocId,
      dayOfWeek: 'Monday',
      startTime: '08:00',
      endTime: '17:00',
      slotDuration: 30,
      maxAppointments: 16,
      isActive: true,
    });
  };

  const handleOpenCreate = (doctorId?: number) => {
    resetForm(doctorId);
    setModal(true);
  };

  const handleOpenEdit = (schedule: DoctorSchedule) => {
    const raw = schedule as unknown as Record<string, any>;
    setEditingSchedule(schedule);
    setForm({
      doctorId: Number(schedule.doctorId ?? raw.doctor_id ?? 0),
      dayOfWeek: schedule.dayOfWeek || raw.day_of_week || 'Monday',
      startTime: schedule.startTime || raw.start_time || '08:00',
      endTime: schedule.endTime || raw.end_time || '17:00',
      slotDuration: Number(schedule.slotDuration ?? raw.slot_duration ?? 30),
      maxAppointments: Number(schedule.maxAppointments ?? raw.max_appointments ?? 16),
      isActive: schedule.isActive ?? raw.is_active ?? true,
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (form.doctorId <= 0) {
      alert('Please select a doctor.');
      return;
    }

    setSaving(true);
    try {
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
        is_active: form.isActive,
      };

      if (editingSchedule) {
        const raw = editingSchedule as unknown as Record<string, number>;
        const id = Number(editingSchedule.scheduleId ?? raw.schedule_id);
        await doctorScheduleApi.update(id, payload);
      } else {
        await doctorScheduleApi.create(payload);
      }

      setModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to save doctor schedule.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await doctorScheduleApi.delete(id);
      setDeleteConfirmId(null);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete schedule.');
    }
  };

  // ─── Group Schedules by Doctor ──────────────────────────────────────────────
  interface DoctorScheduleGroup {
    doctor: Doctor;
    doctorId: number;
    doctorName: string;
    specialty: string;
    department: string;
    schedules: DoctorSchedule[];
    activeCount: number;
    totalMaxWeeklyPatients: number;
  }

  const doctorGroups = useMemo<DoctorScheduleGroup[]>(() => {
    const groupsMap = new Map<number, DoctorScheduleGroup>();

    // Initialise with all known doctors (or just current doctor if logged in as doctor)
    doctors.forEach((doc) => {
      const raw = doc as unknown as Record<string, number>;
      const docId = Number(doc.doctorId ?? raw.doctor_id ?? 0);
      if (docId <= 0) return;

      if (isDoctor() && currentDoctor) {
        const myDocId = Number(currentDoctor.doctorId ?? (currentDoctor as any).doctor_id);
        if (docId !== myDocId) return;
      }

      const docName = `Dr. ${doc.firstName || ''} ${doc.lastName || ''}`.trim() || `Doctor #${docId}`;
      const specialty = getDoctorSpecialty(docId);
      const department = getDoctorDepartment(docId);

      groupsMap.set(docId, {
        doctor: doc,
        doctorId: docId,
        doctorName: docName,
        specialty,
        department,
        schedules: [],
        activeCount: 0,
        totalMaxWeeklyPatients: 0,
      });
    });

    // Populate schedules into each doctor group
    schedules.forEach((s) => {
      const raw = s as unknown as Record<string, any>;
      const docId = Number(s.doctorId ?? raw.doctor_id ?? 0);
      if (docId <= 0) return;

      let group = groupsMap.get(docId);
      if (!group) {
        // In case doctor is not in doctor table list
        const doc = getDoctor(docId) ?? ({ doctorId: docId, firstName: `Doctor #${docId}`, lastName: '' } as unknown as Doctor);
        group = {
          doctor: doc,
          doctorId: docId,
          doctorName: `Doctor #${docId}`,
          specialty: getDoctorSpecialty(docId),
          department: getDoctorDepartment(docId),
          schedules: [],
          activeCount: 0,
          totalMaxWeeklyPatients: 0,
        };
        groupsMap.set(docId, group);
      }

      group.schedules.push(s);
      const isActive = s.isActive ?? raw.is_active ?? true;
      if (isActive) {
        group.activeCount += 1;
        group.totalMaxWeeklyPatients += Number(s.maxAppointments ?? raw.max_appointments ?? 0);
      }
    });

    // Sort schedules inside each doctor group by day of the week
    groupsMap.forEach((group) => {
      group.schedules.sort((a, b) => {
        const rawA = a as unknown as Record<string, any>;
        const rawB = b as unknown as Record<string, any>;
        const dayA = a.dayOfWeek || rawA.day_of_week || 'Monday';
        const dayB = b.dayOfWeek || rawB.day_of_week || 'Monday';
        return (DAY_ORDER[dayA] || 99) - (DAY_ORDER[dayB] || 99);
      });
    });

    return Array.from(groupsMap.values());
  }, [doctors, schedules, specialties, departments, isDoctor, currentDoctor]);

  // ─── Filtered Doctor Groups ────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    return doctorGroups.filter((group) => {
      // Search matching (doctor name, specialty, or any scheduled day)
      const matchSearch =
        !search ||
        group.doctorName.toLowerCase().includes(search.toLowerCase()) ||
        group.specialty.toLowerCase().includes(search.toLowerCase()) ||
        group.schedules.some((s) => {
          const raw = s as unknown as Record<string, any>;
          const day = s.dayOfWeek || raw.day_of_week || '';
          return day.toLowerCase().includes(search.toLowerCase());
        });

      // Filter by day
      const matchDay =
        !filterDay ||
        group.schedules.some((s) => {
          const raw = s as unknown as Record<string, any>;
          const day = s.dayOfWeek || raw.day_of_week || '';
          return day.toLowerCase() === filterDay.toLowerCase();
        });

      // Filter by specialty
      const rawDoc = group.doctor as unknown as Record<string, any>;
      const docSpId = Number(group.doctor.specialtyId ?? rawDoc.specialty_id ?? 0);
      const matchSpecialty = filterSpecialty === 'all' || docSpId === filterSpecialty;

      return matchSearch && matchDay && matchSpecialty;
    });
  }, [doctorGroups, search, filterDay, filterSpecialty]);

  // Active selected doctor schedules for Details modal
  const selectedDoctorSchedules = useMemo(() => {
    if (!selectedDoctorForDetails) return [];
    const docId = Number(selectedDoctorForDetails.doctorId ?? (selectedDoctorForDetails as any).doctor_id ?? 0);
    const group = doctorGroups.find((g) => g.doctorId === docId);
    return group ? group.schedules : [];
  }, [selectedDoctorForDetails, doctorGroups]);

  return (
    <AppLayout>
      <div className="space-y-5" style={{ paddingBottom: 64 }}>
        {/* Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">
              {isDoctor() ? 'My Clinic Schedule' : 'Doctor Schedules'}
            </h1>
            <p className="page-subtitle">
              {isDoctor()
                ? 'Your weekly consultation hours, slot durations, and active duty schedule'
                : isAdmin()
                ? 'Manage doctor weekly duty schedules, consultation hours, and slot durations grouped by physician'
                : 'View weekly clinic hours and availability for all attending physicians'}
            </p>
          </div>
          {isAdmin() && (
            <Button icon={Plus} onClick={() => handleOpenCreate()}>
              Add Schedule
            </Button>
          )}
        </div>

        {/* Filters Bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: '1 1 240px', maxWidth: 360 }}>
            <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <input
              placeholder={isDoctor() ? 'Search by day…' : 'Search by doctor, specialty, or day…'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-input"
            style={{ width: 'auto', minWidth: 160 }}
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All Specialties</option>
            {specialties.map((sp) => {
              const id = Number(sp.specialtyId ?? (sp as any).specialty_id);
              return (
                <option key={`sp-${id}`} value={id}>
                  {sp.specialtyName}
                </option>
              );
            })}
          </select>

          <select
            className="form-input"
            style={{ width: 'auto', minWidth: 140 }}
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
          >
            <option value="">All Days</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
            {filteredGroups.length} doctor{filteredGroups.length !== 1 ? 's' : ''} listed
          </span>
        </div>

        {/* Doctor Schedules Grouped Grid */}
        {loading ? (
          <Spinner center />
        ) : filteredGroups.length === 0 ? (
          <Card>
            <div className="empty-state">
              <div className="empty-state-icon"><Calendar size={24} /></div>
              <p className="empty-state-title">No doctor schedules found</p>
              <p className="empty-state-desc">
                {search || filterDay || filterSpecialty !== 'all'
                  ? 'Try clearing your search or filters to see more results.'
                  : 'Doctor duty schedules will appear here once configured.'}
              </p>
              {isAdmin() && (
                <Button icon={Plus} onClick={() => handleOpenCreate()} style={{ marginTop: 8 }}>
                  Create First Schedule
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="grid-2">
            {filteredGroups.map((group) => {
              const { doctor, doctorId, doctorName, specialty, department, schedules: docSchedules, activeCount, totalMaxWeeklyPatients } = group;
              const hasSchedules = docSchedules.length > 0;
              const initials = doctor.firstName && doctor.lastName
                ? `${doctor.firstName[0]}${doctor.lastName[0]}`.toUpperCase()
                : 'DR';

              return (
                <Card
                  key={`doc-group-${doctorId}`}
                  className="card-p"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  {/* Doctor Info Header */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 48, height: 48, borderRadius: '50%',
                          background: 'var(--primary-light)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'var(--primary)', flexShrink: 0
                        }}>
                          <Stethoscope size={22} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base" style={{ color: 'var(--foreground)', margin: 0 }}>
                            {doctorName}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                            <span className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                              {specialty}
                            </span>
                            <span className="text-xs text-muted">•</span>
                            <span className="text-xs text-muted">
                              {department}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <Badge variant={activeCount > 0 ? 'success' : hasSchedules ? 'muted' : 'warning'}>
                        {activeCount > 0 ? `${activeCount} Active Shift${activeCount > 1 ? 's' : ''}` : hasSchedules ? 'Inactive' : 'No Schedule'}
                      </Badge>
                    </div>

                    {/* Weekly Schedule Pills List */}
                    <div style={{ marginTop: 16 }}>
                      <p className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        Weekly Consultation Hours
                      </p>

                      {hasSchedules ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {docSchedules.map((s) => {
                            const raw = s as unknown as Record<string, any>;
                            const schId = Number(s.scheduleId ?? raw.schedule_id);
                            const day = s.dayOfWeek || raw.day_of_week || 'Monday';
                            const start = s.startTime || raw.start_time || '08:00';
                            const end = s.endTime || raw.end_time || '17:00';
                            const slot = Number(s.slotDuration ?? raw.slot_duration ?? 30);
                            const maxApt = Number(s.maxAppointments ?? raw.max_appointments ?? 16);
                            const active = s.isActive ?? raw.is_active ?? true;
                            const dayColor = DAY_COLORS[day] ?? { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.2)' };

                            return (
                              <div
                                key={`pill-${schId}`}
                                style={{
                                  padding: '8px 12px',
                                  borderRadius: 'var(--radius)',
                                  background: active ? dayColor.bg : 'var(--muted-bg)',
                                  border: `1px solid ${active ? dayColor.border : 'var(--card-border)'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 8,
                                  opacity: active ? 1 : 0.65,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontWeight: 700, fontSize: 13, color: active ? dayColor.text : 'var(--muted)', minWidth: 85 }}>
                                    {day}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <Clock size={13} style={{ color: active ? dayColor.text : 'var(--muted)' }} />
                                    {start} – {end}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                                  <span>{slot}m slot</span>
                                  <span>•</span>
                                  <span>{maxApt} max</span>
                                  {!active && <Badge variant="muted">Off</Badge>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{
                          padding: '16px',
                          background: 'var(--muted-bg)',
                          borderRadius: 'var(--radius)',
                          textAlign: 'center',
                          color: 'var(--muted)',
                          fontSize: 13,
                        }}>
                          No weekly duty schedules configured yet.
                        </div>
                      )}
                    </div>

                    {/* Summary Stats Row */}
                    {hasSchedules && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                        marginTop: 12,
                        fontSize: 12,
                      }}>
                        <div style={{ padding: '6px 10px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--muted)' }}>
                          <span>Total Duty Days:</span>{' '}
                          <strong style={{ color: 'var(--foreground)' }}>{docSchedules.length} days/week</strong>
                        </div>
                        <div style={{ padding: '6px 10px', background: 'var(--accent)', borderRadius: 'var(--radius)', color: 'var(--muted)' }}>
                          <span>Weekly Capacity:</span>{' '}
                          <strong style={{ color: 'var(--foreground)' }}>{totalMaxWeeklyPatients} patients</strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid var(--card-border)',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}>
                    {/* View Details Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Eye}
                      onClick={() => setSelectedDoctorForDetails(doctor)}
                    >
                      View Details ({docSchedules.length})
                    </Button>

                    <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                      {isAdmin() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Plus}
                          onClick={() => handleOpenCreate(doctorId)}
                        >
                          Add Shift
                        </Button>
                      )}

                      {isPatient() && (
                        <Link href={`/appointments/book?doctorId=${doctorId}`} style={{ textDecoration: 'none' }}>
                          <Button variant="primary" size="sm" icon={ArrowRight}>
                            Book
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── View Details Modal ────────────────────────────────────────────── */}
        <Modal
          open={selectedDoctorForDetails !== null}
          onClose={() => setSelectedDoctorForDetails(null)}
          title={
            selectedDoctorForDetails
              ? `Dr. ${selectedDoctorForDetails.firstName} ${selectedDoctorForDetails.lastName} — Schedules`
              : 'Doctor Schedule Details'
          }
          subtitle="Full breakdown of consultation slots, active duty days, and working hours."
          maxWidth={680}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div>
                {isAdmin() && selectedDoctorForDetails && (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={() => {
                      const docId = Number(selectedDoctorForDetails.doctorId ?? (selectedDoctorForDetails as any).doctor_id);
                      handleOpenCreate(docId);
                    }}
                  >
                    Add New Shift
                  </Button>
                )}
              </div>
              <Button variant="ghost" onClick={() => setSelectedDoctorForDetails(null)}>
                Close
              </Button>
            </div>
          }
        >
          {selectedDoctorForDetails && (
            <div className="space-y-4">
              {/* Doctor Overview Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '14px 16px',
                background: 'var(--accent)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--accent-border)',
              }}>
                <div style={{
                  width: 46, height: 46, borderRadius: '50%',
                  background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', flexShrink: 0,
                }}>
                  <Stethoscope size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
                    Dr. {selectedDoctorForDetails.firstName} {selectedDoctorForDetails.lastName}
                  </h4>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    {getDoctorSpecialty(Number(selectedDoctorForDetails.doctorId ?? (selectedDoctorForDetails as any).doctor_id))} • {getDoctorDepartment(Number(selectedDoctorForDetails.doctorId ?? (selectedDoctorForDetails as any).doctor_id))}
                  </p>
                </div>
                {selectedDoctorForDetails.consultationFee !== undefined && selectedDoctorForDetails.consultationFee > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <span className="text-xs text-muted">Consultation Fee</span>
                    <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)', margin: 0 }}>
                      ${selectedDoctorForDetails.consultationFee.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              {/* Schedules Table */}
              <div>
                <h5 style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Weekly Shifts ({selectedDoctorSchedules.length})
                </h5>

                {selectedDoctorSchedules.length === 0 ? (
                  <div style={{
                    padding: '32px',
                    textAlign: 'center',
                    background: 'var(--muted-bg)',
                    borderRadius: 'var(--radius)',
                    color: 'var(--muted)',
                  }}>
                    <Calendar size={24} style={{ margin: '0 auto 8px', opacity: 0.6 }} />
                    <p style={{ fontWeight: 600, fontSize: 14 }}>No schedules found</p>
                    <p style={{ fontSize: 12, marginTop: 2 }}>This doctor does not have any working shifts registered yet.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>Working Hours</th>
                          <th>Slot Duration</th>
                          <th>Capacity</th>
                          <th>Status</th>
                          {isAdmin() && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedDoctorSchedules.map((s) => {
                          const raw = s as unknown as Record<string, any>;
                          const schId = Number(s.scheduleId ?? raw.schedule_id);
                          const day = s.dayOfWeek || raw.day_of_week || 'Monday';
                          const start = s.startTime || raw.start_time || '08:00';
                          const end = s.endTime || raw.end_time || '17:00';
                          const slot = Number(s.slotDuration ?? raw.slot_duration ?? 30);
                          const maxApt = Number(s.maxAppointments ?? raw.max_appointments ?? 16);
                          const active = s.isActive ?? raw.is_active ?? true;
                          const dayColor = DAY_COLORS[day] ?? { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.2)' };

                          return (
                            <tr key={`modal-row-${schId}`}>
                              <td>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '4px 10px',
                                    borderRadius: 'var(--radius-full)',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: dayColor.bg,
                                    color: dayColor.text,
                                    border: `1px solid ${dayColor.border}`,
                                  }}
                                >
                                  {day}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
                                  <Clock size={14} style={{ color: 'var(--primary)' }} />
                                  {start} – {end}
                                </div>
                              </td>
                              <td>
                                <span className="text-sm">{slot} mins</span>
                              </td>
                              <td>
                                <span className="text-sm font-medium">{maxApt} patients</span>
                              </td>
                              <td>
                                <Badge variant={active ? 'success' : 'muted'}>
                                  {active ? 'Active' : 'Inactive'}
                                </Badge>
                              </td>
                              {isAdmin() && (
                                <td>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      icon={Edit}
                                      onClick={() => {
                                        setSelectedDoctorForDetails(null);
                                        handleOpenEdit(s);
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      icon={Trash2}
                                      onClick={() => {
                                        setDeleteConfirmId(schId);
                                      }}
                                    >
                                      Delete
                                    </Button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ── Admin Create / Edit Modal ────────────────────────────────────── */}
        {isAdmin() && (
          <Modal
            open={modal}
            onClose={() => setModal(false)}
            title={editingSchedule ? 'Edit Doctor Schedule' : 'Add Doctor Schedule'}
            subtitle="Configure doctor duty days, consultation hours, and slot limits."
            maxWidth={520}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
                <Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button>
                <Button variant="primary" loading={saving} onClick={handleSave}>
                  {editingSchedule ? 'Save Changes' : 'Create Schedule'}
                </Button>
              </div>
            }
          >
            <div className="space-y-4">
              {/* Doctor Selector */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Doctor</label>
                <select
                  className="form-input"
                  value={form.doctorId}
                  onChange={(e) => setForm((p) => ({ ...p, doctorId: Number(e.target.value) }))}
                >
                  <option value={0}>— Select Doctor —</option>
                  {doctors.map((d) => {
                    const raw = d as unknown as Record<string, number>;
                    const did = Number(d.doctorId ?? raw.doctor_id);
                    return (
                      <option key={did} value={did}>
                        Dr. {d.firstName} {d.lastName}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Day of Week */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Day of Week</label>
                <select
                  className="form-input"
                  value={form.dayOfWeek}
                  onChange={(e) => setForm((p) => ({ ...p, dayOfWeek: e.target.value }))}
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Time Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Start Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.startTime}
                    onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>End Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={form.endTime}
                    onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Slot Duration & Max Appointments */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Slot Duration (mins)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    className="form-input"
                    value={form.slotDuration}
                    onChange={(e) => setForm((p) => ({ ...p, slotDuration: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Max Appointments</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    className="form-input"
                    value={form.maxAppointments}
                    onChange={(e) => setForm((p) => ({ ...p, maxAppointments: Number(e.target.value) }))}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6 }}>
                <input
                  type="checkbox"
                  id="schedule-active-check"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="schedule-active-check" style={{ fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  Schedule is active for appointments
                </label>
              </div>
            </div>
          </Modal>
        )}

        {/* ── Admin Delete Confirmation Modal ──────────────────────────────── */}
        {isAdmin() && (
          <Modal
            open={deleteConfirmId !== null}
            onClose={() => setDeleteConfirmId(null)}
            title="Delete Doctor Schedule"
            subtitle="Are you sure you want to delete this schedule? This action cannot be undone."
            maxWidth={440}
            footer={
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
                <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                <Button variant="danger" onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
                  Delete Schedule
                </Button>
              </div>
            }
          >
            <p className="text-sm text-muted">
              Deleting this schedule will remove the doctor&apos;s available hours for this day of the week.
            </p>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}
