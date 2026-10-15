'use client';
import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, Check, Search, Star, Calendar, Clock, AlertCircle, Ban } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import { doctorApi, doctorScheduleApi, appointmentTypeApi, appointmentApi } from '@/lib/api';
import type { Doctor, AppointmentType, DoctorSchedule } from '@/lib/types';

const STEPS = ['Select Doctor', 'Choose Date & Time', 'Confirm Booking'];

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// ── Default fallback slots when doctor has no schedule configured ─────────────
const DEFAULT_START   = '09:00';
const DEFAULT_END     = '17:00';
const DEFAULT_STEP    = 30; // minutes
const DAILY_LIMIT     = 10;

/** Generate HH:mm time slots from start to end with stepMins interval */
function generateSlots(startTime: string, endTime: string, stepMins: number): string[] {
  const slots: string[] = [];
  if (!startTime || !endTime || stepMins <= 0) return slots;

  const parseTime = (t: string) => {
    const parts = t.split(':');
    return Number(parts[0] ?? 0) * 60 + Number(parts[1] ?? 0);
  };

  let cur = parseTime(startTime);
  const end = parseTime(endTime);
  while (cur + stepMins <= end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    cur += stepMins;
  }
  return slots;
}

/** Convert 24-hour "HH:mm" to 12-hour "H:MM AM/PM" for display */
function toAmPm(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h      = Number(hStr ?? 0);
  const m      = Number(mStr ?? 0);
  const period = h < 12 ? 'AM' : 'PM';
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

function getDaysInMonth(y: number, m: number) {
  const days: (number | null)[] = [];
  const firstDay = new Date(y, m, 1).getDay();
  for (let i = 0; i < firstDay; i++) days.push(null);
  const total = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= total; d++) days.push(d);
  return days;
}

// ── Doctor helpers ─────────────────────────────────────────────────────────────
function docFirst(d: Doctor)     { const r = d as unknown as Record<string,unknown>; return String(r.first_name  || d.firstName  || 'Doctor'); }
function docLast(d: Doctor)      { const r = d as unknown as Record<string,unknown>; return String(r.last_name   || d.lastName   || ''); }
function docMiddle(d: Doctor)    { const r = d as unknown as Record<string,unknown>; return String(r.middle_name || d.middleName || ''); }
function docFullName(d: Doctor)  { return [docFirst(d), docMiddle(d), docLast(d)].filter(Boolean).join(' '); }
function docInitials(d: Doctor)  { return `${docFirst(d)[0] ?? 'D'}${docLast(d)[0] ?? ''}`.toUpperCase(); }
function docId(d: Doctor)        { const r = d as unknown as Record<string,unknown>; return Number(d.doctorId || r.doctor_id || 0); }
function docFee(d: Doctor)       { const r = d as unknown as Record<string,unknown>; return Number(d.consultationFee ?? r.consultation_fee ?? 0); }
function docLicense(d: Doctor)   { const r = d as unknown as Record<string,unknown>; return String(r.license_number || d.licenseNumber || 'N/A'); }
function typeId(t: AppointmentType) { const r = t as unknown as Record<string,unknown>; return Number(t.appointmentTypeId || r.appointment_type_id || 0); }
function typeName(t: AppointmentType) {
  const r = t as unknown as Record<string,unknown>;
  return String(r.appointment_name || t.appointmentName || r.type_name || r.name || t.typeName || '');
}

