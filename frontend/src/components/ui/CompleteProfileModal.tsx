'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  User, Calendar, Phone, MapPin, Droplet,
  ChevronRight, HeartPulse, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { patientApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/lib/types';
import NearbyHospitalDetector from '@/components/ui/NearbyHospitalDetector';
import PhilippineAddressSelector from '@/components/ui/PhilippineAddressSelector';

interface FormData {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  address: string;
  bloodType: string;
}

const EMPTY: FormData = {
  firstName: '',
  lastName: '',
  middleName: '',
  dateOfBirth: '',
  gender: '',
  phone: '',
  address: '',
  bloodType: '',
};

const STEPS = [
  {
    id: 'name',
    title: "What's your name?",
    subtitle: 'This will appear on your medical records.',
    icon: User,
    fields: ['firstName', 'lastName', 'middleName'] as (keyof FormData)[],
  },
  {
    id: 'personal',
    title: 'Personal details',
    subtitle: 'Help us keep your profile accurate.',
    icon: Calendar,
    fields: ['dateOfBirth', 'gender', 'bloodType'] as (keyof FormData)[],
  },
  {
    id: 'contact',
    title: 'Contact information',
    subtitle: "We'll use this for appointment confirmations.",
    icon: Phone,
    fields: ['phone', 'address'] as (keyof FormData)[],
  },
] as const;

const FIELD_CONFIG: Record<keyof FormData, {
  label: string; placeholder: string; type?: string;
  required?: boolean; options?: string[];
}> = {
  firstName:   { label: 'First Name',    placeholder: 'John',           required: true },
  lastName:    { label: 'Last Name',     placeholder: 'Doe',            required: true },
  middleName:  { label: 'Middle Name',   placeholder: 'Optional' },
  dateOfBirth: { label: 'Date of Birth', placeholder: '',               type: 'date' },
  gender:      { label: 'Gender',        placeholder: 'Select gender',  options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
  bloodType:   { label: 'Blood Type',    placeholder: 'Select',         options: ['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'] },
  phone:       { label: 'Phone Number',  placeholder: '+1 (555) 000-0000' },
  address:     { label: 'Address',       placeholder: 'Street, City, State…' },
};

/**
 * Force-complete modal for new patients who have no profile yet.
 * Only renders for roleId === 3 (USER/PATIENT) with a missing profile.
 * Cannot be dismissed without submitting.
 */
export default function CompleteProfileModal() {
  const { user } = useAuth();
  const [show,    setShow]    = useState(false);
  const [step,    setStep]    = useState(0);
  const [form,    setForm]    = useState<FormData>(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  // Only fire for patient role
  const isPatient = user?.roleId === ROLES.USER;

  const checkProfile = useCallback(async () => {
    if (!user || !isPatient) { setChecked(true); return; }
    try {
      await patientApi.getMyProfile();
      // Profile exists — nothing to do
      setChecked(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      if (axiosErr?.response?.status === 404) {
        // No profile — show the modal
        setShow(true);
      }
      setChecked(true);
    }
  }, [user, isPatient]);

  useEffect(() => {
    checkProfile();
  }, [checkProfile]);

  const currentStep = STEPS[step];
  const isLastStep  = step === STEPS.length - 1;

  const validateStep = () => {
    const required = currentStep.fields.filter((f) => FIELD_CONFIG[f].required);
    const missing  = required.filter((f) => !form[f]?.trim());
    if (missing.length > 0) {
      const labels = missing.map((f) => FIELD_CONFIG[f].label).join(', ');
      setError(`${labels} ${missing.length > 1 ? 'are' : 'is'} required.`);
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSaving(true);
    setError(null);
    try {
      await patientApi.create({
        first_name:   form.firstName.trim(),
        last_name:    form.lastName.trim(),
        middle_name:  form.middleName.trim() || undefined,
        date_of_birth: form.dateOfBirth || undefined,
        gender:       form.gender       || undefined,
        blood_type:   form.bloodType    || undefined,
        phone:        form.phone.trim() || undefined,
        address:      form.address.trim() || undefined,
      });
      setDone(true);
      // Auto-dismiss after success animation
      setTimeout(() => setShow(false), 2000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Don't block render while checking, and don't show for non-patients
  if (!checked || !show) return null;

  const progress = ((step + (done ? 1 : 0)) / STEPS.length) * 100;
  const StepIcon = currentStep.icon;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, padding: 20,
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 20,
        boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
        width: '100%', maxWidth: 480,
        overflow: 'hidden',
        animation: 'slideUp 0.3s ease',
      }}>

        {/* ── Progress bar ── */}
        <div style={{ height: 4, background: 'var(--card-border)' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--primary)',
            transition: 'width 0.4s ease',
            borderRadius: 99,
          }} />
        </div>

        {done ? (
          /* ── Success state ── */
          <div style={{ padding: '48px 40px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#d1fae5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <CheckCircle2 size={30} style={{ color: '#065f46' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', marginBottom: 8 }}>
              Profile complete!
            </h2>
            <p style={{ fontSize: 14, color: 'var(--muted)' }}>
              Welcome to MediBook, {form.firstName}. You're all set.
            </p>
          </div>

        ) : (
          /* ── Form ── */
          <div style={{ padding: '32px 36px 28px' }}>

            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <HeartPulse size={14} style={{ color: '#fff' }} />
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--primary)' }}>MediBook</span>
              <span style={{
                marginLeft: 'auto', fontSize: 11.5, fontWeight: 600,
                color: 'var(--muted)', background: 'var(--accent)',
                padding: '3px 10px', borderRadius: 99,
              }}>
                Step {step + 1} of {STEPS.length}
              </span>
            </div>

            {/* Step icon + heading */}
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <StepIcon size={22} style={{ color: 'var(--primary)' }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', marginBottom: 4, letterSpacing: '-0.4px' }}>
              {currentStep.title}
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--muted)', marginBottom: 24 }}>
              {currentStep.subtitle}
            </p>

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {currentStep.fields.map((fieldKey) => {
                const cfg = FIELD_CONFIG[fieldKey];
                const val = form[fieldKey];
                const isRequired = cfg.required;

                if (fieldKey === 'address') {
                  return (
                    <div key={fieldKey} className="form-group" style={{ margin: 0 }}>
                      <PhilippineAddressSelector
                        value={val}
                        compact={true}
                        onChange={(addr) => setForm((p) => ({ ...p, address: addr }))}
                        label="Your Address"
                      />
                      {form.address && form.address.trim().length >= 3 && (
                        <NearbyHospitalDetector
                          address={form.address}
                          compact={true}
                          showActions={false}
                          title="Nearest Hospital"
                        />
                      )}
                    </div>
                  );
                }

                return (
                  <div key={fieldKey} className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ marginBottom: 6 }}>
                      {cfg.label}
                      {isRequired && (
                        <span style={{ color: 'var(--danger-text)', marginLeft: 3 }}>*</span>
                      )}
                    </label>
                    {cfg.options ? (
                      <select
                        className="form-input"
                        value={val}
                        onChange={(e) => setForm((p) => ({ ...p, [fieldKey]: e.target.value }))}
                      >
                        <option value="">{cfg.placeholder}</option>
                        {cfg.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        type={cfg.type ?? 'text'}
                        className="form-input"
                        placeholder={cfg.placeholder}
                        value={val}
                        onChange={(e) => setForm((p) => ({ ...p, [fieldKey]: e.target.value }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--danger-bg)', borderRadius: 8, padding: '10px 14px',
              }}>
                <AlertCircle size={14} style={{ color: 'var(--danger-text)', flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: 'var(--danger-text)' }}>{error}</p>
              </div>
            )}

            {/* Step dots */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
              {STEPS.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 20 : 6, height: 6, borderRadius: 99,
                  background: i === step ? 'var(--primary)' : i < step ? 'var(--primary)' : 'var(--card-border)',
                  opacity: i < step ? 0.45 : 1,
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </div>

            {/* CTA */}
            <div style={{ marginTop: 20 }}>
              <button
                onClick={isLastStep ? handleSubmit : handleNext}
                disabled={saving}
                style={{
                  width: '100%', padding: '13px 20px',
                  borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer',
                  background: 'var(--primary)', color: '#fff',
                  fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.2px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'opacity 0.15s', opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? (
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    {isLastStep ? 'Complete Profile' : 'Continue'}
                    {!saving && <ChevronRight size={16} />}
                  </>
                )}
              </button>

              <p style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                🔒 Your information is stored securely and used only for your care.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
