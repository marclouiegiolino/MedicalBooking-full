'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  User, Edit, Save, Phone, MapPin, Calendar, Shield,
  CreditCard, Plus, Trash2, CheckCircle2, Star, AlertCircle,
  PhoneCall, Camera, Upload, RefreshCw, KeyRound, Check, X
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import dynamic from 'next/dynamic';

const PhotoCropModal = dynamic(() => import('@/components/ui/PhotoCropModal'), {
  ssr: false,
  loading: () => null,
});
import { patientApi, insuranceApi, emergencyContactApi, userApi, medicalInfoApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import NearbyHospitalDetector from '@/components/ui/NearbyHospitalDetector';
import PhilippineAddressSelector from '@/components/ui/PhilippineAddressSelector';
import type { Patient, Insurance, EmergencyContact, UserResponse, MedicalInformation } from '@/lib/types';
import { ROLES } from '@/lib/types';

const ROLE_NAMES: Record<number, string> = {
  [ROLES.ADMIN]: 'System Administrator',
  [ROLES.STAFF]: 'Medical Staff / Doctor',
  [ROLES.USER]: 'Patient Account',
};

export default function ProfilePage() {
  const { user, updateUser, refreshUser, isPatient } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [userProfile, setUserProfile] = useState<UserResponse | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInsurance, setLoadingInsurance] = useState(false);
  const [loadingEmergency, setLoadingEmergency] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Patient>>({});
  const [tab, setTab] = useState<'info' | 'account' | 'insurance' | 'emergency' | 'medical'>('account');

  // Medical History states
  const [medicalInfo, setMedicalInfo] = useState<MedicalInformation | null>(null);
  const [loadingMedical, setLoadingMedical] = useState(false);
  const [savingMedical, setSavingMedical] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    allergies: '',
    medicalHistory: '',
    medications: '',
  });

  // Photo upload states
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  // Security / Password Modal state
  const [passwordModal, setPasswordModal] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    username: user?.username || '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Insurance Modal state
  const [insuranceModal, setInsuranceModal] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | null>(null);
  const [savingInsurance, setSavingInsurance] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    providerName: '',
    policyNumber: '',
    coverageType: 'Comprehensive Health',
    validUntil: '',
    isPrimary: false,
  });

  // Emergency Contact Modal state
  const [emergencyModal, setEmergencyModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState({
    firstName: '',
    lastName: '',
    relationship: 'Parent',
    phone: '',
  });

  // Set initial tab based on role
  useEffect(() => {
    if (user?.roleId === ROLES.USER) {
      setTab('info');
    } else {
      setTab('account');
    }
  }, [user?.roleId]);

  const loadUserProfile = useCallback(async () => {
    try {
      const r = await userApi.getProfile();
      if (r.data) {
        setUserProfile(r.data);
        const pic = r.data.profilePicturePath || (r.data as Record<string, unknown>).profile_picture_path as string;
        if (pic) {
          updateUser({ profilePicturePath: pic });
        }
      }
    } catch {
      // ignore
    }
  }, [updateUser]);

  const loadProfile = useCallback(async () => {
    try {
      const r = await patientApi.getMyProfile();
      setPatient(r.data);
      setForm(r.data);
    } catch {
      setPatient(null);
    }
  }, []);

  const loadInsurances = useCallback(async () => {
    setLoadingInsurance(true);
    try {
      const res = await insuranceApi.getMine();
      const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      setInsurances(items);
    } catch {
      setInsurances([]);
    } finally {
      setLoadingInsurance(false);
    }
  }, []);

  const loadEmergencyContacts = useCallback(async () => {
    setLoadingEmergency(true);
    try {
      const res = await emergencyContactApi.getMine();
      const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      setEmergencyContacts(items);
    } catch {
      setEmergencyContacts([]);
    } finally {
      setLoadingEmergency(false);
    }
  }, []);

  const loadMedicalInfo = useCallback(async () => {
    setLoadingMedical(true);
    try {
      const res = await medicalInfoApi.getMine();
      const data = res.data as MedicalInformation;
      setMedicalInfo(data);
      const raw = data as unknown as Record<string, string>;
      setMedicalForm({
        allergies: String(data?.allergies ?? raw?.allergies ?? ''),
        medicalHistory: String(data?.medicalHistory ?? raw?.medical_history ?? ''),
        medications: String(data?.medications ?? raw?.medications ?? ''),
      });
    } catch {
      setMedicalInfo(null);
      setMedicalForm({ allergies: '', medicalHistory: '', medications: '' });
    } finally {
      setLoadingMedical(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<unknown>[] = [loadUserProfile()];

    // Only load patient-specific records for patient role
    if (user?.roleId === ROLES.USER) {
      tasks.push(loadProfile(), loadInsurances(), loadEmergencyContacts(), loadMedicalInfo());
    }

    Promise.all(tasks).finally(() => setLoading(false));
  }, [user?.roleId, loadUserProfile, loadProfile, loadInsurances, loadEmergencyContacts, loadMedicalInfo]);

  // ── Profile Photo Upload Handler ──────────────────────────────────────────

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10 MB limit before cropping)
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setPhotoMessage({ type: 'error', text: 'Image file must be less than 10 MB.' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  const handleCropSave = async (blob: Blob) => {
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
    setUploadingPhoto(true);
    setPhotoMessage(null);

    try {
      const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      const res = await userApi.uploadProfilePicture(croppedFile);
      const updatedUser = res.data;
      const raw = updatedUser as unknown as Record<string, unknown>;
      const newPath = String(updatedUser.profilePicturePath || raw.profile_picture_path || '');

      updateUser({ profilePicturePath: newPath });
      setUserProfile((prev) => prev ? { ...prev, profilePicturePath: newPath } : prev);
      await refreshUser();

      setPhotoMessage({ type: 'success', text: 'Profile picture adjusted and updated successfully!' });
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to upload profile picture. Please try again.';
      setPhotoMessage({ type: 'error', text: errorMsg });
    } finally {
      setUploadingPhoto(false);
      setTimeout(() => setPhotoMessage(null), 5000);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
    }
    setCropSrc(null);
  };

  const handleRemovePhoto = async () => {
    if (!confirm('Are you sure you want to remove your profile picture?')) return;
    setUploadingPhoto(true);
    try {
      await userApi.updateProfile({
        userName: user?.username || '',
        profilePicturePath: '',
      });
      updateUser({ profilePicturePath: '' });
      setUserProfile((prev) => prev ? { ...prev, profilePicturePath: '' } : prev);
      await refreshUser();
      setPhotoMessage({ type: 'success', text: 'Profile picture removed.' });
    } catch {
      setPhotoMessage({ type: 'error', text: 'Failed to remove profile picture.' });
    } finally {
      setUploadingPhoto(false);
      setTimeout(() => setPhotoMessage(null), 4000);
    }
  };

  // ── Patient Profile Save ──────────────────────────────────────────────────

  const handleSave = async () => {
    if (!patient) return;
    setSaving(true);
    try {
      await patientApi.update(patient.patientId, form);
      setPatient({ ...patient, ...form });
      setEditing(false);
    } catch {
      alert('Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // ── Medical History Save ──────────────────────────────────────────────────

  const handleSaveMedical = async () => {
    setSavingMedical(true);
    try {
      if (medicalInfo && (medicalInfo.medicalInfoId || (medicalInfo as unknown as Record<string, number>).medical_info_id)) {
        const mId = Number(medicalInfo.medicalInfoId || (medicalInfo as unknown as Record<string, number>).medical_info_id);
        await medicalInfoApi.update(mId, medicalForm);
      } else {
        await medicalInfoApi.create(medicalForm);
      }
      await loadMedicalInfo();
    } catch {
      alert('Failed to save medical information.');
    } finally {
      setSavingMedical(false);
    }
  };

  // ── Password / Account Update ────────────────────────────────────────────

  const handleOpenPasswordModal = () => {
    setPasswordForm({
      username: user?.username || '',
      newPassword: '',
      confirmPassword: '',
    });
    setPasswordError('');
    setPasswordSuccess('');
    setPasswordModal(true);
  };

  const handleSavePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (passwordForm.newPassword && passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }

    if (passwordForm.newPassword && passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (!passwordForm.username.trim()) {
      setPasswordError('Username is required.');
      return;
    }

    setSavingPassword(true);
    try {
      const payload: Record<string, unknown> = {
        userName: passwordForm.username.trim(),
      };
      if (passwordForm.newPassword) {
        payload.newPassword = passwordForm.newPassword;
      }

      await userApi.updateProfile(payload);
      if (passwordForm.username !== user?.username) {
        updateUser({ username: passwordForm.username.trim() });
      }
      setPasswordSuccess('Account credentials updated successfully!');
      setTimeout(() => {
        setPasswordModal(false);
      }, 1500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to update credentials.';
      setPasswordError(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Insurance Handlers ───────────────────────────────────────────────────

  const handleOpenAddInsurance = () => {
    setEditingInsurance(null);
    setInsuranceForm({
      providerName: '',
      policyNumber: '',
      coverageType: 'Comprehensive Health',
      validUntil: '',
      isPrimary: insurances.length === 0,
    });
    setInsuranceModal(true);
  };

  const handleOpenEditInsurance = (ins: Insurance) => {
    const raw = ins as unknown as Record<string, unknown>;
    setEditingInsurance(ins);
    setInsuranceForm({
      providerName: String(ins.providerName ?? raw.provider_name ?? ''),
      policyNumber: String(ins.policyNumber ?? raw.policy_number ?? ''),
      coverageType: String(ins.coverageType ?? raw.coverage_type ?? 'Comprehensive Health'),
      validUntil: String(ins.validUntil ?? raw.valid_until ?? ''),
      isPrimary: Boolean(ins.isPrimary ?? raw.is_primary ?? false),
    });
    setInsuranceModal(true);
  };

  const handleSaveInsurance = async () => {
    if (!insuranceForm.providerName.trim() || !insuranceForm.policyNumber.trim()) {
      alert('Provider name and policy number are required.');
      return;
    }

    setSavingInsurance(true);
    try {
      if (editingInsurance) {
        const raw = editingInsurance as unknown as Record<string, unknown>;
        const insId = Number(editingInsurance.insuranceId ?? raw.insurance_id);
        await insuranceApi.update(insId, {
          insuranceId: insId,
          insurance_id: insId,
          patientId: patient?.patientId,
          ...insuranceForm,
        });
      } else {
        await insuranceApi.create({
          ...insuranceForm,
          patientId: patient?.patientId,
        });
      }
      setInsuranceModal(false);
      await loadInsurances();
    } catch (err) {
      console.error('Failed to save insurance:', err);
      alert('Failed to save insurance policy.');
    } finally {
      setSavingInsurance(false);
    }
  };

  const handleSetPrimary = async (targetIns: Insurance) => {
    const raw = targetIns as unknown as Record<string, unknown>;
    const insId = Number(targetIns.insuranceId ?? raw.insurance_id);
    try {
      await insuranceApi.update(insId, {
        ...targetIns,
        insuranceId: insId,
        insurance_id: insId,
        isPrimary: true,
        is_primary: true,
        patientId: patient?.patientId,
      });
      await loadInsurances();
    } catch (err) {
      console.error('Failed to set primary insurance:', err);
      alert('Failed to update primary insurance.');
    }
  };

  const handleDeleteInsurance = async (targetIns: Insurance) => {
    const raw = targetIns as unknown as Record<string, unknown>;
    const insId = Number(targetIns.insuranceId ?? raw.insurance_id);
    const provider = String(targetIns.providerName ?? raw.provider_name ?? 'this policy');

    if (!confirm(`Delete insurance policy with ${provider}?`)) return;

    try {
      await insuranceApi.delete(insId);
      await loadInsurances();
    } catch (err) {
      console.error('Failed to delete insurance:', err);
      alert('Failed to delete insurance policy.');
    }
  };

  // ── Emergency Contact Handlers ───────────────────────────────────────────

  const handleOpenAddContact = () => {
    setEditingContact(null);
    setContactForm({
      firstName: '',
      lastName: '',
      relationship: 'Parent',
      phone: '',
    });
    setEmergencyModal(true);
  };

  const handleOpenEditContact = (contact: EmergencyContact) => {
    const raw = contact as unknown as Record<string, unknown>;
    setEditingContact(contact);
    setContactForm({
      firstName: String(contact.firstName ?? raw.first_name ?? ''),
      lastName: String(contact.lastName ?? raw.last_name ?? ''),
      relationship: String(contact.relationship ?? raw.relationship ?? 'Parent'),
      phone: String(contact.phone ?? raw.phone ?? ''),
    });
    setEmergencyModal(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.firstName.trim() || !contactForm.lastName.trim() || !contactForm.phone.trim()) {
      alert('First name, last name, and phone number are required.');
      return;
    }

    setSavingContact(true);
    try {
      if (editingContact) {
        const raw = editingContact as unknown as Record<string, unknown>;
        const cId = Number(editingContact.contactId ?? raw.contact_id ?? editingContact.emergencyContactId);
        await emergencyContactApi.update(cId, {
          contactId: cId,
          contact_id: cId,
          patientId: patient?.patientId,
          ...contactForm,
        });
      } else {
        await emergencyContactApi.create({
          ...contactForm,
          patientId: patient?.patientId,
        });
      }
      setEmergencyModal(false);
      await loadEmergencyContacts();
    } catch (err) {
      console.error('Failed to save emergency contact:', err);
      alert('Failed to save emergency contact.');
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (contact: EmergencyContact) => {
    const raw = contact as unknown as Record<string, unknown>;
    const cId = Number(contact.contactId ?? raw.contact_id ?? contact.emergencyContactId);
    const fname = String(contact.firstName ?? raw.first_name ?? '');
    const lname = String(contact.lastName ?? raw.last_name ?? '');
    const name = `${fname} ${lname}`.trim() || 'this contact';

    if (!confirm(`Delete ${name} from emergency contacts?`)) return;

    try {
      await emergencyContactApi.delete(cId);
      await loadEmergencyContacts();
    } catch (err) {
      console.error('Failed to delete emergency contact:', err);
      alert('Failed to delete emergency contact.');
    }
  };

  const rawPatient = (patient ?? {}) as unknown as Record<string, unknown>;
  const patientFname = String(patient?.firstName ?? rawPatient.first_name ?? '').trim();
  const patientMname = String(patient?.middleName ?? rawPatient.middle_name ?? '').trim();
  const patientLname = String(patient?.lastName ?? rawPatient.last_name ?? '').trim();
  const patientFullName = [patientFname, patientMname, patientLname].filter(Boolean).join(' ');

  const initials = patientFname
    ? `${patientFname[0]}${patientLname[0] ?? ''}`.toUpperCase()
    : (user?.username?.slice(0, 2).toUpperCase() ?? 'U');

  const currentPicturePath = user?.profilePicturePath || userProfile?.profilePicturePath;

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handlePhotoSelect}
        />

        {/* Page Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="page-subtitle">View and update your personal details, profile picture, and credentials</p>
          </div>

          {tab === 'info' && patient && (
            !editing ? (
              <Button variant="secondary" icon={Edit} onClick={() => setEditing(true)}>Edit Details</Button>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="ghost" onClick={() => { setEditing(false); setForm(patient ?? {}); }}>Cancel</Button>
                <Button icon={Save} loading={saving} onClick={handleSave}>Save Changes</Button>
              </div>
            )
          )}
          {tab === 'medical' && (
            <Button icon={Save} loading={savingMedical} onClick={handleSaveMedical}>Save Medical Info</Button>
          )}
          {tab === 'insurance' && (
            <Button icon={Plus} onClick={handleOpenAddInsurance}>Add Insurance Policy</Button>
          )}
          {tab === 'emergency' && (
            <Button icon={Plus} onClick={handleOpenAddContact}>Add Emergency Contact</Button>
          )}
        </div>

        {/* Photo Status Alert */}
        {photoMessage && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: photoMessage.type === 'success' ? '#d1fae5' : '#fee2e2',
              color: photoMessage.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${photoMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {photoMessage.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{photoMessage.text}</span>
            </div>
            <button
              onClick={() => setPhotoMessage(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="tabs-nav" style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--card-border)', paddingBottom: 8, flexWrap: 'wrap' }}>
          {user?.roleId === ROLES.USER ? (
            <>
              <Button
                variant={tab === 'info' ? 'primary' : 'ghost'}
                size="sm"
                icon={User}
                onClick={() => setTab('info')}
              >
                Personal Information
              </Button>
              <Button
                variant={tab === 'account' ? 'primary' : 'ghost'}
                size="sm"
                icon={Shield}
                onClick={() => setTab('account')}
              >
                Account & Security
              </Button>
              <Button
                variant={tab === 'medical' ? 'primary' : 'ghost'}
                size="sm"
                icon={AlertCircle}
                onClick={() => setTab('medical')}
              >
                Medical History
              </Button>
              <Button
                variant={tab === 'insurance' ? 'primary' : 'ghost'}
                size="sm"
                icon={CreditCard}
                onClick={() => setTab('insurance')}
              >
                Insurance & Coverage ({insurances.length})
              </Button>
              <Button
                variant={tab === 'emergency' ? 'primary' : 'ghost'}
                size="sm"
                icon={PhoneCall}
                onClick={() => setTab('emergency')}
              >
                Emergency Contacts ({emergencyContacts.length})
              </Button>
            </>
          ) : (
            <Button
              variant={tab === 'account' ? 'primary' : 'ghost'}
              size="sm"
              icon={Shield}
              onClick={() => setTab('account')}
            >
              Account & Security
            </Button>
          )}
        </div>

        {loading ? (
          <Spinner center />
        ) : tab === 'info' && user?.roleId === ROLES.USER ? (
          <div className="grid-main">
            {/* Left: Profile card and information */}
            <div className="space-y-5">
              {/* Profile Card with Avatar & Upload */}
              <Card className="card-p">
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
                  {/* Large Avatar with Clinical Gradient Ring & Camera Overlay */}
                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: '16px',
                        padding: 3,
                        background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 50%, rgba(59, 130, 246, 0.3) 100%)',
                        boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <Avatar
                        initials={initials}
                        src={currentPicturePath}
                        shape="portrait"
                        size="portrait-md"
                        zoomable={true}
                        title={patientFullName || `@${user?.username}`}
                        subtitle={ROLE_NAMES[user?.roleId ?? 3]}
                        style={{
                          width: 105,
                          height: 140,
                          fontSize: 34,
                          fontWeight: 700,
                          border: '3px solid var(--card-bg, #ffffff)',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      />

                      {/* Camera Button */}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        title="Upload profile picture"
                        style={{
                          position: 'absolute',
                          bottom: 4,
                          right: 4,
                          width: 32,
                          height: 32,
                          borderRadius: '10px',
                          background: 'var(--primary)',
                          color: '#fff',
                          border: '2px solid var(--card-bg, #fff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                          transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        {uploadingPhoto ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Profile Info & Actions */}
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)' }}>
                        {patientFullName || user?.username}
                      </h2>
                      <Badge variant="info">
                        <Shield size={11} style={{ marginRight: 4 }} />
                        {ROLE_NAMES[user?.roleId ?? 3] ?? 'User'}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted" style={{ marginTop: 4 }}>
                      @{user?.username} · User ID: #{user?.userId}
                    </p>

                    {/* Change / Remove Photo Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={Upload}
                        loading={uploadingPhoto}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Photo
                      </Button>

                      {currentPicturePath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePhoto}
                          disabled={uploadingPhoto}
                          style={{ color: 'var(--danger-text, #ef4444)' }}
                        >
                          Remove Photo
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Patient Information Form or Details */}
                {patient ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                      {[
                        { label: 'First Name', key: 'firstName', placeholder: 'John' },
                        { label: 'Middle Name', key: 'middleName', placeholder: 'Middle (optional)' },
                        { label: 'Last Name', key: 'lastName', placeholder: 'Doe' },
                        { label: 'Date of Birth', key: 'dateOfBirth', placeholder: 'YYYY-MM-DD', type: 'date' },
                        { label: 'Gender', key: 'gender', placeholder: 'Male / Female / Other' },
                        { label: 'Phone', key: 'phone', placeholder: '+1 (555) 000-0000' },
                        { label: 'Blood Type', key: 'bloodType', placeholder: 'A+, B-, O+…' },
                      ].map((f) => (
                        <div key={f.key} className="form-group">
                          <label className="form-label">{f.label}</label>
                          {editing ? (
                            <input
                              type={f.type ?? 'text'}
                              className="form-input"
                              placeholder={f.placeholder}
                              value={(form as Record<string, string>)[f.key] ?? ''}
                              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                            />
                          ) : (
                            <p className="text-sm" style={{ color: (patient as unknown as Record<string, unknown>)?.[f.key] ? 'var(--foreground)' : 'var(--muted)', padding: '8px 0' }}>
                              {(patient as unknown as Record<string, unknown>)?.[f.key] as string || '—'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="form-group" style={{ marginTop: 12 }}>
                      {editing ? (
                        <PhilippineAddressSelector
                          value={form.address ?? ''}
                          onChange={(addr) => setForm((p) => ({ ...p, address: addr }))}
                          label="Patient Residential Address"
                        />
                      ) : (
                        <>
                          <label className="form-label">Address</label>
                          <p className="text-sm" style={{ color: patient?.address ? 'var(--foreground)' : 'var(--muted)', padding: '8px 0' }}>
                            {patient?.address || '—'}
                          </p>
                        </>
                      )}

                      {/* Automatically detect nearby hospital from patient's address */}
                      <NearbyHospitalDetector
                        address={editing ? (form.address ?? '') : (patient?.address ?? '')}
                        title="Your Assigned / Nearest Healthcare Facility"
                        showActions={true}
                      />
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '20px 0', color: 'var(--muted)', fontSize: 14 }}>
                    <p>No patient profile attached. Use the Account & Security tab to update your credentials and preferences.</p>
                  </div>
                )}
              </Card>
            </div>

            {/* Right: Account Summary */}
            <div className="space-y-5">
              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 16 }}>Account Summary</p>
                <div className="space-y-3">
                  {[
                    { icon: User, label: 'Username', value: `@${user?.username}` },
                    { icon: Shield, label: 'Access Level', value: ROLE_NAMES[user?.roleId ?? 3] ?? `Role ${user?.roleId}` },
                    { icon: Phone, label: 'Phone', value: patient?.phone ?? '—' },
                    { icon: MapPin, label: 'Address', value: patient?.address ?? '—' },
                    { icon: Calendar, label: 'Date of Birth', value: patient?.dateOfBirth ?? '—' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={14} style={{ color: 'var(--primary)' }} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <p className="text-xs text-muted">{item.label}</p>
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 14 }}>Security & Credentials</p>
                <p className="text-xs text-muted" style={{ marginBottom: 14 }}>Update your username, password, or security credentials.</p>
                <div className="space-y-3">
                  <Button variant="secondary" icon={KeyRound} fullWidth onClick={handleOpenPasswordModal}>
                    Change Password / Username
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        ) : tab === 'medical' && user?.roleId === ROLES.USER ? (
          /* ── Medical History Tab ── */
          <Card className="card-p">
            <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--card-border)' }}>
              <p className="section-title" style={{ marginBottom: 4 }}>Medical History</p>
              <p className="text-xs text-muted">Keep your medical information up to date to help your doctors provide better care.</p>
            </div>

            {loadingMedical ? (
              <Spinner center />
            ) : (
              <div className="space-y-4">
                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <AlertCircle size={14} style={{ color: 'var(--primary)' }} />
                      Allergies
                    </span>
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="List any known allergies (e.g. Penicillin, Peanuts, Latex)…"
                    value={medicalForm.allergies}
                    onChange={(e) => setMedicalForm((p) => ({ ...p, allergies: e.target.value }))}
                  />
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>Separate multiple allergies with commas.</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={14} style={{ color: 'var(--primary)' }} />
                      Medical History
                    </span>
                  </label>
                  <textarea
                    className="form-input"
                    rows={5}
                    placeholder="Describe any past illnesses, surgeries, chronic conditions, hospitalizations, or relevant medical events…"
                    value={medicalForm.medicalHistory}
                    onChange={(e) => setMedicalForm((p) => ({ ...p, medicalHistory: e.target.value }))}
                  />
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>Include chronic conditions, past surgeries, and any significant medical history.</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Star size={14} style={{ color: 'var(--primary)' }} />
                      Current Medications
                    </span>
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="List all current medications, dosages, and frequency (e.g. Metformin 500mg twice daily)…"
                    value={medicalForm.medications}
                    onChange={(e) => setMedicalForm((p) => ({ ...p, medications: e.target.value }))}
                  />
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>Include prescription and over-the-counter medications.</p>
                </div>

                {!medicalInfo && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(59,130,246,0.06)',
                      border: '1px solid rgba(59,130,246,0.2)',
                      fontSize: 13,
                      color: 'var(--muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertCircle size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    No medical information on file yet. Fill in the fields above and click &ldquo;Save Medical Info&rdquo; to create your record.
                  </div>
                )}
              </div>
            )}
          </Card>
        ) : tab === 'insurance' ? (
          /* ── Insurance & Coverage Tab ── */
          <div>
            {loadingInsurance ? (
              <Spinner center />
            ) : insurances.length === 0 ? (
              <Card className="card-p">
                <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      color: 'var(--primary)',
                    }}
                  >
                    <CreditCard size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--foreground)' }}>
                    No Insurance Policies on File
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, margin: '0 auto 20px' }}>
                    Add your health insurance policy to expedite consultation billing, coverage validation, and clinic reception check-ins.
                  </p>
                  <Button icon={Plus} onClick={handleOpenAddInsurance}>
                    Add Your First Policy
                  </Button>
                </div>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {insurances.map((ins, idx) => {
                  const raw = ins as unknown as Record<string, unknown>;
                  const id = Number(ins.insuranceId ?? raw.insurance_id ?? idx);
                  const provider = String(ins.providerName ?? raw.provider_name ?? 'Insurance Provider');
                  const policyNum = String(ins.policyNumber ?? raw.policy_number ?? '—');
                  const coverage = String(ins.coverageType ?? raw.coverage_type ?? 'Comprehensive Health');
                  const isPrim = Boolean(ins.isPrimary ?? raw.is_primary);
                  const validUntil = ins.validUntil ?? raw.valid_until ? String(ins.validUntil ?? raw.valid_until) : null;

                  return (
                    <Card
                      key={`ins-card-${id}-${idx}`}
                      className="card-p"
                      style={{
                        position: 'relative',
                        border: isPrim ? '2px solid var(--primary, #2563eb)' : '1px solid var(--card-border)',
                        boxShadow: isPrim ? '0 4px 14px rgba(37, 99, 235, 0.12)' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: isPrim ? 'var(--primary)' : 'var(--accent)',
                                color: isPrim ? '#ffffff' : 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <CreditCard size={20} />
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
                                {provider}
                              </h3>
                              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                                {coverage}
                              </p>
                            </div>
                          </div>
                          {isPrim && (
                            <Badge variant="success">
                              <Check size={11} style={{ marginRight: 3 }} />
                              Primary
                            </Badge>
                          )}
                        </div>

                        <div
                          style={{
                            background: 'var(--accent)',
                            borderRadius: 'var(--radius)',
                            padding: '12px 14px',
                            marginBottom: 14,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                            <span style={{ color: 'var(--muted)' }}>Policy / Member ID</span>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--foreground)' }}>
                              {policyNum}
                            </span>
                          </div>
                          {validUntil && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span style={{ color: 'var(--muted)' }}>Valid Until</span>
                              <span style={{ fontWeight: 500, color: 'var(--foreground)' }}>
                                {new Date(validUntil).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                        <div>
                          {!isPrim && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Star}
                              onClick={() => handleSetPrimary(ins)}
                              title="Set as your primary health insurance"
                            >
                              Set Primary
                            </Button>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Edit}
                            onClick={() => handleOpenEditInsurance(ins)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteInsurance(ins)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === 'emergency' ? (
          /* ── Emergency Contacts Tab ── */
          <div>
            {loadingEmergency ? (
              <Spinner center />
            ) : emergencyContacts.length === 0 ? (
              <Card className="card-p">
                <div className="empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                      color: 'var(--primary)',
                    }}
                  >
                    <PhoneCall size={28} />
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--foreground)' }}>
                    No Emergency Contacts Registered
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, margin: '0 auto 20px' }}>
                    Register trusted emergency contacts so clinical doctors and hospital reception can reach your designated contact during emergencies.
                  </p>
                  <Button icon={Plus} onClick={handleOpenAddContact}>
                    Add Emergency Contact
                  </Button>
                </div>
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {emergencyContacts.map((c, idx) => {
                  const raw = c as unknown as Record<string, unknown>;
                  const id = Number(c.contactId ?? raw.contact_id ?? c.emergencyContactId ?? idx);
                  const fName = String(c.firstName ?? raw.first_name ?? '');
                  const lName = String(c.lastName ?? raw.last_name ?? '');
                  const fullName = `${fName} ${lName}`.trim() || 'Emergency Contact';
                  const relationship = String(c.relationship ?? raw.relationship ?? 'Contact');
                  const phone = String(c.phone ?? raw.phone ?? '—');

                  return (
                    <Card
                      key={`contact-card-${id}-${idx}`}
                      className="card-p"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: 'var(--accent)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <PhoneCall size={20} />
                            </div>
                            <div>
                              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
                                {fullName}
                              </h3>
                              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                                Verified Emergency Contact
                              </p>
                            </div>
                          </div>
                          <Badge variant="info">{relationship}</Badge>
                        </div>

                        <div
                          style={{
                            background: 'var(--accent)',
                            borderRadius: 'var(--radius)',
                            padding: '12px 14px',
                            marginBottom: 14,
                          }}
                        >
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
                            Contact Phone
                          </div>
                          <a
                            href={`tel:${phone}`}
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: 'var(--primary)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              textDecoration: 'none',
                            }}
                          >
                            <Phone size={14} />
                            {phone}
                          </a>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit}
                          onClick={() => handleOpenEditContact(c)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteContact(c)}
                        >
                          Delete
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Account & Security Tab (Default for Admin & Staff, and available to Patients) */
          <div className="grid-main">
            <div className="space-y-5">
              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 16 }}>User Account Information</p>
                <div className="space-y-4">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 16, borderBottom: '1px solid var(--card-border)', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: '16px',
                          padding: 3,
                          background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 50%, rgba(59, 130, 246, 0.3) 100%)',
                          boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08)',
                        }}
                      >
                        <Avatar
                          initials={initials}
                          src={currentPicturePath}
                          shape="portrait"
                          size="portrait-md"
                          zoomable={true}
                          title={`@${user?.username}`}
                          subtitle={ROLE_NAMES[user?.roleId ?? 3]}
                          style={{
                            width: 105,
                            height: 140,
                            fontSize: 34,
                            fontWeight: 700,
                            border: '3px solid var(--card-bg, #ffffff)',
                            borderRadius: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                          title="Upload profile picture"
                          style={{
                            position: 'absolute',
                            bottom: 4,
                            right: 4,
                            width: 32,
                            height: 32,
                            borderRadius: '10px',
                            background: 'var(--primary)',
                            color: '#fff',
                            border: '2px solid var(--card-bg, #fff)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            transition: 'transform 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                        >
                          {uploadingPhoto ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 200 }}>
                      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>@{user?.username}</h3>
                      <p className="text-xs text-muted">User ID: #{user?.userId}</p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Upload}
                          loading={uploadingPhoto}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Change Photo
                        </Button>
                        {currentPicturePath && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRemovePhoto}
                            disabled={uploadingPhoto}
                            style={{ color: 'var(--danger-text, #ef4444)' }}
                          >
                            Remove Photo
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    <div>
                      <p className="text-xs text-muted">Username</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)', marginTop: 2 }}>{user?.username}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Role</p>
                      <p className="text-sm font-medium" style={{ color: 'var(--foreground)', marginTop: 2 }}>
                        {ROLE_NAMES[user?.roleId ?? 3] ?? `Role #${user?.roleId}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">User GUID</p>
                      <p className="text-xs font-mono text-muted" style={{ marginTop: 2 }}>
                        {userProfile?.guid || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Profile Picture Status</p>
                      <p className="text-sm font-medium" style={{ color: currentPicturePath ? 'var(--success-text)' : 'var(--muted)', marginTop: 2 }}>
                        {currentPicturePath ? 'Custom photo uploaded' : 'Default initials'}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Password & Security Card */}
              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 14 }}>Security Credentials</p>
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Keep your account secure by using a strong password that you do not use anywhere else.
                </p>
                <Button variant="secondary" icon={KeyRound} onClick={handleOpenPasswordModal}>
                  Update Password & Username
                </Button>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="card-p">
                <p className="section-title" style={{ marginBottom: 14 }}>Account Guidelines</p>
                <ul className="text-xs text-muted space-y-2" style={{ paddingLeft: 16, listStyle: 'disc' }}>
                  <li>Profile pictures must be JPG, PNG, WEBP, or GIF and under 5 MB.</li>
                  <li>Usernames must be unique across all accounts.</li>
                  <li>Passwords should contain at least 6 characters.</li>
                  <li>Role permissions are enforced system-wide.</li>
                </ul>
              </Card>
            </div>
          </div>
        )}

        {/* Change Password / Username Modal */}
        <Modal
          open={passwordModal}
          onClose={() => setPasswordModal(false)}
          title="Account Security & Credentials"
        >
          <div className="space-y-4">
            {passwordError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={15} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#d1fae5', color: '#065f46', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={15} />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username *</label>
              <input
                type="text"
                className="form-input"
                value={passwordForm.username}
                onChange={(e) => setPasswordForm((p) => ({ ...p, username: e.target.value }))}
                placeholder="Username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password (leave blank to keep current)</label>
              <input
                type="password"
                className="form-input"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>

            {passwordForm.newPassword && (
              <div className="form-group">
                <label className="form-label">Confirm New Password *</label>
                <input
                  type="password"
                  className="form-input"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
              <Button variant="ghost" onClick={() => setPasswordModal(false)}>Cancel</Button>
              <Button loading={savingPassword} onClick={handleSavePassword}>
                Save Credentials
              </Button>
            </div>
          </div>
        </Modal>

        {/* Add/Edit Insurance Modal */}
        <Modal
          open={insuranceModal}
          onClose={() => setInsuranceModal(false)}
          title={editingInsurance ? 'Edit Insurance Policy' : 'Add Health Insurance Policy'}
        >
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label">Insurance Provider *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Blue Cross, PhilHealth, Kaiser Permanente"
                value={insuranceForm.providerName}
                onChange={(e) => setInsuranceForm((prev) => ({ ...prev, providerName: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Policy / Member Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. POL-9847291-B"
                value={insuranceForm.policyNumber}
                onChange={(e) => setInsuranceForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Coverage Type</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Comprehensive, HMO, Major Medical"
                value={insuranceForm.coverageType}
                onChange={(e) => setInsuranceForm((prev) => ({ ...prev, coverageType: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Valid Until (Expiration Date)</label>
              <input
                type="date"
                className="form-input"
                value={insuranceForm.validUntil}
                onChange={(e) => setInsuranceForm((prev) => ({ ...prev, validUntil: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
              <input
                type="checkbox"
                id="isPrimaryCheck"
                checked={insuranceForm.isPrimary}
                onChange={(e) => setInsuranceForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="isPrimaryCheck" style={{ fontSize: 14, color: 'var(--foreground)', cursor: 'pointer' }}>
                Set as Primary Insurance Policy
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
              <Button variant="ghost" onClick={() => setInsuranceModal(false)}>Cancel</Button>
              <Button loading={savingInsurance} onClick={handleSaveInsurance}>
                {editingInsurance ? 'Update Policy' : 'Save Policy'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Add/Edit Emergency Contact Modal */}
        <Modal
          open={emergencyModal}
          onClose={() => setEmergencyModal(false)}
          title={editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
        >
          <div className="space-y-4">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Jane"
                  value={contactForm.firstName}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Doe"
                  value={contactForm.lastName}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Relationship *</label>
              <select
                className="form-input"
                value={contactForm.relationship}
                onChange={(e) => setContactForm((prev) => ({ ...prev, relationship: e.target.value }))}
              >
                <option value="Parent">Parent</option>
                <option value="Spouse">Spouse</option>
                <option value="Child">Child</option>
                <option value="Sibling">Sibling</option>
                <option value="Guardian">Guardian</option>
                <option value="Relative">Relative</option>
                <option value="Friend">Friend</option>
                <option value="Partner">Partner</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. +1 (555) 234-5678"
                value={contactForm.phone}
                onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--card-border)' }}>
              <Button variant="ghost" onClick={() => setEmergencyModal(false)}>Cancel</Button>
              <Button loading={savingContact} onClick={handleSaveContact}>
                {editingContact ? 'Update Contact' : 'Save Contact'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Profile Picture Crop Modal */}
        {cropSrc && (
          <PhotoCropModal
            imageSrc={cropSrc}
            onSave={handleCropSave}
            onClose={handleCropCancel}
          />
        )}
      </div>
    </AppLayout>
  );
}
