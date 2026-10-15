'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Video, FileText, Calendar, Clock, Plus, Save, Stethoscope, User,
  Activity, Heart, FileCheck, Share2, AlertCircle, CheckCircle2, ChevronRight, Sparkles, Filter, Search, Eye, BadgeCheck
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { consultationApi, medicalRequestApi, requestTypeApi, patientApi, doctorApi, appointmentApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Consultation, MedicalRequest, MedicalRequestType, Patient, Doctor, Appointment } from '@/lib/types';

// Dynamic visual metadata resolver for fetched request types
function getRequestTypeVisual(name: string, id: number = 0) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('lab') || lower.includes('blood') || lower.includes('urin')) {
    return { icon: Activity, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', desc: 'Blood work, CBC, Urinalysis, Lipid Profile, etc.' };
  }
  if (lower.includes('imag') || lower.includes('x-ray') || lower.includes('ct') || lower.includes('mri') || lower.includes('ultra')) {
    return { icon: FileText, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', desc: 'X-Ray, CT Scan, MRI, Ultrasound, Mammogram' };
  }
  if (lower.includes('ecg') || lower.includes('cardio') || lower.includes('heart')) {
    return { icon: Heart, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', desc: 'Standard 12-Lead Electrocardiogram' };
  }
  if (lower.includes('echo')) {
    return { icon: Sparkles, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', desc: '2D Echocardiogram with Doppler' };
  }
  if (lower.includes('cert') || lower.includes('clearance') || lower.includes('fit') || lower.includes('leave')) {
    return { icon: FileCheck, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', desc: 'Sick Leave, Fitness to Work, Medical Clearance' };
  }
  if (lower.includes('refer') || lower.includes('letter') || lower.includes('admission')) {
    return { icon: Share2, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', desc: 'Specialist Referral, Hospital Admission Order' };
  }

  const fallbackStyles = [
    { icon: Activity, color: '#0284c7', bg: 'rgba(2, 132, 199, 0.1)', desc: 'Clinical evaluation and diagnostic request' },
    { icon: FileText, color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.1)', desc: 'Medical examination and records request' },
    { icon: Heart, color: '#e11d48', bg: 'rgba(225, 29, 72, 0.1)', desc: 'Specialized healthcare diagnostic test' },
    { icon: FileCheck, color: '#059669', bg: 'rgba(5, 150, 105, 0.1)', desc: 'Official medical document or clearance' },
  ];
  return fallbackStyles[Math.abs(id) % fallbackStyles.length];
}

function ConsultationsContent() {
  const { isDoctor, isAdmin, isPatient, isReceptionist } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const paramId = searchParams.get('id');
  const paramAptId = searchParams.get('appointmentId');

  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [requestTypes, setRequestTypes] = useState<MedicalRequestType[]>([]);
  const [medicalRequests, setMedicalRequests] = useState<MedicalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Active Consultation Workspace State
  const [activeConsultation, setActiveConsultation] = useState<Consultation | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [savingConsultation, setSavingConsultation] = useState(false);
  const [completingConsultation, setCompletingConsultation] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Form fields for active consultation
  const [formDiagnosis, setFormDiagnosis] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formTreatment, setFormTreatment] = useState('');
  const [formPrescription, setFormPrescription] = useState('');

  // Medical Request Modal State
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<number>(1);
  const [requestNotes, setRequestNotes] = useState('');
  const [creatingRequest, setCreatingRequest] = useState(false);
  const [requestSuccessMsg, setRequestSuccessMsg] = useState('');

  // View Medical Request Detail State
  const [selectedRequest, setSelectedRequest] = useState<MedicalRequest | null>(null);
  const [viewRequestModalOpen, setViewRequestModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, pRes, dRes, rtRes, mrRes, aptRes] = await Promise.allSettled([
        isAdmin() ? consultationApi.getAll() : consultationApi.getMine(),
        patientApi.getAll(),
        doctorApi.getAll(),
        requestTypeApi.getAll(),
        medicalRequestApi.getMine(),
        appointmentApi.getMine(),
      ]);

      let cList: Consultation[] = [];
      if (cRes.status === 'fulfilled') {
        const d = cRes.value?.data;
        cList = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setConsultations(cList);
      }

      if (aptRes.status === 'fulfilled') {
        const d = aptRes.value?.data;
        setAppointments(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }

      if (pRes.status === 'fulfilled') {
        const d = pRes.value?.data;
        setPatients(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }

      if (dRes.status === 'fulfilled') {
        const d = dRes.value?.data;
        setDoctors(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }

      let rtList: MedicalRequestType[] = [];
      if (rtRes.status === 'fulfilled') {
        const d = rtRes.value?.data;
        rtList = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : [];
        setRequestTypes(rtList);
        if (rtList.length > 0) {
          const raw = rtList[0] as unknown as Record<string, unknown>;
          const firstId = Number(rtList[0].requestTypeId ?? raw.request_type_id ?? 0);
          if (firstId > 0) {
            setSelectedTypeId(firstId);
          }
        }
      }

      if (mrRes.status === 'fulfilled') {
        const d = mrRes.value?.data;
        setMedicalRequests(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }

      // Auto-open consultation workspace if id or appointmentId passed in query
      if (paramId) {
        const found = cList.find(c => Number(c.consultationId ?? (c as any).consultation_id) === Number(paramId));
        if (found) {
          openWorkspace(found);
        }
      } else if (paramAptId) {
        const found = cList.find(c => Number(c.appointmentId ?? (c as any).appointment_id) === Number(paramAptId));
        if (found) {
          openWorkspace(found);
        }
      }
    } catch (err) {
      console.error('Failed loading consultations data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [paramId, paramAptId]);

  // Helper resolvers
  const getPatientName = (pId: number) => {
    const p = patients.find(x => Number(x.patientId ?? (x as any).patient_id) === pId);
    if (!p) return 'Patient';
    const raw = p as unknown as Record<string, unknown>;
    const first = String(p.firstName ?? raw.first_name ?? '').trim();
    const middle = String(p.middleName ?? raw.middle_name ?? '').trim();
    const last = String(p.lastName ?? raw.last_name ?? '').trim();
    const full = [first, middle, last].filter(Boolean).join(' ');
    return full || 'Patient';
  };

  const getDoctorName = (dId: number) => {
    const d = doctors.find(x => Number(x.doctorId ?? (x as any).doctor_id) === dId);
    if (!d) return `Doctor #${dId}`;
    return `Dr. ${d.firstName ?? (d as any).first_name ?? ''} ${d.lastName ?? (d as any).last_name ?? ''}`.trim() || `Doctor #${dId}`;
  };

  const getTypeName = (typeId: number) => {
    const foundDB = requestTypes.find(t => {
      const raw = t as unknown as Record<string, unknown>;
      return Number(t.requestTypeId ?? raw.request_type_id) === typeId;
    });
    if (foundDB) {
      const raw = foundDB as unknown as Record<string, unknown>;
      const name = foundDB.requestName ?? raw.request_name ?? foundDB.typeName ?? raw.type_name;
      if (name) return String(name);
    }
    return `Request Type #${typeId}`;
  };

  // Derive request types list directly from API fetch
  const availableTypes = requestTypes.map((rt) => {
    const raw = rt as unknown as Record<string, unknown>;
    const id = Number(rt.requestTypeId ?? raw.request_type_id ?? 0);
    const name = String(rt.requestName ?? raw.request_name ?? rt.typeName ?? raw.type_name ?? `Request Type #${id}`);
    const visual = getRequestTypeVisual(name, id);
    return {
      id,
      name,
      icon: visual.icon,
      color: visual.color,
      bg: visual.bg,
      desc: visual.desc,
    };
  });

  const getConsultationId = (c: Consultation): number => {
    return Number(c.consultationId ?? (c as any).consultation_id ?? 0);
  };

  const getAppointmentId = (c: Consultation): number => {
    return Number(c.appointmentId ?? (c as any).appointment_id ?? 0);
  };

  const getPatientId = (c: Consultation): number => {
    return Number(c.patientId ?? (c as any).patient_id ?? 0);
  };

  const getDoctorId = (c: Consultation): number => {
    return Number(c.doctorId ?? (c as any).doctor_id ?? 0);
  };

  const isConsultationCompleted = (c: Consultation | null): boolean => {
    if (!c) return false;
    if (c.completedAt ?? (c as any).completed_at) return true;
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

  const canEdit = isDoctor() || isAdmin() || isReceptionist();

  // Open Workspace / View Details
  const openWorkspace = (c: Consultation) => {
    setActiveConsultation(c);
    setFormDiagnosis(c.diagnosis ?? (c as any).diagnosis ?? '');
    setFormNotes(c.consultationNotes ?? (c as any).consultation_notes ?? c.notes ?? (c as any).notes ?? '');
    setFormTreatment(c.treatmentPlan ?? (c as any).treatment_plan ?? (c as any).treatment ?? '');
    setFormPrescription(c.prescription ?? (c as any).prescription ?? '');
    setSaveSuccessMsg('');
    setRequestSuccessMsg('');
    setWorkspaceOpen(true);
  };

  // Save Consultation details
  const handleSaveConsultation = async () => {
    if (!activeConsultation || !canEdit) return;
    const cId = getConsultationId(activeConsultation);
    setSavingConsultation(true);
    setSaveSuccessMsg('');
    try {
      const payload = {
        consultation_id: cId,
        consultationId: cId,
        appointment_id: getAppointmentId(activeConsultation),
        appointmentId: getAppointmentId(activeConsultation),
        patient_id: getPatientId(activeConsultation),
        patientId: getPatientId(activeConsultation),
        doctor_id: getDoctorId(activeConsultation),
        doctorId: getDoctorId(activeConsultation),
        diagnosis: formDiagnosis,
        consultation_notes: formNotes,
        consultationNotes: formNotes,
        treatment_plan: formTreatment,
        treatmentPlan: formTreatment,
        prescription: formPrescription,
      };

      await consultationApi.update(cId, payload);
      setSaveSuccessMsg('Consultation records saved successfully!');

      // Update local state list
      setConsultations(prev => prev.map(item => {
        if (getConsultationId(item) === cId) {
          return {
            ...item,
            diagnosis: formDiagnosis,
            consultationNotes: formNotes,
            treatmentPlan: formTreatment,
            prescription: formPrescription,
          };
        }
        return item;
      }));

      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to update consultation.');
    } finally {
      setSavingConsultation(false);
    }
  };

  // Mark consultation as complete
  const handleCompleteConsultation = async () => {
    if (!activeConsultation || !canEdit) return;
    const cId = getConsultationId(activeConsultation);
    const alreadyDone = isConsultationCompleted(activeConsultation);
    if (alreadyDone) return;
    if (!window.confirm('Mark this consultation as completed? This cannot be undone.')) return;
    setCompletingConsultation(true);
    try {
      const res = await consultationApi.complete(cId);
      const updated = res.data;
      const completedAt = updated?.completedAt ?? updated?.completed_at ?? new Date().toISOString();
      setActiveConsultation(prev => prev ? { ...prev, completedAt } : prev);
      setConsultations(prev => prev.map(item =>
        getConsultationId(item) === cId ? { ...item, completedAt } : item
      ));

      // Also ensure associated appointment is updated to Completed (3)
      const aId = getAppointmentId(activeConsultation);
      if (aId) {
        try {
          const apt = appointments.find(a => Number(a.appointmentId ?? (a as any).appointment_id) === aId);
          if (apt) {
            await appointmentApi.update(aId, { ...apt, statusId: 3, status_id: 3, status: 'Completed' });
            setAppointments(prev => prev.map(a => Number(a.appointmentId ?? (a as any).appointment_id) === aId ? { ...a, statusId: 3, status_id: 3, status: 'Completed' } : a));
          }
        } catch { }
      }

      setSaveSuccessMsg('Consultation marked as completed!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to complete consultation.');
    } finally {
      setCompletingConsultation(false);
    }
  };

  // Submit Medical Request
  const handleCreateMedicalRequest = async () => {
    if (!activeConsultation || !canEdit) return;
    const cId = getConsultationId(activeConsultation);
    const pId = getPatientId(activeConsultation);
    const dId = getDoctorId(activeConsultation);

    setCreatingRequest(true);
    try {
      const payload = {
        consultation_id: cId,
        consultationId: cId,
        patient_id: pId,
        patientId: pId,
        doctor_id: dId,
        doctorId: dId,
        request_type_id: selectedTypeId,
        requestTypeId: selectedTypeId,
        notes: requestNotes,
        status_id: 1,
        statusId: 1,
      };

      const res = await medicalRequestApi.create(payload);
      const created = res.data;

      // Add to local state
      setMedicalRequests(prev => [created, ...prev]);
      setRequestSuccessMsg(`Medical request #${created.requestId ?? (created as any).request_id} created successfully!`);
      setRequestModalOpen(false);
      setRequestNotes('');

      setTimeout(() => setRequestSuccessMsg(''), 5000);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to create medical request.');
    } finally {
      setCreatingRequest(false);
    }
  };

  // Filter consultations
  const filteredConsultations = consultations.filter(c => {
    const cId = getConsultationId(c);
    const pName = getPatientName(getPatientId(c)).toLowerCase();
    const dName = getDoctorName(getDoctorId(c)).toLowerCase();
    const diag = (c.diagnosis ?? '').toLowerCase();
    const search = searchTerm.toLowerCase();

    return !search || cId.toString().includes(search) || pName.includes(search) || dName.includes(search) || diag.includes(search);
  });

  // Get active consultation requests
  const activeRequests = activeConsultation
    ? medicalRequests.filter(r => Number(r.consultationId ?? (r as any).consultation_id) === getConsultationId(activeConsultation))
    : [];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Page Header */}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="page-title">Consultations</h1>
            <p className="page-subtitle">
              {canEdit
                ? 'Manage doctor consultations, medical notes, treatment plans, and requests'
                : 'View your doctor consultations, medical notes, treatment plans, and medical requests'}
            </p>
          </div>
        </div>

        {/* Search bar & Stats */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: 36 }}
              placeholder="Search by Patient name, Doctor name, or Diagnosis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 12 }}>
            <span>Total: <strong>{consultations.length}</strong></span>
          </div>
        </div>

        {/* Consultation List */}
        {loading ? (
          <Spinner center />
        ) : filteredConsultations.length === 0 ? (
          <Card>
            <div className="empty-state">
              <div className="empty-state-icon"><Video size={24} /></div>
              <p className="empty-state-title">No consultations found</p>
              <p className="empty-state-desc">
                {searchTerm ? 'No consultations match your search term.' : 'Consultation records will appear here once started.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredConsultations.map((c) => {
              const cId = getConsultationId(c);
              const pId = getPatientId(c);
              const dId = getDoctorId(c);
              const aptId = getAppointmentId(c);
              const diag = c.diagnosis ?? (c as any).diagnosis ?? '';
              const notes = c.consultationNotes ?? (c as any).consultation_notes ?? c.notes ?? '';
              const dateStr = c.createdAt ?? (c as any).created_at ?? '';

              const reqCount = medicalRequests.filter(r => Number(r.consultationId ?? (r as any).consultation_id) === cId).length;

              return (
                <Card key={`c-${cId}`} className="card-p">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'var(--primary-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Stethoscope size={22} style={{ color: 'var(--primary)' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <p className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                              Medical Consultation
                            </p>
                            {isConsultationCompleted(c) ? (
                              <Badge variant="success">Completed</Badge>
                            ) : (
                              <Badge variant="warning">In Progress</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted" style={{ marginTop: 3 }}>
                            {isDoctor() || isReceptionist()
                               ? `Patient: ${getPatientName(pId)} - ${getDoctorName(dId)}`
                               : `${getDoctorName(dId)}`}
                          </p>
                        </div>

                        <Button
                          variant="primary"
                          size="sm"
                          icon={ChevronRight}
                          onClick={() => openWorkspace(c)}
                          style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                          {canEdit ? 'Open Workspace' : 'View Details'}
                        </Button>
                      </div>

                      {diag ? (
                        <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)' }}>
                          <p style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--primary)', marginBottom: 2 }}>Diagnosis</p>
                          <p className="text-sm font-medium">{diag}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted" style={{ marginTop: 8, fontStyle: 'italic' }}>No diagnosis entered yet.</p>
                      )}

                      {notes && (
                        <p className="text-xs text-muted" style={{ marginTop: 6, lineClamp: 2 }}>
                          {notes}
                        </p>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} /> {dateStr ? new Date(dateStr).toLocaleDateString() : '—'}
                        </span>
                        {reqCount > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 500 }}>
                            <Sparkles size={13} /> {reqCount} Medical Request{reqCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Consultation Workspace / Details Drawer / Modal ───────────────────────────────── */}
        {activeConsultation && (
          <Modal
            open={workspaceOpen}
            onClose={() => setWorkspaceOpen(false)}
            title={canEdit ? 'Consultation Workspace' : 'Consultation Details'}
            subtitle={`Patient: ${getPatientName(getPatientId(activeConsultation))} · ${getDoctorName(getDoctorId(activeConsultation))}`}
            maxWidth={720}
            footer={
              canEdit ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                  <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setRequestModalOpen(true)}
                  >
                    Create Medical Request
                  </Button>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button variant="ghost" onClick={() => setWorkspaceOpen(false)}>Close</Button>
                    <Button variant="primary" icon={Save} loading={savingConsultation} onClick={handleSaveConsultation}>
                      Save Consultation
                    </Button>
                    {isConsultationCompleted(activeConsultation) ? (
                      <Button
                        variant="success"
                        icon={BadgeCheck}
                        disabled
                      >
                        Completed
                      </Button>
                    ) : (
                      <Button
                        variant="success"
                        icon={CheckCircle2}
                        loading={completingConsultation}
                        onClick={handleCompleteConsultation}
                      >
                        Complete Consultation
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                  <Button variant="ghost" onClick={() => setWorkspaceOpen(false)}>Close</Button>
                </div>
              )
            }
          >
            <div className="space-y-5">
              {/* Success Banners */}
              {saveSuccessMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', fontSize: 13 }}>
                  <CheckCircle2 size={16} />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {requestSuccessMsg && (
                <div style={{ padding: '10px 14px', borderRadius: 'var(--radius)', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', fontSize: 13 }}>
                  <CheckCircle2 size={16} />
                  <span>{requestSuccessMsg}</span>
                </div>
              )}

              {/* Consultation Details */}
              {canEdit ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                  {/* Diagnosis */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stethoscope size={15} style={{ color: 'var(--primary)' }} />
                      Diagnosis
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Essential Hypertension, Acute Upper Respiratory Infection..."
                      value={formDiagnosis}
                      onChange={(e) => setFormDiagnosis(e.target.value)}
                    />
                  </div>

                  {/* Consultation Notes */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={15} style={{ color: 'var(--primary)' }} />
                      Consultation Notes / History of Present Illness
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Enter clinical observations, chief complaints, symptoms, physical examination findings..."
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>

                  {/* Treatment Plan */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={15} style={{ color: 'var(--primary)' }} />
                      Treatment Plan & Clinical Advice
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="Enter management plan, lifestyle advice, follow-up instructions..."
                      value={formTreatment}
                      onChange={(e) => setFormTreatment(e.target.value)}
                    />
                  </div>

                  {/* Prescription */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={15} style={{ color: 'var(--primary)' }} />
                      Prescription / Medications
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="e.g. Amoxicillin 500mg - 1 tab 3x daily for 7 days&#10;Paracetamol 500mg - 1 tab as needed for fever"
                      value={formPrescription}
                      onChange={(e) => setFormPrescription(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                  {/* Read-only Diagnosis */}
                  <div style={{ padding: '12px 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px solid var(--accent-border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Stethoscope size={15} /> Diagnosis
                    </p>
                    <p className="text-sm font-medium" style={{ color: formDiagnosis ? 'var(--foreground)' : 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                      {formDiagnosis || 'No diagnosis recorded.'}
                    </p>
                  </div>

                  {/* Read-only Notes */}
                  <div style={{ padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={15} style={{ color: 'var(--primary)' }} /> Consultation Notes / History
                    </p>
                    <p className="text-sm" style={{ color: formNotes ? 'var(--foreground)' : 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {formNotes || 'No notes provided.'}
                    </p>
                  </div>

                  {/* Read-only Treatment */}
                  <div style={{ padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Activity size={15} style={{ color: 'var(--primary)' }} /> Treatment Plan & Clinical Advice
                    </p>
                    <p className="text-sm" style={{ color: formTreatment ? 'var(--foreground)' : 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {formTreatment || 'No treatment plan recorded.'}
                    </p>
                  </div>

                  {/* Read-only Prescription */}
                  <div style={{ padding: '12px 14px', background: 'var(--card-bg)', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={15} style={{ color: 'var(--primary)' }} /> Prescription / Medications
                    </p>
                    <p className="text-sm" style={{ color: formPrescription ? 'var(--foreground)' : 'var(--muted)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                      {formPrescription || 'No prescription recorded.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Medical Requests Section */}
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                      Medical Requests Issued ({activeRequests.length})
                    </h3>
                    <p className="text-xs text-muted">Laboratory, Imaging, ECG, Echo, Certificates, Referrals tied to this consultation</p>
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Plus}
                      onClick={() => setRequestModalOpen(true)}
                    >
                      + Create Request
                    </Button>
                  )}
                </div>

                {activeRequests.length === 0 ? (
                  <div style={{ padding: '16px', borderRadius: 'var(--radius)', background: 'var(--accent)', border: '1px dashed var(--card-border)', textAlign: 'center' }}>
                    <p className="text-xs text-muted">No medical requests issued yet for this consultation session.</p>
                    {canEdit && (
                      <button
                        type="button"
                        style={{ marginTop: 8, color: 'var(--primary)', fontWeight: 600, fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => setRequestModalOpen(true)}
                      >
                        + Create First Medical Request
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeRequests.map((req) => {
                      const reqId = Number(req.requestId ?? (req as any).request_id);
                      const tId = Number(req.requestTypeId ?? (req as any).request_type_id);
                      const tName = getTypeName(tId);
                      const visual = getRequestTypeVisual(tName, tId);

                      const Icon = visual.icon;
                      const badgeBg = visual.bg;
                      const badgeColor = visual.color;
                      const reqStatus = req.status ?? (req as any).status ?? (req.statusId === 3 ? 'Completed' : req.statusId === 4 ? 'Rejected' : req.statusId === 2 ? 'In Progress' : 'Pending');

                      return (
                        <div
                          key={`req-${reqId}`}
                          onClick={() => {
                            setSelectedRequest(req);
                            setViewRequestModalOpen(true);
                          }}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 'var(--radius)',
                            background: 'var(--card-bg)',
                            border: '1px solid var(--card-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 8,
                              background: badgeBg, color: badgeColor,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              <Icon size={18} />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="font-semibold text-xs" style={{ color: 'var(--foreground)' }}>
                                  {tName}
                                </span>
                              </div>
                              {req.notes && (
                                <p className="text-xs text-muted" style={{ marginTop: 2 }}>{req.notes}</p>
                              )}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Badge variant={reqStatus === 'Completed' ? 'success' : reqStatus === 'Rejected' ? 'danger' : 'info'}>{reqStatus}</Badge>
                            <Button variant="ghost" size="sm" icon={Eye} onClick={() => { setSelectedRequest(req); setViewRequestModalOpen(true); }}>
                              View Details
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {/* ── View Medical Request Detail Modal ───────────────────────────────── */}
        <Modal
          open={viewRequestModalOpen}
          onClose={() => setViewRequestModalOpen(false)}
          title="Medical Request Details"
          subtitle="Full details of the issued medical request"
          maxWidth={540}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="ghost" onClick={() => setViewRequestModalOpen(false)}>Close</Button>
            </div>
          }
        >
          {selectedRequest && (() => {
            const reqId = selectedRequest.requestId ?? (selectedRequest as any).request_id;
            const tId = Number(selectedRequest.requestTypeId ?? (selectedRequest as any).request_type_id);
            const tName = getTypeName(tId);
            const visual = getRequestTypeVisual(tName, tId);
            const Icon = visual.icon;
            const bg = visual.bg;
            const color = visual.color;
            const reqStatus = selectedRequest.status ?? (selectedRequest as any).status ?? (selectedRequest.statusId === 3 ? 'Completed' : selectedRequest.statusId === 4 ? 'Rejected' : selectedRequest.statusId === 2 ? 'In Progress' : 'Pending');
            const reqDate = selectedRequest.requestDate || selectedRequest.createdAt || (selectedRequest as any).created_at || (selectedRequest as any).request_date;
            const cId = Number(selectedRequest.consultationId ?? (selectedRequest as any).consultation_id ?? 0);
            const dId = Number(selectedRequest.doctorId ?? (selectedRequest as any).doctor_id ?? 0);
            const pId = Number(selectedRequest.patientId ?? (selectedRequest as any).patient_id ?? 0);

            return (
              <div className="space-y-4">
                {/* Header Card */}
                <div style={{ padding: '14px', borderRadius: 'var(--radius)', background: bg, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--card-bg)', color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{tName}</h3>
                      <Badge variant={reqStatus === 'Completed' ? 'success' : reqStatus === 'Rejected' ? 'danger' : 'warning'}>{reqStatus}</Badge>
                    </div>
                    <p className="text-xs text-muted" style={{ marginTop: 2 }}>{visual.desc}</p>
                  </div>
                </div>

                {/* Details list */}
                <div className="space-y-3" style={{ fontSize: 13.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                    <span className="text-muted">Request Type</span>
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{tName}</span>
                  </div>

                  {reqDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Issued Date</span>
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{new Date(reqDate).toLocaleString()}</span>
                    </div>
                  )}

                  {cId > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Associated Consultation</span>
                      <span className="font-medium" style={{ color: 'var(--primary)' }}>Medical Consultation</span>
                    </div>
                  )}

                  {pId > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Patient</span>
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{getPatientName(pId)}</span>
                    </div>
                  )}

                  {dId > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Attending Doctor</span>
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{getDoctorName(dId)}</span>
                    </div>
                  )}

                  {/* Notes */}
                  <div style={{ marginTop: 12 }}>
                    <p className="text-xs font-semibold text-muted" style={{ marginBottom: 6 }}>Clinical Instructions / Notes</p>
                    <div style={{ padding: '12px 14px', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)', fontSize: 13, lineHeight: 1.5 }}>
                      {selectedRequest.notes ? selectedRequest.notes : <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>No additional instructions recorded.</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>

        {/* ── Create Medical Request Modal ────────────────────────────────────────── */}
        <Modal
          open={requestModalOpen}
          onClose={() => setRequestModalOpen(false)}
          title="Create Medical Request"
          subtitle={activeConsultation ? `Tied to Consultation #${getConsultationId(activeConsultation)} · Patient: ${getPatientName(getPatientId(activeConsultation))}` : 'Issue a new medical request'}
          maxWidth={540}
          footer={
            <>
              <Button variant="ghost" onClick={() => setRequestModalOpen(false)}>Cancel</Button>
              <Button variant="primary" loading={creatingRequest} onClick={handleCreateMedicalRequest}>
                Submit Medical Request
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="form-label" style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
                Select Request Type
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {availableTypes.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0', color: 'var(--muted)' }}>
                    <Spinner size="sm" center />
                    <p style={{ marginTop: 8, fontSize: 12 }}>Loading request types…</p>
                  </div>
                ) : (
                  availableTypes.map((typeItem) => {
                    const isSelected = selectedTypeId === typeItem.id;
                    const Icon = typeItem.icon;
                  return (
                    <div
                      key={`type-card-${typeItem.id}`}
                      onClick={() => setSelectedTypeId(typeItem.id)}
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius)',
                        border: isSelected ? `2px solid ${typeItem.color}` : '1px solid var(--card-border)',
                        background: isSelected ? typeItem.bg : 'var(--card-bg)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Icon size={18} style={{ color: typeItem.color }} />
                          <span className="font-semibold text-xs" style={{ color: isSelected ? typeItem.color : 'var(--foreground)' }}>
                            {typeItem.name}
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 size={14} style={{ color: typeItem.color }} />}
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.3 }}>
                        {typeItem.desc}
                      </p>
                    </div>
                  );
                }))}
              </div>
            </div>

            {/* Request Details / Instructions */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>
                Clinical Instructions / Request Notes
              </label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Specify details (e.g. Fasting blood sugar & Lipid profile; Chest X-Ray PA view; Sick leave for 3 days due to acute viral infection)..."
                value={requestNotes}
                onChange={(e) => setRequestNotes(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}

export default function ConsultationsPage() {
  return (
    <Suspense fallback={<Spinner center />}>
      <ConsultationsContent />
    </Suspense>
  );
}
