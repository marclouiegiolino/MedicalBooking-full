'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  User, Calendar, Clock, Phone, MapPin, Activity, FileText,
  Shield, HeartPulse, AlertTriangle, Stethoscope, CreditCard,
  RefreshCw, X, AlertCircle, CheckCircle2, Droplet, Hash, Mail, ZoomIn, Navigation
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import {
  patientApi, emergencyContactApi, insuranceApi,
  consultationApi, appointmentApi, medicalInfoApi
} from '@/lib/api';
import NearbyHospitalDetector from '@/components/ui/NearbyHospitalDetector';
import PatientTransitTrackerModal from '@/components/ui/PatientTransitTrackerModal';
import { useAuth } from '@/context/AuthContext';
import type {
  Patient, EmergencyContact, Insurance, Consultation,
  Appointment, MedicalInformation
} from '@/lib/types';

export interface PatientDetailsModalProps {
  patientId: number | null;
  open: boolean;
  onClose: () => void;
  initialPatient?: Patient | null;
}

export default function PatientDetailsModal({
  patientId,
  open,
  onClose,
  initialPatient,
}: PatientDetailsModalProps) {
  const { isDoctor, isReceptionist, isAdmin } = useAuth();

  const [patient, setPatient] = useState<Patient | null>(initialPatient ?? null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs
  type TabType = 'overview' | 'clinical' | 'emergency' | 'insurance' | 'appointments';
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Related data
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loadingEmergency, setLoadingEmergency] = useState(false);

  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loadingInsurance, setLoadingInsurance] = useState(false);

  const [medicalInfo, setMedicalInfo] = useState<MedicalInformation | null>(null);
  const [loadingMedicalInfo, setLoadingMedicalInfo] = useState(false);

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loadingConsultations, setLoadingConsultations] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  // Transit Tracker Modal State
  const [transitModalOpen, setTransitModalOpen] = useState(false);
  const [selectedTransitApt, setSelectedTransitApt] = useState<Appointment | null>(null);

  // Reset tab when modal opens or role restricts tab
  useEffect(() => {
    if (open) {
      setActiveTab('overview');
      setError(null);
    }
  }, [open, patientId]);

  // Load Patient Profile
  const loadPatient = useCallback(async (pId: number) => {
    setLoadingPatient(true);
    setError(null);
    try {
      const res = await patientApi.getById(pId);
      setPatient(res.data);
    } catch (err: unknown) {
      console.error('Failed to load patient:', err);
      // Fallback to initialPatient if available
      if (!initialPatient) {
        setError('Could not load patient profile details.');
      }
    } finally {
      setLoadingPatient(false);
    }
  }, [initialPatient]);

  // Load Emergency Contacts (Available to Doctor, Receptionist, Admin)
  const loadEmergencyContacts = useCallback(async (pId: number) => {
    setLoadingEmergency(true);
    try {
      const res = await emergencyContactApi.getByPatientId(pId);
      const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      setEmergencyContacts(items);
    } catch (err) {
      console.warn('Could not load emergency contacts:', err);
      setEmergencyContacts([]);
    } finally {
      setLoadingEmergency(false);
    }
  }, []);

  // Load Insurance (Available to Doctor, Receptionist, Admin)
  const loadInsurance = useCallback(async (pId: number) => {
    setLoadingInsurance(true);
    try {
      const res = await insuranceApi.getByPatientId(pId);
      const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      setInsurances(items);
    } catch (err) {
      console.warn('Could not load insurance policies:', err);
      setInsurances([]);
    } finally {
      setLoadingInsurance(false);
    }
  }, []);

  // Load Medical Info (Available to Doctor, Receptionist, Admin via StaffAndAbove)
  const loadMedicalInfo = useCallback(async (pId: number) => {
    setLoadingMedicalInfo(true);
    try {
      // 1. Try direct patient endpoint first
      try {
        const directRes = await medicalInfoApi.getByPatientId(pId);
        if (directRes?.data) {
          setMedicalInfo(directRes.data);
          return;
        }
      } catch (err: unknown) {
        const axErr = err as { response?: { status?: number } };
        if (axErr?.response?.status === 404) {
          // Patient does not have medical info recorded yet
          setMedicalInfo(null);
          return;
        }
      }

      // 2. Fallback to list
      const res = await medicalInfoApi.getAll();
      const items: MedicalInformation[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];
      const match = items.find((m) => {
        const raw = m as unknown as Record<string, unknown>;
        return Number(m.patientId ?? raw.patient_id ?? 0) === pId;
      });
      setMedicalInfo(match ?? null);
    } catch (err) {
      console.warn('Could not load medical information:', err);
      setMedicalInfo(null);
    } finally {
      setLoadingMedicalInfo(false);
    }
  }, []);

  // Load Consultations (Doctor & Admin only)
  const loadConsultations = useCallback(async (pId: number) => {
    if (isReceptionist() && !isAdmin()) return; // Receptionists don't have access to consultation/my
    setLoadingConsultations(true);
    try {
      const res = await consultationApi.getMine();
      const items: Consultation[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];
      const filtered = items.filter((c) => {
        const raw = c as unknown as Record<string, unknown>;
        return Number(c.patientId ?? raw.patient_id ?? 0) === pId;
      });
      setConsultations(filtered);
    } catch (err) {
      console.warn('Could not load consultations:', err);
      setConsultations([]);
    } finally {
      setLoadingConsultations(false);
    }
  }, [isReceptionist, isAdmin]);

  // Load Appointments for this patient
  const loadAppointments = useCallback(async (pId: number) => {
    setLoadingAppointments(true);
    try {
      const res = await appointmentApi.getMine();
      const items: Appointment[] = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.items)
        ? res.data.items
        : [];
      const filtered = items.filter((a) => {
        const raw = a as unknown as Record<string, unknown>;
        return Number(a.patientId ?? raw.patient_id ?? 0) === pId;
      });
      setAppointments(filtered);
    } catch (err) {
      console.warn('Could not load appointments for patient:', err);
      setAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  }, []);

  // Trigger all loaders when modal opens or patientId changes
  const reloadAll = useCallback(() => {
    if (!patientId) return;
    loadPatient(patientId);
    loadMedicalInfo(patientId);
    loadAppointments(patientId);

    loadEmergencyContacts(patientId);
    loadInsurance(patientId);

    if (isDoctor() || isAdmin()) {
      loadConsultations(patientId);
    }
  }, [
    patientId, loadPatient, loadMedicalInfo, loadAppointments,
    isDoctor, isAdmin, loadEmergencyContacts, loadInsurance, loadConsultations,
  ]);

  useEffect(() => {
    if (open && patientId) {
      if (initialPatient) {
        setPatient(initialPatient);
      }
      reloadAll();
    }
  }, [open, patientId, initialPatient, reloadAll]);

  if (!open) return null;

  // Normalized patient fields
  const pRaw = patient as unknown as Record<string, unknown> | null;
  const firstName = String(patient?.firstName ?? pRaw?.first_name ?? '').trim();
  const middleName = String(patient?.middleName ?? pRaw?.middle_name ?? '').trim();
  const lastName = String(patient?.lastName ?? pRaw?.last_name ?? '').trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ') || (patientId ? `Patient #${patientId}` : 'Patient');
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'P';

  const birthDateStr = String(patient?.birthDate ?? pRaw?.birth_date ?? patient?.dateOfBirth ?? pRaw?.date_of_birth ?? '');
  const gender = String(patient?.gender ?? pRaw?.gender ?? 'Not specified');
  const bloodType = String(patient?.bloodType ?? pRaw?.blood_type ?? '');
  const address = String(patient?.address ?? pRaw?.address ?? '');
  const phone = String(patient?.phone ?? pRaw?.phone ?? '');
  const guid = String(patient?.guid ?? pRaw?.guid ?? '');
  const profilePicture = patient?.profilePicturePath ?? (pRaw?.profile_picture_path as string | undefined);

  // Age calculation
  let ageText = '';
  if (birthDateStr) {
    try {
      const birth = new Date(birthDateStr);
      if (!isNaN(birth.getTime())) {
        const now = new Date();
        let years = now.getFullYear() - birth.getFullYear();
        const mDiff = now.getMonth() - birth.getMonth();
        if (mDiff < 0 || (mDiff === 0 && now.getDate() < birth.getDate())) {
          years--;
        }
        if (years >= 0 && years < 130) {
          ageText = `${years} yrs old`;
        }
      }
    } catch {
      ageText = '';
    }
  }

  // Determine allowed tabs based on permissions (Doctor & Receptionist can both view)
  const canSeeEmergency = isDoctor() || isReceptionist() || isAdmin();
  const canSeeInsurance = isDoctor() || isReceptionist() || isAdmin();
  const canSeeClinical = isDoctor() || isAdmin() || isReceptionist();

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title="Patient Details"
      subtitle={`Medical file and records for ${fullName}`}
      maxWidth={740}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            loading={loadingPatient}
            onClick={reloadAll}
          >
            Refresh Records
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      {/* ── Top Hero Profile Card (Clinical Identification Banner) ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(59, 130, 246, 0.04) 50%, var(--accent) 100%)',
          border: '1px solid var(--card-border)',
          borderRadius: 'calc(var(--radius) + 2px)',
          padding: '18px 22px',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Large, Clinical Portrait with Zoom Badge */}
          <div
            style={{
              position: 'relative',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                position: 'relative',
                borderRadius: '16px',
                padding: 3,
                background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 50%, rgba(59, 130, 246, 0.3) 100%)',
                boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08)',
                cursor: 'pointer',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              title="Click to view full patient photo"
            >
              <Avatar
                initials={initials}
                src={profilePicture}
                alt={fullName}
                shape="portrait"
                size="portrait-md"
                zoomable={true}
                title={fullName}
                subtitle={ageText ? `${gender} · ${ageText}` : gender}
                style={{
                  width: 100,
                  height: 130,
                  fontSize: 34,
                  fontWeight: 700,
                  border: '3px solid var(--card-bg, #ffffff)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 3,
                  right: 3,
                  width: 26,
                  height: 26,
                  borderRadius: '8px',
                  backgroundColor: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  border: '2px solid var(--card-bg, #ffffff)',
                  pointerEvents: 'none',
                }}
                title="Enlarge photo"
              >
                <ZoomIn size={13} />
              </div>
            </div>
            <span
              style={{
                marginTop: 6,
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--muted)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              Patient Photo
            </span>
          </div>

          {/* Patient Details & Identity */}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--foreground)', letterSpacing: '-0.01em' }}>
                {fullName}
              </h3>
              {bloodType && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    color: '#dc2626',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                  }}
                  title="Blood Group"
                >
                  <Droplet size={11} />
                  {bloodType}
                </span>
              )}
              <Badge variant="info">
                Patient
              </Badge>
            </div>

            {/* Subtitle demographics */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap', fontSize: 13, color: 'var(--muted)' }}>
              <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{gender}</span>
              {ageText && <span>• <strong style={{ color: 'var(--foreground)' }}>{ageText}</strong></span>}
              {birthDateStr && <span>(DOB: {new Date(birthDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})</span>}
            </div>

            {/* Contact row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--muted)' }}>
              {phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Phone size={13} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{phone}</span>
                </span>
              )}
              {address && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <MapPin size={13} style={{ color: 'var(--primary)' }} />
                  <span>{address}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          borderBottom: '1px solid var(--card-border)',
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 2,
        }}
      >
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'overview' ? 'var(--accent)' : 'transparent',
            borderBottom: activeTab === 'overview' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'overview' ? 'var(--primary)' : 'var(--muted)',
            fontWeight: activeTab === 'overview' ? 600 : 500,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <User size={14} />
          Overview
        </button>

        {canSeeClinical && (
          <button
            onClick={() => setActiveTab('clinical')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              background: activeTab === 'clinical' ? 'var(--accent)' : 'transparent',
              borderBottom: activeTab === 'clinical' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'clinical' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'clinical' ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Stethoscope size={14} />
            Clinical Records
            {(medicalInfo || consultations.length > 0) && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)' }} />
            )}
          </button>
        )}

        {canSeeEmergency && (
          <button
            onClick={() => setActiveTab('emergency')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              background: activeTab === 'emergency' ? 'var(--accent)' : 'transparent',
              borderBottom: activeTab === 'emergency' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'emergency' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'emergency' ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <HeartPulse size={14} />
            Emergency Contacts
            {emergencyContacts.length > 0 && (
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--primary)', color: 'white' }}>
                {emergencyContacts.length}
              </span>
            )}
          </button>
        )}

        {canSeeInsurance && (
          <button
            onClick={() => setActiveTab('insurance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: '6px 6px 0 0',
              border: 'none',
              background: activeTab === 'insurance' ? 'var(--accent)' : 'transparent',
              borderBottom: activeTab === 'insurance' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'insurance' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'insurance' ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <Shield size={14} />
            Insurance
            {insurances.length > 0 && (
              <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--primary)', color: 'white' }}>
                {insurances.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('appointments')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: '6px 6px 0 0',
            border: 'none',
            background: activeTab === 'appointments' ? 'var(--accent)' : 'transparent',
            borderBottom: activeTab === 'appointments' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'appointments' ? 'var(--primary)' : 'var(--muted)',
            fontWeight: activeTab === 'appointments' ? 600 : 500,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <Calendar size={14} />
          Appointments
          {appointments.length > 0 && (
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: 'var(--primary)', color: 'white' }}>
              {appointments.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab Content: Overview ── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Full Legal Name
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {fullName}
            </p>
          </div>

          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Date of Birth / Age
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {birthDateStr ? new Date(birthDateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not provided'}
              {ageText ? ` (${ageText})` : ''}
            </p>
          </div>

          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Biological Gender
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {gender}
            </p>
          </div>

          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Blood Group
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: bloodType ? '#dc2626' : 'var(--foreground)' }}>
              {bloodType ? `Type ${bloodType}` : 'Unspecified'}
            </p>
          </div>

          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contact Phone
            </span>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {phone || 'Not recorded'}
            </p>
          </div>

          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Primary Philippine Address
              </span>
              {address && (
                <button
                  type="button"
                  onClick={() => {
                    const upcomingApt = appointments.find(a => {
                      const sid = Number(a.statusId ?? (a as any).status_id ?? 1);
                      return sid !== 3 && sid !== 4 && sid !== 5;
                    }) || appointments[0] || ({ appointmentId: 0, appointmentTime: '09:00:00' } as any);
                    setSelectedTransitApt(upcomingApt);
                    setTransitModalOpen(true);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#059669',
                    background: 'rgba(5, 150, 105, 0.1)',
                    border: '1px solid rgba(5, 150, 105, 0.25)',
                    padding: '2px 8px',
                    borderRadius: 5,
                    cursor: 'pointer',
                  }}
                  title="Track patient on map route"
                >
                  <Navigation size={10} />
                  <span>Track on Map</span>
                </button>
              )}
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {address || 'Not recorded'}
            </p>
            {address && (
              <NearbyHospitalDetector
                address={address}
                compact={true}
                showActions={false}
                title="Assigned / Nearest Facility"
              />
            )}
          </div>

          {/* Primary Health Insurance Summary */}
          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Health Insurance
              </span>
              {canSeeInsurance && insurances.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('insurance')}
                  style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  View Details →
                </button>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {(() => {
                if (loadingInsurance) return 'Checking records...';
                if (insurances.length === 0) return 'No insurance on file';
                const prim = insurances.find(i => Boolean(i.isPrimary ?? (i as any).is_primary)) || insurances[0];
                const pName = prim.providerName ?? (prim as any).provider_name ?? 'Insurance';
                const pNum = prim.policyNumber ?? (prim as any).policy_number ?? '';
                return `${pName}${pNum ? ` (${pNum})` : ''}`;
              })()}
            </p>
          </div>

          {/* Emergency Contact Summary */}
          <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '12px 14px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Emergency Contact
              </span>
              {canSeeEmergency && emergencyContacts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('emergency')}
                  style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  View Details →
                </button>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {(() => {
                if (loadingEmergency) return 'Checking records...';
                if (emergencyContacts.length === 0) return 'No contacts registered';
                const first = emergencyContacts[0];
                const fRaw = first as any;
                const cName = [first.firstName ?? fRaw.first_name, first.lastName ?? fRaw.last_name].filter(Boolean).join(' ') || first.contactName || 'Contact';
                const cPhone = first.phone ?? fRaw.phone ?? '';
                const cRel = first.relationship ?? fRaw.relationship ?? '';
                return `${cName}${cRel ? ` (${cRel})` : ''}: ${cPhone}`;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* ── Tab Content: Clinical Records ── */}
      {activeTab === 'clinical' && canSeeClinical && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Medical Information card */}
          <div style={{ background: 'var(--accent)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius)', padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <HeartPulse size={16} style={{ color: 'var(--primary)' }} />
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                General Medical History & Conditions
              </h4>
            </div>

            {loadingMedicalInfo ? (
              <div style={{ padding: 20, textAlign: 'center' }}>
                <Spinner size="sm" />
              </div>
            ) : medicalInfo ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                <div style={{ background: 'var(--card-bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                    <AlertTriangle size={12} /> Allergies
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: medicalInfo.allergies ? 'var(--foreground)' : 'var(--muted)', fontWeight: medicalInfo.allergies ? 600 : 400 }}>
                    {medicalInfo.allergies || 'None reported'}
                  </p>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                    Medical History
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>
                    {(medicalInfo as unknown as Record<string, string>).medical_history || medicalInfo.medicalHistory || 'None reported'}
                  </p>
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--card-border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>
                    Current Medications
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--foreground)' }}>
                    {medicalInfo.medications || 'None'}
                  </p>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, fontStyle: 'italic' }}>
                No recorded allergies or baseline medical condition entry found for this patient.
              </p>
            )}
          </div>

          {/* Consultation records for Doctor & Admin */}
          {(isDoctor() || isAdmin()) && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} style={{ color: 'var(--primary)' }} />
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                    Consultation & Clinical Notes History
                  </h4>
                </div>
                <Badge variant="muted">{consultations.length} records</Badge>
              </div>

              {loadingConsultations ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Spinner size="sm" />
                </div>
              ) : consultations.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
                  <Stethoscope size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                  <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>No prior consultations on record</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {consultations.map((c) => {
                    const rawC = c as unknown as Record<string, unknown>;
                    const cId = c.consultationId ?? rawC.consultation_id;
                    const createdDate = c.createdAt ?? (rawC.created_at as string);
                    return (
                      <div
                        key={String(cId)}
                        style={{
                          background: 'var(--card-bg)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 'var(--radius)',
                          padding: '12px 16px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                            Clinical Consultation
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {createdDate ? new Date(createdDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                          </span>
                        </div>

                        {c.diagnosis && (
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Diagnosis: </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{c.diagnosis}</span>
                          </div>
                        )}

                        {(c.consultationNotes || c.notes) && (
                          <div style={{ marginBottom: 6, fontSize: 12.5, color: 'var(--foreground)' }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Notes: </span>
                            {c.consultationNotes || c.notes}
                          </div>
                        )}

                        {c.treatmentPlan && (
                          <div style={{ marginBottom: 6, fontSize: 12.5, color: 'var(--foreground)' }}>
                            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Treatment Plan: </span>
                            {c.treatmentPlan}
                          </div>
                        )}

                        {c.prescription && (
                          <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.08)', borderLeft: '3px solid #3b82f6', fontSize: 12, color: 'var(--foreground)' }}>
                            <span style={{ fontWeight: 600, color: '#2563eb' }}>Prescription: </span>
                            {c.prescription}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Emergency Contacts ── */}
      {activeTab === 'emergency' && canSeeEmergency && (
        <div>
          {loadingEmergency ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spinner size="sm" />
            </div>
          ) : emergencyContacts.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
              <HeartPulse size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>No emergency contacts registered</p>
              <p style={{ fontSize: 12, margin: 0 }}>This patient has not yet added emergency contact details.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
              {emergencyContacts.map((contact, idx) => {
                const cRaw = contact as unknown as Record<string, unknown>;
                const fName = contact.firstName ?? (cRaw.first_name as string) ?? '';
                const lName = contact.lastName ?? (cRaw.last_name as string) ?? '';
                const name = [fName, lName].filter(Boolean).join(' ') || contact.contactName || `Contact #${idx + 1}`;
                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--accent)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 'var(--radius)',
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                        {name}
                      </h4>
                      <Badge variant="info">{contact.relationship}</Badge>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--muted)', marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={13} style={{ color: 'var(--primary)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{contact.phone}</span>
                      </div>
                      {contact.email && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Mail size={13} style={{ color: 'var(--muted)' }} />
                          <span>{contact.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Insurance ── */}
      {activeTab === 'insurance' && canSeeInsurance && (
        <div>
          {loadingInsurance ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spinner size="sm" />
            </div>
          ) : insurances.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
              <Shield size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>No active insurance policy found</p>
              <p style={{ fontSize: 12, margin: 0 }}>This patient has not registered health insurance coverage.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
              {insurances.map((ins, idx) => {
                const insRaw = ins as unknown as Record<string, unknown>;
                const provider = ins.providerName ?? (insRaw.provider_name as string) ?? 'Insurance Provider';
                const policyNum = ins.policyNumber ?? (insRaw.policy_number as string) ?? '—';
                const coverage = ins.coverageType ?? (insRaw.coverage_type as string) ?? 'Standard Coverage';
                const isPrim = Boolean(ins.isPrimary ?? insRaw.is_primary);
                const validUntil = ins.validUntil ?? (insRaw.valid_until as string);

                return (
                  <div
                    key={idx}
                    style={{
                      background: 'var(--accent)',
                      border: isPrim ? '1.5px solid var(--primary)' : '1px solid var(--card-border)',
                      borderRadius: 'var(--radius)',
                      padding: '14px 16px',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CreditCard size={15} style={{ color: 'var(--primary)' }} />
                        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
                          {provider}
                        </h4>
                      </div>
                      {isPrim && <Badge variant="success">Primary</Badge>}
                    </div>

                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Policy Number: </span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--foreground)' }}>{policyNum}</span>
                      </div>
                      <div>
                        <span style={{ color: 'var(--muted)' }}>Coverage Type: </span>
                        <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>{coverage}</span>
                      </div>
                      {validUntil && (
                        <div style={{ color: 'var(--muted)', fontSize: 11.5, marginTop: 4 }}>
                          Valid until: {new Date(validUntil).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab Content: Appointments ── */}
      {activeTab === 'appointments' && (
        <div>
          {loadingAppointments ? (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spinner size="sm" />
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px dashed var(--card-border)', color: 'var(--muted)' }}>
              <Calendar size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: 13, fontWeight: 600, margin: '0 0 4px' }}>No appointments booked</p>
              <p style={{ fontSize: 12, margin: 0 }}>No appointment records found for this patient in your schedule.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);

                return appointments.map((apt) => {
                  const rawA = apt as unknown as Record<string, unknown>;
                  const aId = apt.appointmentId ?? rawA.appointment_id;
                  const date = String(apt.appointmentDate ?? rawA.appointment_date ?? '');
                  const time = String(apt.appointmentTime ?? rawA.appointment_time ?? '');
                  const reason = String(apt.reason ?? rawA.reason ?? apt.remarks ?? rawA.remarks ?? apt.notes ?? rawA.notes ?? '');
                  const sid = Number(apt.statusId ?? rawA.status_id ?? 0);
                  const strStatus = String(apt.status ?? rawA.status ?? '').trim().toLowerCase();

                  // Check if there is an associated completed consultation for this appointment
                  const linkedConsultation = consultations.find((c) => {
                    const cAptId = Number(c.appointmentId ?? (c as unknown as Record<string, unknown>).appointment_id ?? 0);
                    return cAptId > 0 && cAptId === Number(aId);
                  });
                  const isConsultationDone = Boolean(
                    linkedConsultation && (
                      linkedConsultation.completedAt ||
                      (linkedConsultation as unknown as Record<string, unknown>).completed_at
                    )
                  );

                  let isCompleted = sid === 4 || strStatus === 'completed' || isConsultationDone;
                  let isCancelled = sid === 3 || strStatus === 'cancelled';
                  let isNoShow    = sid === 5 || strStatus === 'no-show' || strStatus === 'noshow';
                  let isConfirmed = sid === 2 || strStatus === 'confirmed';

                  let displayStatus = 'Scheduled';
                  let isOverdue = false;

                  if (isCompleted) {
                    displayStatus = 'Completed';
                  } else if (isCancelled) {
                    displayStatus = 'Cancelled';
                  } else if (isNoShow) {
                    displayStatus = 'No-Show';
                  } else {
                    // Check if overdue: past date and still scheduled/confirmed
                    if (date) {
                      try {
                        const aptDate = new Date(date.split('T')[0] + 'T00:00:00');
                        if (aptDate < todayMidnight) {
                          isOverdue = true;
                          displayStatus = 'Overdue';
                        }
                      } catch { /* ignore */ }
                    }

                    if (!isOverdue) {
                      displayStatus = isConfirmed ? 'Confirmed' : 'Scheduled';
                    }
                  }

                  // Status → badge variant mapping
                  const badgeVariant = (
                    isCompleted ? 'muted' :
                    isCancelled || isNoShow || isOverdue ? 'danger' :
                    isConfirmed ? 'success' :
                    'warning'
                  ) as 'success' | 'warning' | 'danger' | 'muted' | 'info';

                  // Left border accent colour
                  const accentColor = (
                    isCompleted ? '#10b981' :
                    isOverdue ? '#dc2626' :
                    isConfirmed ? '#3b82f6' :
                    isCancelled ? '#ef4444' :
                    isNoShow ? '#991b1b' :
                    '#f59e0b'
                  );

                  return (
                    <div
                      key={String(aId)}
                      style={{
                        background: 'var(--accent)',
                        border: '1px solid var(--card-border)',
                        borderLeft: `4px solid ${accentColor}`,
                        borderRadius: 'var(--radius)',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                            Appointment
                          </span>
                          <Badge variant={badgeVariant}>
                            {displayStatus}
                          </Badge>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--muted)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={11} />
                            {date ? new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          </span>
                          {time && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} />
                              {time.slice(0, 5)}
                            </span>
                          )}
                        </div>
                        {reason && (
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--foreground)', fontStyle: 'italic' }}>
                            &quot;{reason}&quot;
                          </p>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Navigation}
                        onClick={() => {
                          setSelectedTransitApt(apt);
                          setTransitModalOpen(true);
                        }}
                        style={{ fontSize: 12, height: 32, flexShrink: 0 }}
                      >
                        Track Route
                      </Button>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}
    </Modal>

    {/* Live Transit Map Tracker Modal */}
    <PatientTransitTrackerModal
      open={transitModalOpen}
      appointment={selectedTransitApt}
      patient={patient}
      onClose={() => {
        setTransitModalOpen(false);
        setSelectedTransitApt(null);
      }}
    />
    </>
  );
}