export default function BookAppointmentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [types, setTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedType, setSelectedType] = useState<number>(0);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [reason, setReason] = useState('');

  // Doctor schedule + booked slots state
  const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [dailyCount, setDailyCount] = useState<number>(0);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());

  // ── Load doctors + types ─────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([doctorApi.getAll(), appointmentTypeApi.getAll()])
      .then(([dr, ty]) => {
        const drData = dr?.data;
        setDoctors(
          Array.isArray(drData) ? drData
            : Array.isArray(drData?.items)   ? drData.items
            : Array.isArray(drData?.data)    ? drData.data
            : Array.isArray(drData?.doctors) ? drData.doctors : []
        );
        const tyData = ty?.data;
        setTypes(Array.isArray(tyData) ? tyData : Array.isArray(tyData?.items) ? tyData.items : []);
      })
      .catch((err) => console.error('Error loading booking data:', err))
      .finally(() => setLoading(false));
  }, []);

  // ── Load doctor's schedule when doctor selected ──────────────────────────────
  useEffect(() => {
    if (!selectedDoctor) return;
    doctorScheduleApi.getByDoctorId(docId(selectedDoctor))
      .then((res) => {
        const data = res?.data;
        setDoctorSchedules(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setDoctorSchedules([]));
  }, [selectedDoctor]);

  // ── Load booked slots + daily count when date selected ───────────────────────
  const loadSlotData = useCallback(async (doctorIdVal: number, dateVal: string) => {
    if (!doctorIdVal || !dateVal) return;
    setSlotsLoading(true);
    try {
      const [slotsRes, countRes] = await Promise.all([
        appointmentApi.getBookedSlots(doctorIdVal, dateVal),
        appointmentApi.getDailyCount(doctorIdVal, dateVal),
      ]);

      // Normalize booked times to HH:mm (backend may return "09:30:00")
      const rawSlots = Array.isArray(slotsRes?.data) ? slotsRes.data : [];
      setBookedSlots(rawSlots.map((t: string) => String(t ?? '').slice(0, 5)));

      // Daily count
      const countData = countRes?.data;
      const count = Number(countData?.count ?? countData ?? 0);
      setDailyCount(count);
    } catch {
      setBookedSlots([]);
      setDailyCount(0);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const handleDateSelect = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedSlot('');
    if (selectedDoctor) loadSlotData(docId(selectedDoctor), dateStr);
  };

  // ── Generate available slots for the selected date ──────────────────────────
  const getAvailableSlots = (): string[] => {
    if (!selectedDate) return [];

    const dayOfWeek = DAY_NAMES[new Date(selectedDate + 'T00:00:00').getDay()];

    // Try to find a matching schedule for this day
    const matchingSchedule = doctorSchedules.find((s) => {
      const raw = s as unknown as Record<string, unknown>;
      return String(s.dayOfWeek ?? raw.day_of_week ?? '').toLowerCase() === dayOfWeek.toLowerCase();
    });

    if (matchingSchedule) {
      const raw = matchingSchedule as unknown as Record<string, unknown>;
      const start = String(matchingSchedule.startTime ?? raw.start_time ?? DEFAULT_START);
      const end   = String(matchingSchedule.endTime   ?? raw.end_time   ?? DEFAULT_END);
      const dur   = Number(matchingSchedule.slotDuration ?? raw.slot_duration ?? DEFAULT_STEP);
      const active = Boolean(matchingSchedule.isActive ?? raw.is_active ?? true);
      if (!active) return []; // schedule exists but is inactive
      return generateSlots(start, end, dur);
    }

    // ── No schedule configured for this day → use default slots ────────────────
    // This ensures patients can always book even if the admin hasn't set up schedules yet.
    return generateSlots(DEFAULT_START, DEFAULT_END, DEFAULT_STEP);
  };

  const availableSlots = getAvailableSlots();
  const isFullyBooked  = dailyCount >= DAILY_LIMIT;
  const remainingSlots = Math.max(0, DAILY_LIMIT - dailyCount);

  const days = getDaysInMonth(calYear, calMonth);
  const monthName = new Date(calYear, calMonth).toLocaleString('default', { month:'long', year:'numeric' });
  const filteredDoctors = doctors.filter((d) =>
    docFullName(d).toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selectedDoctor || !selectedDate || !selectedSlot || !selectedType) return;
    setSubmitting(true);
    try {
      await appointmentApi.create({
        doctorId:           docId(selectedDoctor),
        doctor_id:          docId(selectedDoctor),
        appointmentTypeId:  selectedType,
        appointment_type_id: selectedType,
        appointmentDate:    selectedDate,
        appointment_date:   selectedDate,
        appointmentTime:    `${selectedSlot}:00`,
        appointment_time:   `${selectedSlot}:00`,
        reason,
      });
      router.push('/appointments');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } | string } };
      const msg =
        (axiosErr?.response?.data as { message?: string })?.message ??
        JSON.stringify(axiosErr?.response?.data ?? 'Unknown error');
      alert(`Booking failed: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* Page header */}
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <Link href="/appointments">
            <button style={{
              width:36, height:36, borderRadius:'var(--radius)',
              background:'white', border:'1px solid var(--card-border)',
              display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
            }}>
              <ChevronLeft size={18} />
            </button>
          </Link>
          <div>
            <h1 className="page-title">Book Appointment</h1>
            <p className="page-subtitle">Find a doctor and schedule your visit</p>
          </div>
        </div>

        {/* Stepper */}
        <div className="stepper">
          {STEPS.map((s, i) => {
            const status = step > i + 1 ? 'done' : step === i + 1 ? 'active' : 'pending';
            return (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div className={`step-circle ${status}`}>
                    {status === 'done' ? <Check size={12} /> : i + 1}
                  </div>
                  <span className={`step-label ${status}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className="step-line" />}
              </div>
            );
          })}
        </div>

        {/* ── Step 1 — Doctor Selection ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="search-bar" style={{ maxWidth:420 }}>
              <Search size={15} style={{ color:'var(--muted)' }} />
              <input
                placeholder="Search doctors by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {loading ? <Spinner center /> : (
              <div className="grid-3">
                {filteredDoctors.map((d, idx) => {
                  const did      = docId(d);
                  const fullname = docFullName(d);
                  const initials = docInitials(d);
                  const license  = docLicense(d);
                  const fee      = docFee(d);
                  const raw      = d as unknown as Record<string, unknown>;
                  const deptId   = Number(d.departmentId  || raw.department_id || 0);
                  const specId   = Number(d.specialtyId   || raw.specialty_id  || 0);
                  const specName = String(d.specialtyName || raw.specialty_name || 'General Practice');

                      const rawDoc = d as unknown as Record<string, unknown>;
                      const pic = String(d.profilePicturePath || rawDoc.profile_picture_path || '');

                      return (
                        <Card
                          key={`book-doc-${did}-${idx}`}
                          className={`card-p doctor-card ${selectedDoctor && docId(selectedDoctor) === did ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedDoctor(d);
                            setStep(2);
                            setSelectedDate('');
                            setSelectedSlot('');
                            setBookedSlots([]);
                            setDailyCount(0);
                          }}
                        >
                          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
                            <div
                              style={{
                                position: 'relative',
                                borderRadius: '10px',
                                padding: 2,
                                background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 60%, rgba(59, 130, 246, 0.3) 100%)',
                                flexShrink: 0,
                              }}
                            >
                              <Avatar
                                initials={initials}
                                src={pic}
                                shape="portrait"
                                size="portrait-sm"
                                zoomable={true}
                                title={`Dr. ${fullname}`}
                                subtitle={specName}
                                style={{
                                  width: 68,
                                  height: 90,
                                  fontSize: 22,
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  border: '2px solid var(--card-bg, #ffffff)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              />
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                          <p className="font-semibold text-sm" style={{ color:'var(--foreground)' }}>
                            Dr. {fullname}
                          </p>
                          <p className="text-xs text-muted">{specName}</p>
                          <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4 }}>
                            <Star size={11} style={{ color:'#f59e0b', fill:'#f59e0b' }} />
                            <span className="text-xs font-semibold">₱{fee.toFixed(2)} / visit</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid var(--card-border)' }}>
                        <span className="text-xs text-muted">License: {license}</span>
                        <Badge variant="success">Available</Badge>
                      </div>
                    </Card>
                  );
                })}

                {filteredDoctors.length === 0 && !loading && (
                  <div style={{ gridColumn:'1/-1' }}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><Calendar size={24} /></div>
                      <p className="empty-state-title">No doctors found</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2 — Date & Time ────────────────────────────────────────────── */}
        {step === 2 && selectedDoctor && (
          <div className="grid-2">

            {/* Calendar */}
            <Card className="card-p">
              <h3 className="section-title" style={{ marginBottom:16 }}>Select Date</h3>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1);
                }}>‹</button>
                <span className="font-medium text-sm">{monthName}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1);
                }}>›</button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:2, textAlign:'center' }}>
                {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
                  <div key={d} style={{ fontSize:11, fontWeight:600, color:'var(--muted)', padding:'4px 0' }}>{d}</div>
                ))}
                {days.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} />;
                  const dateStr = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const isPast     = new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
                  const isSelected = selectedDate === dateStr;

                  return (
                    <button
                      key={i}
                      disabled={isPast}
                      onClick={() => handleDateSelect(dateStr)}
                      className="cal-day-btn"
                      style={isSelected ? { background:'var(--primary)', color:'white', fontWeight:700 } : {}}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>

              {selectedDate && (
                <div style={{ marginTop:14, padding:'10px 14px', background:'var(--accent)', borderRadius:'var(--radius)', fontSize:12.5 }}>
                  <p className="font-medium" style={{ color:'var(--foreground)' }}>
                    {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })}
                  </p>
                  <p className="text-muted" style={{ marginTop:2 }}>
                    Dr. {docFullName(selectedDoctor)}
                  </p>
                  {!slotsLoading && (
                    <p style={{ marginTop:4, fontSize:12, color: isFullyBooked ? '#ef4444' : '#16a34a', fontWeight:600 }}>
                      {isFullyBooked
                        ? '⛔ Fully booked for this day (10/10 limit reached)'
                        : `✅ ${remainingSlots} slot${remainingSlots !== 1 ? 's' : ''} remaining (${dailyCount}/10 booked)`}
                    </p>
                  )}
                </div>
              )}
            </Card>

            {/* Time Slots + Type + Reason */}
            <Card className="card-p">
              <h3 className="section-title" style={{ marginBottom:4 }}>Available Time Slots</h3>

              {selectedDate && (
                <p className="text-xs text-muted" style={{ marginBottom:12 }}>
                  {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                  {' · Dr. '}{docFullName(selectedDoctor)}
                </p>
              )}

              {!selectedDate ? (
                /* Prompt to pick a date */
                <div style={{ padding:'28px 0', textAlign:'center', color:'var(--muted)' }}>
                  <Calendar size={28} style={{ margin:'0 auto 10px', opacity:0.5 }} />
                  <p className="text-sm">← Select a date on the calendar</p>
                  <p className="text-xs" style={{ marginTop:4 }}>Time slots will appear here</p>
                </div>

              ) : slotsLoading ? (
                <div style={{ padding:'28px 0' }}><Spinner center /></div>

              ) : isFullyBooked ? (
                /* Day is fully booked */
                <div style={{ padding:'28px 0', textAlign:'center' }}>
                  <Ban size={28} style={{ color:'#ef4444', margin:'0 auto 10px' }} />
                  <p className="font-semibold text-sm" style={{ color:'#ef4444' }}>Fully Booked</p>
                  <p className="text-xs text-muted" style={{ marginTop:6 }}>
                    This doctor has reached the 10-appointment daily limit.<br />
                    Please choose a different date.
                  </p>
                </div>

              ) : (
                /* Render time slots */
                <>
                  {/* Legend */}
                  <div style={{ display:'flex', gap:14, marginBottom:12, fontSize:11, color:'var(--muted)', alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:11, height:11, borderRadius:3, background:'var(--primary)', display:'inline-block' }} /> Selected
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:11, height:11, borderRadius:3, background:'#f1f5f9', border:'1px solid #e2e8f0', display:'inline-block' }} /> Available
                    </span>
                    <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ width:11, height:11, borderRadius:3, background:'#fde8e8', border:'1px solid #fca5a5', display:'inline-block' }} /> Booked
                    </span>
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:7, marginBottom:16 }}>
                    {availableSlots.map((slot) => {
                      const isBooked   = bookedSlots.includes(slot);
                      const isSelected = selectedSlot === slot;
                      const label      = toAmPm(slot);   // e.g. "9:00 AM"
                      const [timePart, period] = label.split(' ');
                      return (
                        <button
                          key={slot}
                          disabled={isBooked}
                          onClick={() => !isBooked && setSelectedSlot(slot)}
                          title={isBooked ? 'Already booked' : `Book at ${label}`}
                          style={{
                            padding:'9px 4px 7px',
                            borderRadius:'var(--radius)',
                            fontSize:13,
                            fontWeight:500,
                            border:'1.5px solid',
                            transition:'all 0.15s',
                            cursor: isBooked ? 'not-allowed' : 'pointer',
                            borderColor: isBooked
                              ? '#fca5a5'
                              : isSelected ? 'var(--primary)' : 'var(--input-border)',
                            background: isBooked
                              ? '#fde8e8'
                              : isSelected ? 'var(--primary)' : 'white',
                            color: isBooked
                              ? '#ef4444'
                              : isSelected ? 'white' : 'var(--foreground)',
                            opacity: isBooked ? 0.75 : 1,
                          }}
                        >
                          {/* Time number */}
                          <span style={{ display:'block', fontSize:13, fontWeight:600, lineHeight:1 }}>
                            {timePart}
                          </span>
                          {/* AM / PM badge */}
                          <span style={{
                            display:'inline-block',
                            marginTop:3,
                            fontSize:9.5,
                            fontWeight:700,
                            letterSpacing:'0.04em',
                            padding:'1px 5px',
                            borderRadius:99,
                            background: isBooked
                              ? '#fca5a5'
                              : isSelected
                              ? 'rgba(255,255,255,0.25)'
                              : period === 'AM' ? '#dbeafe' : '#fef3c7',
                            color: isBooked
                              ? '#ef4444'
                              : isSelected
                              ? 'white'
                              : period === 'AM' ? '#1d4ed8' : '#b45309',
                          }}>
                            {isBooked ? 'BOOKED' : period}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Remaining slots notice */}
                  {selectedDate && remainingSlots <= 3 && remainingSlots > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 12px', background:'#fffbeb', borderRadius:'var(--radius)', border:'1px solid #fde68a', fontSize:12, color:'#92400e', marginBottom:12 }}>
                      <AlertCircle size={13} />
                      Only <strong>{remainingSlots}</strong> appointment{remainingSlots !== 1 ? 's' : ''} remaining for this day.
                    </div>
                  )}
                </>
              )}

              {/* Appointment Type */}
              <div className="form-group" style={{ marginBottom:12 }}>
                <label className="form-label">Appointment Type</label>
                <select
                  className="form-input"
                  value={selectedType}
                  onChange={(e) => setSelectedType(Number(e.target.value))}
                >
                  <option value={0}>Select type…</option>
                  {types.map((t, idx) => {
                    const tid   = typeId(t);
                    const tname = typeName(t);
                    return (
                      <option key={`type-opt-${tid || idx}`} value={tid}>
                        {tname || 'Standard Visit'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom:14 }}>
                <label className="form-label">Reason for visit</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Describe your symptoms or reason for this visit…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button
                  fullWidth
                  disabled={!selectedDate || !selectedSlot || !selectedType || isFullyBooked}
                  onClick={() => setStep(3)}
                >
                  Continue
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* ── Step 3 — Confirm ────────────────────────────────────────────────── */}
        {step === 3 && selectedDoctor && (
          <div style={{ maxWidth:520, margin:'0 auto' }}>
            <Card className="card-p-lg space-y-5">
              <h3 className="section-title">Confirm Your Appointment</h3>

              {/* Slot-lock notice */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#f0fdf4', borderRadius:'var(--radius)', border:'1px solid #86efac', fontSize:12.5, color:'#16a34a' }}>
                <Clock size={14} />
                <span>This slot will be <strong>locked</strong> once confirmed — others won&apos;t be able to book it.</span>
              </div>

              {/* Remaining slots warning */}
              {remainingSlots <= 3 && remainingSlots > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#fffbeb', borderRadius:'var(--radius)', border:'1px solid #fde68a', fontSize:12.5, color:'#92400e' }}>
                  <AlertCircle size={14} />
                  <span>Only <strong>{remainingSlots - 1}</strong> appointment slot{remainingSlots - 1 !== 1 ? 's' : ''} will remain after your booking.</span>
                </div>
              )}

              <div className="space-y-4">
                {[
                  { label: 'Doctor',           value: `Dr. ${docFullName(selectedDoctor)}` },
                  { label: 'Consultation Fee', value: `₱${docFee(selectedDoctor).toFixed(2)}` },
                  { label: 'Date',             value: selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : '—' },
                  { label: 'Time',             value: selectedSlot ? toAmPm(selectedSlot) : '—' },
                  { label: 'Daily Slots Used', value: `${dailyCount + 1} / ${DAILY_LIMIT}` },
                  { label: 'Type',             value: types.find(t => typeId(t) === selectedType) ? typeName(types.find(t => typeId(t) === selectedType)!) : 'N/A' },
                  { label: 'Reason',           value: reason || 'Not specified' },
                ].map((r) => (
                  <div key={r.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13.5, paddingBottom:8, borderBottom:'1px solid var(--card-border)' }}>
                    <span className="text-muted">{r.label}</span>
                    <span className="font-medium" style={{ color:'var(--foreground)', textAlign:'right', maxWidth:280 }}>{r.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ padding:'12px 14px', background:'var(--accent)', borderRadius:'var(--radius)', fontSize:12.5, color:'var(--muted)', border:'1px solid var(--accent-border)' }}>
                📧 You will receive a confirmation once the appointment is approved.
              </div>

              <div style={{ display:'flex', gap:10 }}>
                <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
                <Button fullWidth loading={submitting} onClick={handleConfirm}>
                  Confirm Booking
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
