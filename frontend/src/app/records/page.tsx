'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FileText, Download, Paperclip, FlaskConical, Eye,
  Activity, Heart, Sparkles, FileCheck, Share2,
  Upload, X, CheckCircle2, AlertCircle, CloudUpload, Filter, User,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import {
  medicalResultApi, medicalRequestApi, medicalAttachmentApi,
  requestTypeApi, doctorApi, patientApi,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type {
  MedicalResult, MedicalRequest, MedicalAttachment,
  MedicalRequestType, Doctor, Patient,
} from '@/lib/types';

const TABS = [
  { id: 'requests', label: 'Medical Requests & Attachments', icon: FileText },
  { id: 'results',  label: 'Lab Results',                  icon: FlaskConical },
];

const PREDEFINED_TYPES: Record<number, { name: string; icon: any; color: string; bg: string; desc: string }> = {
  1: { name: 'Laboratory',          icon: Activity,   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  desc: 'Blood work, CBC, Urinalysis, Lipid Profile, etc.' },
  2: { name: 'Imaging',             icon: FileText,   color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',  desc: 'X-Ray, CT Scan, MRI, Ultrasound, Mammogram' },
  3: { name: 'Cardiology-ECG',      icon: Heart,      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   desc: 'Standard 12-Lead Electrocardiogram' },
  4: { name: '2D Echo',             icon: Sparkles,   color: '#ec4899', bg: 'rgba(236,72,153,0.1)',  desc: '2D Echocardiogram with Doppler' },
  5: { name: 'Medical Certificate', icon: FileCheck,  color: '#10b981', bg: 'rgba(16,185,129,0.1)', desc: 'Sick Leave, Fitness to Work, Medical Clearance' },
  6: { name: 'Referral Letter',     icon: Share2,     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  desc: 'Specialist Referral, Hospital Admission Order' },
};

const PREDEFINED_MAP: Record<number, string> = {
  1: 'Laboratory', 2: 'Imaging', 3: 'Cardiology-ECG',
  4: '2D Echo', 5: 'Medical Certificate', 6: 'Referral Letter',
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5055';

const STATUS_V: Record<string, 'success' | 'warning' | 'danger' | 'muted'> = {
  Normal: 'success', Abnormal: 'danger', Borderline: 'warning', Pending: 'warning',
  completed: 'success', pending: 'warning', approved: 'success', rejected: 'danger',
  Completed: 'success', 'In Progress': 'warning', Rejected: 'danger',
};

export default function RecordsPage() {
  const { isAdmin, isReceptionist, isDoctor } = useAuth();

  // Only doctors and admins (not receptionist) can upload attachments
  const canUpload   = isAdmin() || isDoctor();
  // Only admins have a staff-wide view (not receptionist)
  const isStaffView = isAdmin();

  const [tab, setTab]                       = useState('requests');
  const [results, setResults]               = useState<MedicalResult[]>([]);
  const [requests, setRequests]             = useState<MedicalRequest[]>([]);
  const [attachments, setAttachments]       = useState<MedicalAttachment[]>([]);
  const [requestTypes, setRequestTypes]     = useState<MedicalRequestType[]>([]);
  const [doctors, setDoctors]               = useState<Doctor[]>([]);
  const [patients, setPatients]             = useState<Patient[]>([]);
  const [loading, setLoading]               = useState(true);
  const [statusFilter, setStatusFilter]     = useState<string>('all');

  const [selectedRequest, setSelectedRequest] = useState<MedicalRequest | null>(null);
  const [viewRequestModal, setViewRequestModal] = useState(false);

  const [uploadingReqId, setUploadingReqId] = useState<number | null>(null);
  const [dragOverReqId, setDragOverReqId]   = useState<number | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<{ reqId: number; text: string } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.allSettled([
      medicalRequestApi.getMine(),
      medicalAttachmentApi.getMine(),
      medicalResultApi.getMine(),
      requestTypeApi.getAll(),
      doctorApi.getAll(),
      // Load patient list for admin staff-view to show patient names
      isAdmin() ? patientApi.getAll() : Promise.resolve({ data: [] }),
    ]).then(([reqRes, attRes, resRes, rtRes, docRes, patRes]) => {
      if (reqRes.status === 'fulfilled') {
        const d = reqRes.value?.data;
        setRequests(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (attRes.status === 'fulfilled') {
        const d = attRes.value?.data;
        setAttachments(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (resRes.status === 'fulfilled') {
        const d = resRes.value?.data;
        setResults(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (rtRes.status === 'fulfilled') {
        const d = rtRes.value?.data;
        setRequestTypes(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (docRes.status === 'fulfilled') {
        const d = docRes.value?.data;
        setDoctors(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
      if (patRes.status === 'fulfilled') {
        const d = (patRes.value as any)?.data;
        setPatients(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }
    }).finally(() => setLoading(false));
  }, [isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getRequestTypeName = (r: MedicalRequest) => {
    const typeId   = Number(r.requestTypeId ?? (r as any).request_type_id);
    const typeName = (r as any).requestTypeName ?? (r as any).request_type_name;
    if (typeName) return typeName;
    const found = requestTypes.find((t) => Number(t.requestTypeId ?? (t as any).request_type_id) === typeId);
    if (found) {
      const name = (found as any).requestName ?? (found as any).request_type_name ?? (found as any).typeName ?? (found as any).type_name;
      if (name) return name;
    }
    return PREDEFINED_MAP[typeId] ?? `Request #${typeId}`;
  };

  const getDoctorName = (dId: number) => {
    const doc = doctors.find((d) => Number(d.doctorId ?? (d as any).doctor_id) === dId);
    if (!doc) return `Doctor #${dId}`;
    const first = doc.firstName ?? (doc as any).first_name ?? '';
    const last  = doc.lastName  ?? (doc as any).last_name  ?? '';
    return `Dr. ${first} ${last}`.trim() || `Doctor #${dId}`;
  };

  const getPatientName = (pId: number) => {
    if (!pId) return '—';
    const pat = patients.find((p) => Number((p as any).patientId ?? (p as any).patient_id) === pId);
    if (!pat) return `Patient #${pId}`;
    const first = (pat as any).firstName ?? (pat as any).first_name ?? '';
    const last  = (pat as any).lastName  ?? (pat as any).last_name  ?? '';
    return `${first} ${last}`.trim() || `Patient #${pId}`;
  };

  const getRequestAttachments = (requestId: number) => {
    return attachments.filter((a) => Number(a.requestId ?? (a as any).request_id) === Number(requestId));
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['doc','docx'].includes(ext)) return '📝';
    if (['xls','xlsx'].includes(ext)) return '📊';
    return '📎';
  };

  const getFileUrl = (a: MedicalAttachment) => {
    const url = (a as any).fileUrl ?? (a as any).file_url ?? (a as any).filePath ?? (a as any).file_path ?? '';
    if (!url) return '#';
    return url.startsWith('http') ? url : `${API_BASE}${url}`;
  };

  const handleUploadFileToRequest = async (reqId: number, files: FileList | File[]) => {
    if (!reqId || !files || files.length === 0) return;
    setUploadingReqId(reqId);
    const fileList = Array.from(files);

    try {
      for (const file of fileList) {
        await medicalAttachmentApi.upload(reqId, file);
      }
      try {
        await medicalRequestApi.updateStatus(reqId, 3);
      } catch { }

      setRequests((prev) =>
        prev.map((r) => {
          const id = r.requestId ?? (r as any).request_id;
          if (id === reqId) {
            return { ...r, statusId: 3, status_id: 3, status: 'Completed' };
          }
          return r;
        })
      );

      if (selectedRequest && (selectedRequest.requestId === reqId || (selectedRequest as any).request_id === reqId)) {
        setSelectedRequest((prev: any) => prev ? { ...prev, statusId: 3, status_id: 3, status: 'Completed' } : prev);
      }

      setUploadSuccessMsg({ reqId, text: `Attached ${fileList.length} file(s) & completed request!` });
      setTimeout(() => setUploadSuccessMsg(null), 4000);

      medicalAttachmentApi.getMine().then((r) => {
        const d = r?.data;
        setAttachments(Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : []);
      }).catch(() => {});

    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Failed to upload attachment.');
    } finally {
      setUploadingReqId(null);
    }
  };

  const openRequestDetail = (r: MedicalRequest) => {
    setSelectedRequest(r);
    setViewRequestModal(true);
  };

  const filteredRequests = requests.filter((r) => {
    if (statusFilter === 'all') return true;
    const s = (r.status ?? (r as any).status ?? (r.statusId === 3 ? 'Completed' : 'Pending')).toLowerCase();
    return s === statusFilter.toLowerCase();
  });

  // Block receptionist from accessing this page
  if (isReceptionist()) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileText size={28} style={{ color: '#ef4444' }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Access Restricted</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 380 }}>
            Receptionists do not have access to patient medical records, lab results, or attachments.
            Please contact an administrator if you need assistance.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Medical Records</h1>
            <p className="page-subtitle">
              {isStaffView
                ? 'View and manage all patient medical requests, attached results, and lab tests'
                : 'Your medical requests, attached results, and lab tests'}
            </p>
          </div>
        </div>

        <div className="tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {loading ? <Spinner center /> : (
          <>
            {tab === 'requests' && (
              <div className="space-y-4">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Filter size={13} /> Filter:
                    </span>
                    {(['all', 'pending', 'completed'] as const).map((filterVal) => (
                      <button
                        key={filterVal}
                        onClick={() => setStatusFilter(filterVal)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 20,
                          fontSize: 12,
                          fontWeight: 500,
                          border: statusFilter === filterVal ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                          background: statusFilter === filterVal ? 'var(--primary)' : 'var(--card-bg)',
                          color: statusFilter === filterVal ? '#fff' : 'var(--foreground)',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {filterVal}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted">
                    {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {filteredRequests.length === 0 ? (
                  <Card><div className="empty-state">
                    <div className="empty-state-icon"><FileText size={24} /></div>
                    <p className="empty-state-title">No medical requests found</p>
                    <p className="empty-state-desc">
                      {isStaffView
                        ? 'No medical requests exist in the system yet.'
                        : 'Requests created by doctors or assigned to you will appear here.'}
                    </p>
                  </div></Card>
                ) : (
                  <div className="space-y-4">
                    {filteredRequests.map((r) => {
                      const reqId     = r.requestId ?? (r as any).request_id;
                      const reqStatus = r.status ?? (r as any).status ?? (r.statusId === 3 ? 'Completed' : r.statusId === 2 ? 'In Progress' : r.statusId === 4 ? 'Rejected' : 'Pending');
                      const reqDate   = r.requestDate || r.createdAt || (r as any).created_at || (r as any).request_date;
                      const typeId    = Number(r.requestTypeId ?? (r as any).request_type_id);
                      const typeMeta  = PREDEFINED_TYPES[typeId] ?? { name: 'Request', icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
                      const Icon      = typeMeta.icon;
                      const reqAttachments = getRequestAttachments(reqId);
                      const isUploadingThis = uploadingReqId === reqId;
                      const isDraggingThis  = dragOverReqId === reqId;
                      const isCompleted     = reqStatus.toLowerCase() === 'completed' || r.statusId === 3;
                      const isSuccessThis   = uploadSuccessMsg?.reqId === reqId;

                      return (
                        <Card
                          key={reqId}
                          className="card-p"
                          style={{
                            border: isDraggingThis ? '2px dashed var(--primary)' : '1px solid var(--card-border)',
                            background: isDraggingThis ? 'var(--accent)' : 'var(--card-bg)',
                            transition: 'all 0.2s ease',
                          }}
                          onDragOver={(e: React.DragEvent) => {
                            if (canUpload) { e.preventDefault(); e.stopPropagation(); setDragOverReqId(reqId); }
                          }}
                          onDragLeave={(e: React.DragEvent) => {
                            if (canUpload) { e.preventDefault(); e.stopPropagation(); setDragOverReqId(null); }
                          }}
                          onDrop={(e: React.DragEvent) => {
                            if (canUpload) {
                              e.preventDefault(); e.stopPropagation();
                              setDragOverReqId(null);
                              if (e.dataTransfer.files?.length > 0) {
                                handleUploadFileToRequest(reqId, e.dataTransfer.files);
                              }
                            }
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                              <div style={{ width: 44, height: 44, borderRadius: 12, background: typeMeta.bg, color: typeMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Icon size={22} />
                              </div>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <h3 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                                    {getRequestTypeName(r)}
                                  </h3>
                                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>#{reqId}</span>
                                </div>
                                <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                                  {reqDate ? new Date(reqDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                  {r.doctorId ? ` · ${getDoctorName(Number(r.doctorId))}` : ''}
                                </p>
                                {isStaffView && (r as any).patientId && (
                                  <p className="text-xs" style={{ marginTop: 2, color: 'var(--primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <User size={10} style={{ display: 'inline' }} />
                                    {getPatientName(Number((r as any).patientId ?? (r as any).patient_id))}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Badge variant={STATUS_V[reqStatus] ?? 'muted'}>{reqStatus}</Badge>
                              <Button variant="ghost" size="sm" icon={Eye} onClick={() => openRequestDetail(r)}>
                                Details
                              </Button>
                            </div>
                          </div>

                          {r.notes && (
                            <p className="text-xs text-muted" style={{ marginTop: 10, padding: '6px 10px', background: 'var(--accent)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)' }}>
                              <span style={{ fontWeight: 600 }}>Instructions:</span> {r.notes}
                            </p>
                          )}

                          {isSuccessThis && (
                            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius)', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#10b981' }}>
                              <CheckCircle2 size={16} />
                              <span>{uploadSuccessMsg.text}</span>
                            </div>
                          )}

                          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                <Paperclip size={13} />
                                Attached Files ({reqAttachments.length})
                              </span>
                              {isCompleted && (
                                <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <CheckCircle2 size={12} /> Automatically Completed
                                </span>
                              )}
                            </div>

                            {reqAttachments.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 6 }}>
                                No attachments uploaded yet.
                              </p>
                            ) : (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, marginBottom: 8 }}>
                                {reqAttachments.map((att) => (
                                  <div
                                    key={att.attachmentId}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                                      borderRadius: 'var(--radius)', background: 'var(--accent)', border: '1px solid var(--card-border)',
                                    }}
                                  >
                                    <span style={{ fontSize: 16 }}>{getFileIcon(att.fileName ?? '')}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <p className="font-medium text-xs truncate" style={{ color: 'var(--foreground)' }}>
                                        {att.fileName}
                                      </p>
                                      <p className="text-xs text-muted" style={{ fontSize: 10 }}>
                                        {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString() : ''}
                                      </p>
                                    </div>
                                    <a
                                      href={getFileUrl(att)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="Download File"
                                      style={{
                                        padding: '4px 8px', borderRadius: 'var(--radius)',
                                        border: '1px solid var(--card-border)', fontSize: 11,
                                        color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3,
                                      }}
                                    >
                                      <Download size={11} />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}

                            {canUpload && (
                              <div style={{ marginTop: 10 }}>
                                <label
                                  htmlFor={`file-input-${reqId}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    padding: '10px 14px',
                                    borderRadius: 'var(--radius)',
                                    border: isDraggingThis ? '2px dashed var(--primary)' : '1px dashed var(--card-border)',
                                    background: isDraggingThis ? 'rgba(59,130,246,0.08)' : 'transparent',
                                    cursor: isUploadingThis ? 'not-allowed' : 'pointer',
                                    fontSize: 12.5,
                                    color: isDraggingThis ? 'var(--primary)' : 'var(--muted)',
                                    fontWeight: 500,
                                    transition: 'all 0.15s ease',
                                  }}
                                >
                                  <input
                                    id={`file-input-${reqId}`}
                                    type="file"
                                    multiple
                                    disabled={isUploadingThis}
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                      if (e.target.files) handleUploadFileToRequest(reqId, e.target.files);
                                      e.target.value = '';
                                    }}
                                  />
                                  {isUploadingThis ? (
                                    <>
                                      <div style={{ width: 14, height: 14, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                      <span style={{ color: 'var(--primary)' }}>Uploading & Completing Request…</span>
                                    </>
                                  ) : (
                                    <>
                                      <CloudUpload size={16} style={{ color: 'var(--primary)' }} />
                                      <span>
                                        {isDraggingThis
                                          ? 'Drop files here to complete request'
                                          : 'Drag & drop result/file here or click to attach & auto-complete'}
                                      </span>
                                    </>
                                  )}
                                </label>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'results' && (
              results.length === 0 ? (
                <Card><div className="empty-state">
                  <div className="empty-state-icon"><FlaskConical size={24} /></div>
                  <p className="empty-state-title">No lab results</p>
                  <p className="empty-state-desc">
                    {isStaffView
                      ? 'No lab results exist in the system yet.'
                      : 'Your lab results will appear here once available.'}
                  </p>
                </div></Card>
              ) : (
                <div className="space-y-3">
                  {results.map((r) => {
                    const resPatientId = Number((r as any).patientId ?? (r as any).patient_id ?? 0);
                    return (
                    <Card key={r.resultId} className="card-p">
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                          <div style={{ width:44, height:44, borderRadius:12, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', flexShrink: 0 }}>
                            <FlaskConical size={20} style={{ color:'#7c3aed' }} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color:'var(--foreground)' }}>Medical Test Result</p>
                            <p className="text-xs text-muted" style={{ marginTop:2 }}>
                              {r.resultDate ? new Date(r.resultDate).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—'}
                              {r.performedBy && ` · ${r.performedBy}`}
                            </p>
                            {isStaffView && resPatientId > 0 && (
                              <p className="text-xs" style={{ marginTop: 2, color: 'var(--primary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 3 }}>
                                <User size={10} style={{ display: 'inline' }} />
                                {getPatientName(resPatientId)}
                              </p>
                            )}
                            {r.findings && <p className="text-xs text-muted" style={{ marginTop:4 }}>{r.findings}</p>}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Badge variant={STATUS_V[r.status] ?? 'muted'}>{r.status}</Badge>
                          <button style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, color:'var(--muted)', padding:'5px 10px', borderRadius:'var(--radius)', border:'1px solid var(--card-border)' }}>
                            <Download size={12} /> Export
                          </button>
                        </div>
                      </div>
                    </Card>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}

        <Modal
          open={viewRequestModal}
          onClose={() => setViewRequestModal(false)}
          title="Medical Request Details"
          subtitle="Full details of your medical request order and attached results"
          maxWidth={580}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <Button variant="ghost" onClick={() => setViewRequestModal(false)}>Close</Button>
            </div>
          }
        >
          {selectedRequest && (() => {
            const reqId     = selectedRequest.requestId ?? (selectedRequest as any).request_id;
            const typeId    = Number(selectedRequest.requestTypeId ?? (selectedRequest as any).request_type_id);
            const typeName  = getRequestTypeName(selectedRequest);
            const typeMeta  = PREDEFINED_TYPES[typeId] ?? { name: typeName, icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', desc: 'Medical request order' };
            const Icon      = typeMeta.icon;
            const statusStr = selectedRequest.status ?? (selectedRequest as any).status ?? (selectedRequest.statusId === 3 ? 'Completed' : selectedRequest.statusId === 4 ? 'Rejected' : selectedRequest.statusId === 2 ? 'In Progress' : 'Pending');
            const reqDate   = selectedRequest.requestDate || selectedRequest.createdAt || (selectedRequest as any).created_at || (selectedRequest as any).request_date;
            const cId       = Number(selectedRequest.consultationId ?? (selectedRequest as any).consultation_id ?? 0);
            const dId       = Number(selectedRequest.doctorId       ?? (selectedRequest as any).doctor_id ?? 0);
            const pId       = Number((selectedRequest as any).patientId ?? (selectedRequest as any).patient_id ?? 0);
            const modalAttachments = getRequestAttachments(reqId);
            const isUploadingModal = uploadingReqId === reqId;

            return (
              <div className="space-y-4">
                <div style={{ padding: '14px', borderRadius: 'var(--radius)', background: typeMeta.bg, border: `1px solid ${typeMeta.color}30`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--card-bg)', color: typeMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={22} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>{typeName}</h3>
                      <Badge variant={STATUS_V[statusStr] ?? 'warning'}>{statusStr}</Badge>
                    </div>
                    <p className="text-xs text-muted" style={{ marginTop: 2 }}>{typeMeta.desc}</p>
                  </div>
                </div>

                <div className="space-y-3" style={{ fontSize: 13.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                    <span className="text-muted">Request Type</span>
                    <span className="font-semibold" style={{ color: 'var(--foreground)' }}>{typeName}</span>
                  </div>

                  {isStaffView && pId > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Patient</span>
                      <span className="font-medium" style={{ color: 'var(--primary)' }}>{getPatientName(pId)}</span>
                    </div>
                  )}

                  {reqDate && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Issued Date</span>
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{new Date(reqDate).toLocaleString()}</span>
                    </div>
                  )}

                  {cId > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Associated Consultation</span>
                      <span className="font-medium" style={{ color: 'var(--primary)' }}>Medical Consultation #{cId}</span>
                    </div>
                  )}

                  {dId > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Attending Doctor</span>
                      <span className="font-medium" style={{ color: 'var(--foreground)' }}>{getDoctorName(dId)}</span>
                    </div>
                  )}

                  {canUpload && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>
                      <span className="text-muted">Request Status</span>
                      <select
                        value={selectedRequest.statusId ?? (selectedRequest as any).status_id ?? 1}
                        onChange={async (e) => {
                          const newStatusId = Number(e.target.value);
                          try {
                            await medicalRequestApi.updateStatus(reqId, newStatusId);
                            const newStatusStr = newStatusId === 3 ? 'Completed' : newStatusId === 2 ? 'In Progress' : newStatusId === 4 ? 'Rejected' : 'Pending';
                            setSelectedRequest((prev: any) => prev ? { ...prev, statusId: newStatusId, status_id: newStatusId, status: newStatusStr } : prev);
                            setRequests((prev) => prev.map((r) => ((r.requestId ?? (r as any).request_id) === reqId ? { ...r, statusId: newStatusId, status_id: newStatusId, status: newStatusStr } : r)));
                          } catch (err) {
                            console.error('Failed to update status', err);
                          }
                        }}
                        style={{
                          padding: '5px 10px', borderRadius: 'var(--radius)',
                          border: '1px solid var(--card-border)', background: 'var(--card-bg)',
                          fontSize: 12.5, fontWeight: 500, color: 'var(--foreground)', cursor: 'pointer',
                        }}
                      >
                        <option value={1}>Pending</option>
                        <option value={2}>In Progress</option>
                        <option value={3}>Completed</option>
                        <option value={4}>Rejected</option>
                      </select>
                    </div>
                  )}

                  {selectedRequest.notes && (
                    <div style={{ marginTop: 10 }}>
                      <p className="text-xs font-semibold text-muted" style={{ marginBottom: 6 }}>Clinical Instructions / Notes</p>
                      <div style={{ padding: '10px 12px', background: 'var(--accent)', borderRadius: 'var(--radius)', border: '1px solid var(--card-border)', fontSize: 13, lineHeight: 1.5 }}>
                        {selectedRequest.notes}
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
                    <p className="text-xs font-semibold text-muted" style={{ marginBottom: 8 }}>
                      Attached Files ({modalAttachments.length})
                    </p>
                    {modalAttachments.length === 0 ? (
                      <p className="text-xs text-muted" style={{ fontStyle: 'italic' }}>No files attached yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {modalAttachments.map((att) => (
                          <div
                            key={att.attachmentId}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', background: 'var(--accent)', borderRadius: 'var(--radius)',
                              border: '1px solid var(--card-border)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              <span style={{ fontSize: 16 }}>{getFileIcon(att.fileName ?? '')}</span>
                              <span className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>
                                {att.fileName}
                              </span>
                            </div>
                            <a
                              href={getFileUrl(att)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                padding: '4px 8px', borderRadius: 'var(--radius)',
                                border: '1px solid var(--card-border)', fontSize: 11,
                                color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <Download size={12} /> Download
                            </a>
                          </div>
                        ))}
                      </div>
                    )}

                    {canUpload && (
                      <div style={{ marginTop: 12 }}>
                        <label
                          htmlFor="modal-file-upload"
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px dashed var(--card-border)',
                            cursor: isUploadingModal ? 'not-allowed' : 'pointer', fontSize: 12, color: 'var(--primary)',
                            fontWeight: 500, background: 'var(--card-bg)',
                          }}
                        >
                          <input
                            id="modal-file-upload"
                            type="file"
                            multiple
                            disabled={isUploadingModal}
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              if (e.target.files) handleUploadFileToRequest(reqId, e.target.files);
                              e.target.value = '';
                            }}
                          />
                          {isUploadingModal ? (
                            <span>Uploading & Completing…</span>
                          ) : (
                            <>
                              <Upload size={14} />
                              <span>Attach new file & mark completed</span>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </Modal>
      </div>

      {/* Spinner animation for upload progress indicators */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  );
}
