'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users, Search, Filter, Calendar, Clock, Phone, MapPin,
  Activity, FileText, ChevronRight, Eye, Shield, Stethoscope,
  HeartPulse, UserCheck, AlertCircle, RefreshCw, CheckCircle2,
  CalendarCheck, Video, Droplet, Navigation
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import PatientDetailsModal from '@/components/ui/PatientDetailsModal';
import PatientTransitTrackerModal from '@/components/ui/PatientTransitTrackerModal';
import PhilippineAddressSelector from '@/components/ui/PhilippineAddressSelector';
import NearbyHospitalDetector from '@/components/ui/NearbyHospitalDetector';
import {
  patientApi, appointmentApi, consultationApi,
  doctorApi, medicalInfoApi
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Patient, Appointment, Consultation, Doctor, MedicalInformation } from '@/lib/types';
import { ROLES } from '@/lib/types';

export default function PatientTrackingPage() {
  const { user, isDoctor, isAdmin, isReceptionist } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [myDoctorProfile, setMyDoctorProfile] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterScope, setFilterScope] = useState<'my' | 'all'>('my');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [bloodFilter, setBloodFilter] = useState<string>('all');

  // Patient Inspection Modal
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientObj, setSelectedPatientObj] = useState<Patient | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Transit Tracker Modal
  const [transitModalOpen, setTransitModalOpen] = useState(false);
  const [transitAppointment, setTransitAppointment] = useState<Appointment | null>(null);
  const [transitPatient, setTransitPatient] = useState<Patient | null>(null);

  // Load current doctor profile if doctor
  const loadDoctorProfile = useCallback(async () => {
    if (isDoctor()) {
      try {
        const res = await doctorApi.getMyProfile();
        if (res.data) {
          setMyDoctorProfile(res.data);
        }
      } catch {
        // Fallback
      }
    }
  }, [isDoctor]);

  const loadAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [patRes, aptRes, consultRes] = await Promise.allSettled([
        patientApi.getAll(),
        appointmentApi.getMine(),
        consultationApi.getMine(),
      ]);

      if (patRes.status === 'fulfilled') {
        const pList = Array.isArray(patRes.value?.data)
          ? patRes.value.data
          : Array.isArray((patRes.value?.data as any)?.items)
          ? (patRes.value?.data as any).items
          : [];
        setPatients(pList);
      }

      if (aptRes.status === 'fulfilled') {
        const aList = Array.isArray(aptRes.value?.data)
          ? aptRes.value.data
          : Array.isArray((aptRes.value?.data as any)?.items)
          ? (aptRes.value?.data as any).items
          : [];
        setAppointments(aList);
      }

      if (consultRes.status === 'fulfilled') {
        const cList = Array.isArray(consultRes.value?.data)
          ? consultRes.value.data
          : Array.isArray((consultRes.value?.data as any)?.items)
          ? (consultRes.value?.data as any).items
          : [];
        setConsultations(cList);
      }
    } catch (err) {
      console.error('Error loading patient tracking data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDoctorProfile();
    loadAllData();
  }, [loadDoctorProfile, loadAllData]);

  // Set default filter scope: 'my' for doctors, 'all' for admin/receptionist
  useEffect(() => {
    if (isDoctor()) {
      setFilterScope('my');
    } else {
      setFilterScope('all');
    }
  }, [isDoctor]);

  // Determine patients associated with the doctor
  const myPatientIds = useMemo(() => {
    const ids = new Set<number>();
    // From appointments
    for (const a of appointments) {
      const raw = a as unknown as Record<string, unknown>;
      const pId = Number(a.patientId ?? raw.patient_id ?? 0);
      if (pId > 0) ids.add(pId);
    }
    // From consultations
    for (const c of consultations) {
      const raw = c as unknown as Record<string, unknown>;
      const pId = Number(c.patientId ?? raw.patient_id ?? 0);
      if (pId > 0) ids.add(pId);
    }
    return ids;
  }, [appointments, consultations]);

  // Filtered patient list
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const raw = p as unknown as Record<string, unknown>;
      const pId = Number(p.patientId ?? raw.patient_id ?? 0);
      const fname = String(p.firstName ?? raw.first_name ?? '').toLowerCase();
      const mname = String(raw.middle_name ?? '').toLowerCase();
      const lname = String(p.lastName ?? raw.last_name ?? '').toLowerCase();
      const fullName = `${fname} ${mname} ${lname}`.trim();
      const address = String(p.address ?? raw.address ?? '').toLowerCase();
      const phone = String(p.phone ?? raw.phone ?? '').toLowerCase();

      // Scope filter (My Patients vs All Patients)
      if (filterScope === 'my' && isDoctor() && !myPatientIds.has(pId)) {
        return false;
      }

      // Gender filter
      if (genderFilter !== 'all') {
        const g = String(p.gender ?? raw.gender ?? '').toLowerCase();
        if (g !== genderFilter.toLowerCase()) return false;
      }

      // Blood filter
      if (bloodFilter !== 'all') {
        const b = String(p.bloodType ?? raw.blood_type ?? '').toUpperCase();
        if (b !== bloodFilter.toUpperCase()) return false;
      }

      // Search term
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = fullName.includes(q);
        const matchesAddr = address.includes(q);
        const matchesPhone = phone.includes(q);
        const matchesId = String(pId).includes(q);
        return matchesName || matchesAddr || matchesPhone || matchesId;
      }

      return true;
    });
  }, [patients, filterScope, isDoctor, myPatientIds, genderFilter, bloodFilter, search]);

  const handleOpenPatient = (p: Patient) => {
    const raw = p as unknown as Record<string, unknown>;
    const pId = Number(p.patientId ?? raw.patient_id ?? 0);
    setSelectedPatientId(pId);
    setSelectedPatientObj(p);
    setModalOpen(true);
  };

  // Metric counts
  const totalMyPatients = myPatientIds.size;
  const totalAllPatients = patients.length;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, var(--primary) 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
              }}
            >
              <Users size={24} />
            </div>
            <div>
              <h1 className="page-title">Patient Tracking & Records</h1>
              <p className="page-subtitle">
                Track clinical status, view consultation histories, addresses, and emergency contacts
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => loadAllData(true)}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid-4">
          <Card className="card-p">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(37, 99, 235, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserCheck size={20} />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Assigned Patients</p>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0', color: 'var(--foreground)' }}>
                  {loading ? '—' : totalMyPatients}
                </h3>
                <p className="text-xs text-muted">Under your clinical care</p>
              </div>
            </div>
          </Card>

          <Card className="card-p">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarCheck size={20} />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Appointments Booked</p>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0', color: '#059669' }}>
                  {loading ? '—' : appointments.length}
                </h3>
                <p className="text-xs text-muted">Across all schedules</p>
              </div>
            </div>
          </Card>

          <Card className="card-p">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(147, 51, 234, 0.12)',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Video size={20} />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Telemedicine Consultations</p>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0', color: '#7c3aed' }}>
                  {loading ? '—' : consultations.length}
                </h3>
                <p className="text-xs text-muted">Clinical video sessions</p>
              </div>
            </div>
          </Card>

          <Card className="card-p">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <p className="text-xs text-muted font-medium">Hospital Registry</p>
                <h3 style={{ fontSize: 22, fontWeight: 800, margin: '2px 0', color: 'var(--foreground)' }}>
                  {loading ? '—' : totalAllPatients}
                </h3>
                <p className="text-xs text-muted">Total registered profiles</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter & Search Toolbar */}
        <Card className="card-p">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            {/* Left: Scope switcher & Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {isDoctor() && (
                <div
                  style={{
                    display: 'flex',
                    background: 'var(--accent)',
                    padding: 3,
                    borderRadius: 8,
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setFilterScope('my')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: filterScope === 'my' ? 'var(--primary)' : 'transparent',
                      color: filterScope === 'my' ? '#fff' : 'var(--muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    My Patients ({totalMyPatients})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterScope('all')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: filterScope === 'all' ? 'var(--primary)' : 'transparent',
                      color: filterScope === 'all' ? '#fff' : 'var(--muted)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    All Patients ({totalAllPatients})
                  </button>
                </div>
              )}

              {/* Search Box */}
              <div className="search-bar" style={{ minWidth: 260, margin: 0 }}>
                <Search size={14} style={{ color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="Search by name, address, phone or ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Right: Dropdown Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <select
                className="form-input text-xs"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                style={{ height: 36, padding: '0 10px' }}
              >
                <option value="all">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>

              <select
                className="form-input text-xs"
                value={bloodFilter}
                onChange={(e) => setBloodFilter(e.target.value)}
                style={{ height: 36, padding: '0 10px' }}
              >
                <option value="all">All Blood Types</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Patients Roster Table */}
        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient Name & ID</th>
                  <th>Contact & Phone</th>
                  <th>Philippine Address</th>
                  <th>Clinical Details</th>
                  <th>Care Relationship</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map((p, idx) => {
                  const raw = p as unknown as Record<string, unknown>;
                  const pId = Number(p.patientId ?? raw.patient_id ?? idx);
                  const fname = String(p.firstName ?? raw.first_name ?? '');
                  const mname = String(raw.middle_name ?? '');
                  const lname = String(p.lastName ?? raw.last_name ?? '');
                  const fullName = [fname, mname, lname].filter(Boolean).join(' ') || `Patient #${pId}`;
                  const initials = `${fname[0] ?? 'P'}${lname[0] ?? ''}`;
                  const pic = String(p.profilePicturePath || raw.profile_picture_path || '');
                  const phone = String(p.phone ?? raw.phone ?? '—');
                  const address = String(p.address ?? raw.address ?? '—');
                  const gender = String(p.gender ?? raw.gender ?? '—');
                  const blood = String(p.bloodType ?? raw.blood_type ?? '—');
                  const dob = String(p.birthDate ?? raw.birth_date ?? (p as any).dateOfBirth ?? raw.date_of_birth ?? '—');
                  const isMyPatient = myPatientIds.has(pId);

                  // Count ALL patient appointments with this doctor
                  const aptCount = appointments.filter((a) => {
                    const aRaw = a as unknown as Record<string, unknown>;
                    return Number(a.patientId ?? aRaw.patient_id ?? 0) === pId;
                  }).length;

                  // Active booked/confirmed appointment (statusId 1=Scheduled or 2=Confirmed)
                  // Only these statuses mean the patient has booked and may be on the way
                  const activeApt = appointments.find((a) => {
                    const aRaw = a as unknown as Record<string, unknown>;
                    if (Number(a.patientId ?? aRaw.patient_id ?? 0) !== pId) return false;
                    const sid = Number(a.statusId ?? aRaw.status_id ?? 0);
                    const sStr = String(a.status ?? aRaw.status ?? '').toLowerCase().replace(/[\s\-_]/g, '');
                    return sid === 1 || sid === 2 || sStr === 'scheduled' || sStr === 'confirmed';
                  }) ?? null;

                  // Count patient consultations with this doctor
                  const consultCount = consultations.filter((c) => {
                    const cRaw = c as unknown as Record<string, unknown>;
                    return Number(c.patientId ?? cRaw.patient_id ?? 0) === pId;
                  }).length;

                  return (
                    <tr key={`pat-row-${pId || idx}`}>
                      {/* Name & Avatar */}
                      <td>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                          onClick={() => handleOpenPatient(p)}
                        >
                          <Avatar
                            initials={initials}
                            src={pic}
                            size="md"
                            zoomable={true}
                            title={fullName}
                            subtitle={`Patient #${pId}`}
                          />
                          <div>
                            <p className="font-semibold text-sm hover:underline" style={{ margin: 0 }}>
                              {fullName}
                            </p>
                            <p className="text-xs text-muted" style={{ margin: '2px 0 0 0' }}>
                              ID: #{pId} {dob !== '—' ? `· DOB: ${dob}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Phone */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Phone size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                          <span className="text-sm">{phone}</span>
                        </div>
                      </td>

                      {/* Philippine Address */}
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <MapPin size={14} style={{ color: 'var(--danger-text, #ef4444)', marginTop: 2, flexShrink: 0 }} />
                          <span className="text-xs line-clamp-2" title={address} style={{ color: address !== '—' ? 'var(--foreground)' : 'var(--muted)' }}>
                            {address}
                          </span>
                        </div>
                      </td>

                      {/* Clinical Details */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {gender !== '—' && (
                            <Badge variant="muted">{gender}</Badge>
                          )}
                          {blood !== '—' && (
                            <Badge variant="info">
                              <Droplet size={10} style={{ marginRight: 3 }} />
                              {blood}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Relationship / Status */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {isMyPatient ? (
                            <Badge variant="success">
                              <CheckCircle2 size={11} style={{ marginRight: 4 }} />
                              Active Patient
                            </Badge>
                          ) : (
                            <Badge variant="muted">General Patient</Badge>
                          )}

                          {activeApt && (
                            <div style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                              {typeof window !== 'undefined' &&
                              parseFloat(localStorage.getItem(`patient_transit_progress_${Number(activeApt.appointmentId ?? (activeApt as any).appointment_id ?? 0)}`) || '0') > 0 ? (
                                <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                                  On The Way
                                </span>
                              ) : (
                                <span style={{ color: '#d97706', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                                  Booked · Not on way
                                </span>
                              )}
                            </div>
                          )}

                          <span className="text-xs text-muted">
                            {aptCount > 0 ? `${aptCount} Apt(s)` : ''}
                            {aptCount > 0 && consultCount > 0 ? ' · ' : ''}
                            {consultCount > 0 ? `${consultCount} Consult(s)` : ''}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                          {/* Show live tracking button only if patient has a booked/confirmed appointment */}
                          {activeApt && (
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Navigation}
                              onClick={() => {
                                setTransitAppointment(activeApt);
                                setTransitPatient(p);
                                setTransitModalOpen(true);
                              }}
                              style={{
                                borderColor: 'rgba(5, 150, 105, 0.4)',
                                color: '#059669',
                                background: 'rgba(5, 150, 105, 0.08)',
                              }}
                              title="Live GPS & road position tracking for booked patient"
                            >
                              Live Tracking
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenPatient(p)}
                          >
                            Track Patient
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredPatients.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
                      <AlertCircle size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                      <p style={{ fontWeight: 600, fontSize: 14 }}>No patients found</p>
                      <p style={{ fontSize: 12 }}>
                        {filterScope === 'my' && isDoctor()
                          ? 'You do not have any appointments or consultations booked with patients matching the filters.'
                          : 'Try adjusting your search criteria or filters.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>

        {/* Unified Patient Track & Records Inspection Modal */}
        <PatientDetailsModal
          open={modalOpen}
          patientId={selectedPatientId}
          initialPatient={selectedPatientObj}
          onClose={() => setModalOpen(false)}
        />

        {/* Live Patient Transit Tracker Map Modal */}
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
      </div>
    </AppLayout>
  );
}
