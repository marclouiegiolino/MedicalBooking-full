'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ChevronLeft, Calendar, Star,
  Clock, Plus, Edit, Trash2, CheckCircle2, AlertCircle,
  Building2, MapPin, Phone, Mail, Camera, ZoomIn
} from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import MobileDoctorDetail from '@/components/mobile/MobileDoctorDetail';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';

// Dynamic import: react-easy-crop uses browser-only APIs → must disable SSR
const PhotoCropModal = dynamic(() => import('@/components/ui/PhotoCropModal'), {
  ssr: false,
  loading: () => null,
});
import {
  doctorApi, doctorScheduleApi, specialtyApi, departmentApi,
  reviewApi, patientApi, hospitalInformationApi
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type {
  Doctor, DoctorSchedule, Specialty, Department,
  Review, Patients, HospitalInformation
} from '@/lib/types';

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function DoctorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isDoctor, isPatient, isAdmin } = useAuth();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [schedules, setSchedules] = useState<DoctorSchedule[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hospitals, setHospitals] = useState<HospitalInformation[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [patients, setPatients] = useState<Patients[]>([]);
  const [myPatientProfile, setMyPatientProfile] = useState<Patients | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('about');

  // Photo upload state
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError]         = useState('');
  const [avatarHover, setAvatarHover]       = useState(false);
  const [cropSrc, setCropSrc]               = useState<string | null>(null); // raw image for cropper
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');

  const loadDoctorData = useCallback(async () => {
    const docId = Number(id);
    try {
      const [docRes, schRes, spRes, deptRes, revRes, patRes, hospRes] = await Promise.allSettled([
        doctorApi.getById(docId).catch(() => null),
        doctorScheduleApi.getByDoctorId(docId).catch(() => ({ data: [] })),
        specialtyApi.getAll().catch(() => ({ data: [] })),
        departmentApi.getAll().catch(() => ({ data: [] })),
        reviewApi.getAll().catch(() => ({ data: [] })),
        patientApi.getAll().catch(() => ({ data: [] })),
        hospitalInformationApi.getAll().catch(() => ({ data: [] })),
      ]);

      if (docRes.status === 'fulfilled' && docRes.value?.data) {
        setDoctor(docRes.value.data);
      }
      if (schRes.status === 'fulfilled' && schRes.value?.data) {
        setSchedules(extractList<DoctorSchedule>(schRes.value.data));
      }
      if (spRes.status === 'fulfilled' && spRes.value?.data) {
        setSpecialties(extractList<Specialty>(spRes.value.data));
      }
      if (deptRes.status === 'fulfilled' && deptRes.value?.data) {
        setDepartments(extractList<Department>(deptRes.value.data));
      }
      if (hospRes.status === 'fulfilled' && hospRes.value?.data) {
        setHospitals(extractList<HospitalInformation>(hospRes.value.data));
      }
      if (revRes.status === 'fulfilled' && revRes.value?.data) {
        const allRev = extractList<Review>(revRes.value.data);
        const docReviews = allRev.filter((r) => {
          const raw = r as unknown as Record<string, unknown>;
          const rDocId = Number(r.doctorId || raw.doctor_id || 0);
          return rDocId === docId;
        });
        setReviews(docReviews);
      }
      if (patRes.status === 'fulfilled' && patRes.value?.data) {
        setPatients(extractList<Patients>(patRes.value.data));
      }

      // If user is a patient, load their profile to match ownership
      if (isPatient()) {
        try {
          const myProfileRes = await patientApi.getMyProfile().catch(() => null);
          if (myProfileRes?.data) {
            setMyPatientProfile(myProfileRes.data);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error('Failed to load doctor profile data:', err);
    } finally {
      setLoading(false);
    }
  }, [id, isPatient]);

  useEffect(() => {
    loadDoctorData();
  }, [loadDoctorData]);

  if (loading) return <AppLayout><Spinner center /></AppLayout>;
  if (!doctor) return <AppLayout><p className="text-muted">Doctor not found.</p></AppLayout>;

  const rawDoc = doctor as unknown as Record<string, unknown>;
  const firstName = String(doctor.firstName || rawDoc.first_name || 'Doctor');
  const middleName = String(doctor.middleName || rawDoc.middle_name || '');
  const lastName = String(doctor.lastName || rawDoc.last_name || '');
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const initials = `${firstName[0] ?? 'D'}${lastName[0] ?? ''}`.toUpperCase();

  const deptId = Number(doctor.departmentId || rawDoc.department_id || 0);
  const specId = Number(doctor.specialtyId || rawDoc.specialty_id || 0);
  const hospId = Number(doctor.hospitalId || rawDoc.hospital_id || 0);

  const foundSpec = specialties.find(s => Number(s.specialtyId || (s as any).specialty_id) === specId);
  const foundDept = departments.find(d => Number(d.departmentId || (d as any).department_id) === deptId);
  const foundHosp = hospitals.find(h => Number(h.hospitalId || (h as any).hospital_id) === hospId);

  const specName = String(doctor.specialtyName || rawDoc.specialty_name || (foundSpec ? (foundSpec.specialtyName || (foundSpec as any).specialty_name) : 'General Practice'));
  const deptName = String(doctor.departmentName || rawDoc.department_name || (foundDept ? (foundDept.departmentName || (foundDept as any).department_name) : 'Medical Department'));
  const hospName = String(foundHosp?.hospitalName || (foundHosp as any)?.hospital_name || '');
  const hospAddr = String(foundHosp?.address || (foundHosp as any)?.address || '');
  const hospPhone = String(foundHosp?.phoneNumber || (foundHosp as any)?.phone_number || '');
  const hospEmail = String(foundHosp?.email || (foundHosp as any)?.email || '');
  const licenseNumber = String(doctor.licenseNumber || rawDoc.license_number || 'N/A');
  const fee = Number(doctor.consultationFee ?? rawDoc.consultation_fee ?? 0);

  // Review calculations
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => {
        const raw = r as unknown as Record<string, unknown>;
        const parsed = Number(r.rating ?? raw.rating ?? 5);
        return acc + (parsed >= 1 && parsed <= 5 ? parsed : 5);
      }, 0) / totalReviews)
    : 5.0;

  const myPatientId = Number(myPatientProfile?.patientId || (myPatientProfile as any)?.patient_id || 0);
  const myReview = isPatient() && myPatientId > 0
    ? reviews.find(r => {
        const raw = r as unknown as Record<string, unknown>;
        return Number(r.patientId || raw.patient_id || 0) === myPatientId;
      })
    : null;

  const handleOpenCreateReview = () => {
    setEditingReview(null);
    setReviewRating(5);
    setReviewComment('');
    setReviewError('');
    setReviewSuccess('');
    setReviewModalOpen(true);
  };

  const handleOpenEditReview = (r: Review) => {
    const raw = r as unknown as Record<string, unknown>;
    const parsedRating = Number(r.rating ?? raw.rating ?? 5);
    setEditingReview(r);
    setReviewRating(parsedRating >= 1 && parsedRating <= 5 ? parsedRating : 5);
    setReviewComment(String(r.comment || raw.comment || ''));
    setReviewError('');
    setReviewSuccess('');
    setReviewModalOpen(true);
  };

  const handleSaveReview = async () => {
    if (!myPatientProfile && !isAdmin()) {
      setReviewError('You must have a patient profile to leave a review.');
      return;
    }

    setSavingReview(true);
    setReviewError('');
    setReviewSuccess('');

    try {
      const docId = Number(id);
      const patientId = myPatientId > 0 ? myPatientId : Number(user?.userId || (user as any)?.user_id || 1);

      if (editingReview) {
        const rRaw = editingReview as unknown as Record<string, unknown>;
        const reviewId = Number(editingReview.reviewId || rRaw.review_id || 0);
        await reviewApi.update(reviewId, {
          reviewId,
          review_id: reviewId,
          doctorId: docId,
          doctor_id: docId,
          patientId,
          patient_id: patientId,
          rating: reviewRating,
          comment: reviewComment.trim(),
        });
        setReviewSuccess('Review updated successfully!');
      } else {
        await reviewApi.create({
          doctorId: docId,
          doctor_id: docId,
          patientId,
          patient_id: patientId,
          rating: reviewRating,
          comment: reviewComment.trim(),
        });
        setReviewSuccess('Review submitted successfully!');
      }

      await loadDoctorData();
      setTimeout(() => {
        setReviewModalOpen(false);
      }, 800);
    } catch (err: any) {
      console.error('Save review error:', err);
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Failed to save review.';
      setReviewError(msg);
    } finally {
      setSavingReview(false);
    }
  };

  const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  // ── Photo management ──────────────────────────────────────────────────────

  const myDoctorProfile = isDoctor()
    ? (doctor && (doctor.userId || (rawDoc as any)?.user_id)
        ? doctor
        : null)
    : null;

  // Can the current user manage this doctor's photo?
  const canManagePhoto = isAdmin() || (
    isDoctor() &&
    doctor !== null &&
    (() => {
      const dUserId = Number((doctor as any).userId || (rawDoc as any).user_id || 0);
      const meId    = Number((user as any)?.userId || (user as any)?.user_id || 0);
      return dUserId > 0 && dUserId === meId;
    })()
  );

  /** File-input change: open crop modal instead of uploading immediately */
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input value so the same file can be re-selected after cancel
    if (photoInputRef.current) photoInputRef.current.value = '';
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  /** Called by PhotoCropModal with the final cropped blob */
  const handleCropSave = async (blob: Blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      await doctorApi.uploadProfilePicture(Number(id), croppedFile);
      await loadDoctorData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to upload photo.';
      setPhotoError(msg);
    } finally {
      setPhotoUploading(false);
    }
  };

  /** Called when the user cancels the crop modal */
  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleDeletePhoto = async () => {
    if (!confirm('Remove this profile picture?')) return;
    setPhotoUploading(true);
    setPhotoError('');
    try {
      await doctorApi.deleteProfilePicture(Number(id));
      await loadDoctorData();
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to remove photo.';
      setPhotoError(msg);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleDeleteReview = async (reviewId: number) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await reviewApi.delete(reviewId);
      loadDoctorData();
    } catch {
      alert('Could not delete review.');
    }
  };

  const getPatientName = (patientId: number) => {
    const p = patients.find(pat => {
      const raw = pat as unknown as Record<string, unknown>;
      return Number(pat.patientId || raw.patient_id || 0) === patientId;
    });
    if (!p) return 'Verified Patient';
    const rawP = p as unknown as Record<string, unknown>;
    const fName = String(p.firstName || rawP.first_name || '');
    const lName = String(p.lastName || rawP.last_name || '');
    return fName ? `${fName} ${lName.charAt(0)}.` : 'Verified Patient';
  };

  return (
    <AppLayout>
      {/* ─── Mobile View matching Screen 3 ─── */}
      <div className="mobile-only-section">
        {doctor && (
          <MobileDoctorDetail
            doctor={doctor}
            schedules={schedules}
            avgRating={avgRating}
            totalReviews={totalReviews}
          />
        )}
      </div>

      {/* ─── Desktop View ─── */}
      <div className="desktop-only-section space-y-6">
        <Link href="/doctors" className="back-link" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, color:'var(--muted)' }}>
          <ChevronLeft size={16} /> Back to Doctor Directory
        </Link>

        {/* Hero Card */}
        <Card className="card-p">
          <div style={{ display:'flex', alignItems:'flex-start', gap:24, flexWrap:'wrap' }}>
            {/* Doctor Portrait with clinical gradient ring and zoom/upload */}
            <div
              style={{
                position: 'relative',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
            >
              <div
                style={{
                  position: 'relative',
                  borderRadius: '18px',
                  padding: 3,
                  background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 50%, rgba(59, 130, 246, 0.3) 100%)',
                  boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08)',
                  cursor: !canManagePhoto ? 'pointer' : 'default',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                title={!canManagePhoto ? 'Click to view full photo' : undefined}
              >
                <Avatar
                  initials={initials}
                  src={String(doctor.profilePicturePath || rawDoc.profile_picture_path || '')}
                  shape="portrait"
                  size="portrait-lg"
                  zoomable={!canManagePhoto}
                  title={`Dr. ${fullName}`}
                  subtitle={specName}
                  style={{
                    width: 120,
                    height: 155,
                    fontSize: 38,
                    fontWeight: 700,
                    border: '3px solid var(--card-bg, #ffffff)',
                    borderRadius: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />

                {!canManagePhoto && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 4,
                      right: 4,
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
                )}

                {/* Upload overlay — only for doctor-owner or admin */}
                {canManagePhoto && (
                  <>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: 'none' }}
                      onChange={handleFileSelected}
                    />
                    {/* Camera action badge button - always visible for doctor/admin */}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={photoUploading}
                      title="Change profile photo (Crop & Adjust)"
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--primary, #2563eb)',
                        color: '#fff',
                        border: '2px solid var(--card-bg, #1e293b)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                        transition: 'transform 0.15s ease',
                        zIndex: 3,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                      onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    >
                      {photoUploading
                        ? <Spinner size="sm" />
                        : <Camera size={15} />}
                    </button>

                    {/* Remove photo button — shown when there IS a photo */}
                    {(doctor.profilePicturePath || rawDoc.profile_picture_path) && (
                      <button
                        type="button"
                        onClick={handleDeletePhoto}
                        disabled={photoUploading}
                        title="Remove profile photo"
                        style={{
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--danger, #ef4444)',
                          border: '2px solid var(--card-bg, #1e293b)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#fff',
                          zIndex: 3,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </>
                )}
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
                Doctor Profile
              </span>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
                <div>
                  <h2 style={{ fontSize:22, fontWeight:700, color:'var(--foreground)', letterSpacing:'-0.5px' }}>
                    Dr. {fullName}
                  </h2>
                  <p className="text-sm text-muted" style={{ marginTop:4, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span>{specName} · {deptName}</span>
                    {hospName && (
                      <>
                        <span>·</span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:'var(--primary)', fontWeight:500 }}>
                          <Building2 size={13} /> {hospName}
                        </span>
                      </>
                    )}
                  </p>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={13}
                          style={{
                            color: '#f59e0b',
                            fill: i < Math.round(avgRating) ? '#f59e0b' : 'transparent',
                          }}
                        />
                      ))}
                      <span className="text-sm font-semibold" style={{ marginLeft:4 }}>
                        {avgRating.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted">
                        ({totalReviews} {totalReviews === 1 ? 'review' : 'reviews'})
                      </span>
                    </div>
                    <Badge variant="success">Available Today</Badge>
                  </div>
                </div>
                {/* Photo upload error toast */}
                {photoError && (
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={13} /> {photoError}
                    <button onClick={() => setPhotoError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>×</button>
                  </div>
                )}
                {!isDoctor() && (
                  <Link href="/appointments/book">
                    <Button icon={Calendar}>Book Appointment</Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Tabs */}
        <div className="tabs">
          {['about','schedule','reviews'].map((t) => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'reviews' && `(${totalReviews})`}
            </button>
          ))}
        </div>

        {tab === 'about' && (
          <div className="space-y-5">
            <Card className="card-p">
              <h3 className="section-title" style={{ marginBottom: 10 }}>About</h3>
              <p className="text-sm text-muted" style={{ lineHeight: 1.7 }}>
                Dr. {fullName} is a board-certified physician specializing in {specName} within the {deptName}. Dedicated to providing comprehensive, evidence-based medical care.
              </p>
            </Card>

            {hospName && (
              <Card className="card-p">
                <h3 className="section-title" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Building2 size={18} style={{ color: 'var(--primary)' }} />
                  Affiliated Hospital & Facility
                </h3>
                <div className="space-y-2 text-sm text-muted">
                  <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>{hospName}</p>
                  {hospAddr && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <MapPin size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      {hospAddr}
                    </p>
                  )}
                  {hospPhone && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      {hospPhone}
                    </p>
                  )}
                  {hospEmail && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      {hospEmail}
                    </p>
                  )}
                </div>
              </Card>
            )}

            <Card className="card-p">
              <h3 className="section-title" style={{ marginBottom: 10 }}>Professional & Practice Info</h3>
              <p className="text-sm text-muted">License: {licenseNumber}</p>
              <p className="text-sm text-muted" style={{ marginTop: 4 }}>Consultation Fee: ₱{fee.toFixed(2)}</p>
            </Card>
          </div>
        )}

        {tab === 'schedule' && (
          <Card className="card-p">
            <h3 className="section-title" style={{ marginBottom: 16 }}>Weekly Working Schedules</h3>
            {schedules.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <Clock size={24} style={{ color: 'var(--muted)', marginBottom: 8 }} />
                <p className="empty-state-title">No working schedules set</p>
                <p className="empty-state-desc">This doctor has not published their weekly hours yet.</p>
              </div>
            ) : (
              <div className="grid-2" style={{ gap: 14 }}>
                {schedules.map((sch, idx) => {
                  const raw = sch as unknown as Record<string, unknown>;
                  const day = String(sch.dayOfWeek ?? raw.day_of_week ?? 'Day');
                  const start = String(sch.startTime ?? raw.start_time ?? '');
                  const end = String(sch.endTime ?? raw.end_time ?? '');
                  const duration = Number(sch.slotDuration ?? raw.slot_duration ?? 30);
                  const maxApp = Number(sch.maxAppointments ?? raw.max_appointments ?? 0);
                  const active = Boolean(sch.isActive ?? raw.is_active ?? true);

                  return (
                    <div
                      key={`sch-card-${idx}`}
                      style={{
                        padding: 16,
                        borderRadius: 'var(--radius)',
                        border: '1px solid var(--card-border)',
                        background: active ? 'var(--card-bg)' : '#f9fafb',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span className="font-semibold text-base" style={{ color: 'var(--foreground)' }}>
                          {day}
                        </span>
                        {active ? (
                          <Badge variant="success">Active Shift</Badge>
                        ) : (
                          <Badge variant="muted">Inactive</Badge>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <Clock size={15} style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-medium">
                          {start} – {end}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--card-border)' }}>
                        <span>Slot: {duration} mins</span>
                        <span>Max Slots: {maxApp}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {tab === 'reviews' && (
          <div className="space-y-4">
            {/* Reviews Summary Card */}
            <Card className="card-p">
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  <div style={{ textAlign:'center', paddingRight:20, borderRight:'1px solid var(--card-border)' }}>
                    <p style={{ fontSize:36, fontWeight:800, color:'var(--foreground)', lineHeight:1 }}>
                      {avgRating.toFixed(1)}
                    </p>
                    <div style={{ display:'flex', justifyContent:'center', gap:3, marginTop:6 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          style={{
                            color: '#f59e0b',
                            fill: i < Math.round(avgRating) ? '#f59e0b' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted" style={{ marginTop:4 }}>
                      {totalReviews} {totalReviews === 1 ? 'rating' : 'ratings'}
                    </p>
                  </div>

                  <div>
                    <h3 className="section-title">Patient Feedback</h3>
                    <p className="text-sm text-muted">
                      {isDoctor()
                        ? 'Here is what patients are saying about their consultations.'
                        : 'Real ratings and comments from verified patient visits.'}
                    </p>
                  </div>
                </div>

                {/* Patient / Admin action button */}
                {isPatient() && (
                  <div>
                    {myReview ? (
                      <Button variant="secondary" icon={Edit} onClick={() => handleOpenEditReview(myReview)}>
                        Edit My Review
                      </Button>
                    ) : (
                      <Button icon={Plus} onClick={handleOpenCreateReview}>
                        Write a Review
                      </Button>
                    )}
                  </div>
                )}
                {isAdmin() && (
                  <div>
                    <Button icon={Plus} onClick={handleOpenCreateReview}>
                      Add Review
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Reviews List */}
            {reviews.length === 0 ? (
              <Card className="card-p">
                <div className="empty-state" style={{ padding: '36px 0' }}>
                  <Star size={32} style={{ color: 'var(--muted)', marginBottom: 10 }} />
                  <p className="empty-state-title">No reviews yet</p>
                  <p className="empty-state-desc">
                    {isPatient()
                      ? 'Be the first patient to share your experience with Dr. ' + fullName + '.'
                      : 'No patient reviews have been posted for this doctor yet.'}
                  </p>
                  {isPatient() && (
                    <div style={{ marginTop: 16 }}>
                      <Button icon={Plus} onClick={handleOpenCreateReview}>
                        Write First Review
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {reviews.map((r, idx) => {
                  const raw = r as unknown as Record<string, unknown>;
                  const revId = Number(r.reviewId || raw.review_id || 0);
                  const pId = Number(r.patientId || raw.patient_id || 0);
                  const parsedRating = Number(r.rating ?? raw.rating ?? 5);
                  const rRating = parsedRating >= 1 && parsedRating <= 5 ? parsedRating : 5;
                  const rComment = String(r.comment || raw.comment || '');
                  const rDate = String(r.createdAt || raw.created_at || 'Recently');
                  const pName = getPatientName(pId);
                  const isMyReview = isPatient() && myPatientId > 0 && pId === myPatientId;
                  const canManage = isMyReview || isAdmin();

                  return (
                    <Card key={`rev-${revId}-${idx}`} className="card-p">
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <Avatar initials={pName.slice(0, 2).toUpperCase()} size="sm" />
                          <div>
                            <span className="font-medium text-sm" style={{ color:'var(--foreground)' }}>
                              {pName}
                            </span>
                            {isMyReview && (
                              <span style={{ marginLeft:8 }}>
                                <Badge variant="info">You</Badge>
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={13}
                                style={{
                                  color: '#f59e0b',
                                  fill: i < rRating ? '#f59e0b' : 'transparent',
                                }}
                              />
                            ))}
                            <span className="text-xs text-muted" style={{ marginLeft:6 }}>
                              {rDate.includes('T') ? rDate.split('T')[0] : rDate}
                            </span>
                          </div>

                          {canManage && (
                            <div style={{ display:'flex', gap:6 }}>
                              <button
                                title="Edit Review"
                                onClick={() => handleOpenEditReview(r)}
                                style={{ color:'var(--muted)', padding:4, borderRadius:4 }}
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                title="Delete Review"
                                onClick={() => handleDeleteReview(revId)}
                                style={{ color:'var(--danger)', padding:4, borderRadius:4 }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-muted" style={{ lineHeight:1.6, marginTop:6 }}>
                        {rComment}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Review Modal (Add / Edit) */}
        {reviewModalOpen && (
          <Modal
            open={reviewModalOpen}
            onClose={() => setReviewModalOpen(false)}
            title={editingReview ? `Edit Review for Dr. ${fullName}` : `Review Dr. ${fullName}`}
          >
            <div className="space-y-4">
              {reviewError && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:10, borderRadius:8, background:'var(--danger-bg)', color:'var(--danger-text)', fontSize:13 }}>
                  <AlertCircle size={15} />
                  <span>{reviewError}</span>
                </div>
              )}
              {reviewSuccess && (
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:10, borderRadius:8, background:'var(--success-bg)', color:'var(--success-text)', fontSize:13 }}>
                  <CheckCircle2 size={15} />
                  <span>{reviewSuccess}</span>
                </div>
              )}

              {/* Star Rating Picker */}
              <div>
                <label className="form-label" style={{ display:'block', marginBottom:8 }}>
                  Your Rating
                </label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ display:'flex', gap:4 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{ padding:4, transition:'transform 0.15s ease' }}
                      >
                        <Star
                          size={26}
                          style={{
                            color: '#f59e0b',
                            fill: (hoverRating || reviewRating) >= star ? '#f59e0b' : 'transparent',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-semibold" style={{ color:'var(--foreground)', marginLeft:8 }}>
                    {ratingLabels[(hoverRating || reviewRating) - 1] || 'Good'} ({hoverRating || reviewRating}/5)
                  </span>
                </div>
              </div>

              {/* Review Comment Textarea */}
              <div>
                <label className="form-label" style={{ display:'block', marginBottom:6 }}>
                  Your Feedback / Comment
                </label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Share details of your experience, care quality, bedside manner, and advice for other patients..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  style={{ width:'100%', resize:'vertical' }}
                />
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:12 }}>
                <Button variant="secondary" onClick={() => setReviewModalOpen(false)} disabled={savingReview}>
                  Cancel
                </Button>
                <Button onClick={handleSaveReview} disabled={savingReview}>
                  {savingReview ? <Spinner size="sm" /> : (editingReview ? 'Save Changes' : 'Submit Review')}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>

      {/* Photo Crop Modal — shown after file selection, before upload */}
      {cropSrc && (
        <PhotoCropModal
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onClose={handleCropCancel}
        />
      )}
    </AppLayout>
  );
}

