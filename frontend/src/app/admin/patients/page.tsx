'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  User, Plus, Search, Edit, Trash2, CreditCard, Star,
  PhoneCall, Phone, Eye, Shield, Check, AlertCircle
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import Badge from '@/components/ui/Badge';
import NearbyHospitalDetector from '@/components/ui/NearbyHospitalDetector';
import PhilippineAddressSelector from '@/components/ui/PhilippineAddressSelector';
import { patientApi, userManApi, insuranceApi, emergencyContactApi, medicalInfoApi } from '@/lib/api';
import type { Patient, UserManResponse, Insurance, EmergencyContact, MedicalInformation } from '@/lib/types';

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [users, setUsers] = useState<UserManResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Unified Patient Details Modal State ─────────────────────────────────────
  const [detailsModal, setDetailsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'emergency' | 'insurance' | 'medical'>('info');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [savingPatient, setSavingPatient] = useState(false);
  const [patientSaveSuccess, setPatientSaveSuccess] = useState(false);

  // Patient Info Form
  const [patientForm, setPatientForm] = useState({
    userId: 0,
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    address: '',
    bloodType: '',
  });

  // Insurance State
  const [patientInsurances, setPatientInsurances] = useState<Insurance[]>([]);
  const [loadingInsurances, setLoadingInsurances] = useState(false);
  const [showInsuranceForm, setShowInsuranceForm] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<Insurance | null>(null);
  const [savingInsurance, setSavingInsurance] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    providerName: '',
    policyNumber: '',
    coverageType: 'Comprehensive Health',
    validUntil: '',
    isPrimary: false,
  });

  // Emergency Contact State
  const [patientEmergencyContacts, setPatientEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loadingEmergencyContacts, setLoadingEmergencyContacts] = useState(false);
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [editingEmergencyContact, setEditingEmergencyContact] = useState<EmergencyContact | null>(null);
  const [savingEmergencyContact, setSavingEmergencyContact] = useState(false);
  const [emergencyContactForm, setEmergencyContactForm] = useState({
    firstName: '',
    lastName: '',
    relationship: 'Parent',
    phone: '',
  });

  // Medical History State
  const [patientMedicalInfo, setPatientMedicalInfo] = useState<MedicalInformation | null>(null);
  const [loadingMedicalInfo, setLoadingMedicalInfo] = useState(false);
  const [savingMedicalInfo, setSavingMedicalInfo] = useState(false);
  const [medicalInfoForm, setMedicalInfoForm] = useState({
    allergies: '',
    medicalHistory: '',
    medications: '',
  });
  const [medicalInfoSaveSuccess, setMedicalInfoSaveSuccess] = useState(false);

  // ── Data Loaders ───────────────────────────────────────────────────────────

  const load = () => {
    setLoading(true);
    Promise.all([patientApi.getAll(), userManApi.getAll()])
      .then(([pt, usr]) => {
        setPatients(pt.data ?? []);
        setUsers(usr.data ?? []);
      })
      .catch((err) => console.error('Error loading patients:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const loadPatientInsurances = useCallback(async (pId: number) => {
    setLoadingInsurances(true);
    try {
      const res = await insuranceApi.getByPatientId(pId);
      const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      setPatientInsurances(items);
    } catch (err) {
      console.error('Failed to load patient insurances:', err);
    } finally {
      setLoadingInsurances(false);
    }
  }, []);

  const loadPatientEmergencyContacts = useCallback(async (pId: number) => {
    setLoadingEmergencyContacts(true);
    try {
      const res = await emergencyContactApi.getByPatientId(pId);
      const items = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
      setPatientEmergencyContacts(items);
    } catch (err) {
      console.error('Failed to load patient emergency contacts:', err);
    } finally {
      setLoadingEmergencyContacts(false);
    }
  }, []);

  const loadPatientMedicalInfo = useCallback(async (pId: number) => {
    setLoadingMedicalInfo(true);
    try {
      const res = await medicalInfoApi.getByPatientId(pId);
      const data = res.data as MedicalInformation;
      setPatientMedicalInfo(data);
      const raw = data as unknown as Record<string, string>;
      setMedicalInfoForm({
        allergies: String(data?.allergies ?? raw?.allergies ?? ''),
        medicalHistory: String(data?.medicalHistory ?? raw?.medical_history ?? ''),
        medications: String(data?.medications ?? raw?.medications ?? ''),
      });
    } catch {
      setPatientMedicalInfo(null);
      setMedicalInfoForm({ allergies: '', medicalHistory: '', medications: '' });
    } finally {
      setLoadingMedicalInfo(false);
    }
  }, []);

  // ── Open Unified Details Modal ─────────────────────────────────────────────

  const handleOpenCreate = () => {
    setSelectedPatient(null);
    setActiveTab('info');
    setShowInsuranceForm(false);
    setShowEmergencyForm(false);
    setPatientInsurances([]);
    setPatientEmergencyContacts([]);
    setPatientMedicalInfo(null);
    setMedicalInfoForm({ allergies: '', medicalHistory: '', medications: '' });
    setPatientSaveSuccess(false);
    setMedicalInfoSaveSuccess(false);
    setPatientForm({
      userId: 0,
      firstName: '',
      middleName: '',
      lastName: '',
      dateOfBirth: '',
      gender: 'Male',
      phone: '',
      address: '',
      bloodType: '',
    });
    setDetailsModal(true);
  };

  const handleOpenPatientDetails = (patient: Patient, initialTab: 'info' | 'emergency' | 'insurance' = 'info') => {
    const raw = patient as unknown as Record<string, unknown>;
    const pId = Number(patient.patientId ?? raw.patient_id ?? 0);
    setSelectedPatient(patient);
    setActiveTab(initialTab);
    setShowInsuranceForm(false);
    setShowEmergencyForm(false);
    setPatientSaveSuccess(false);
    setPatientForm({
      userId: Number(patient.userId ?? raw.user_id ?? 0),
      firstName: String(patient.firstName ?? raw.first_name ?? ''),
      middleName: String(raw.middle_name ?? ''),
      lastName: String(patient.lastName ?? raw.last_name ?? ''),
      dateOfBirth: String(patient.dateOfBirth ?? raw.date_of_birth ?? ''),
      gender: String(patient.gender ?? raw.gender ?? 'Male'),
      phone: String(patient.phone ?? raw.phone ?? ''),
      address: String(patient.address ?? raw.address ?? ''),
      bloodType: String(patient.bloodType ?? raw.blood_type ?? ''),
    });
    setDetailsModal(true);

    if (pId) {
      loadPatientInsurances(pId);
      loadPatientEmergencyContacts(pId);
      loadPatientMedicalInfo(pId);
    }
  };

  // ── Patient Info Handlers ─────────────────────────────────────────────────

  const handleSavePatient = async () => {
    if (!patientForm.firstName || !patientForm.lastName || !patientForm.userId) {
      alert('First name, last name, and linked user account are required.');
      return;
    }
    setSavingPatient(true);
    setPatientSaveSuccess(false);
    try {
      if (selectedPatient) {
        const raw = selectedPatient as unknown as Record<string, unknown>;
        const pId = Number(selectedPatient.patientId ?? raw.patient_id);
        await patientApi.update(pId, {
          patientId: pId,
          patient_id: pId,
          ...patientForm,
        });
        setSelectedPatient((prev) => (prev ? { ...prev, ...patientForm } : null));
      } else {
        const res = await patientApi.create(patientForm);
        const newPat = res.data;
        if (newPat) {
          setSelectedPatient(newPat);
          const raw = newPat as unknown as Record<string, unknown>;
          const newId = Number(newPat.patientId ?? raw.patient_id);
          if (newId) {
            loadPatientInsurances(newId);
            loadPatientEmergencyContacts(newId);
          }
        }
      }
      setPatientSaveSuccess(true);
      setTimeout(() => setPatientSaveSuccess(false), 3000);
      load();
    } catch (err) {
      console.error('Failed to save patient:', err);
      alert('Failed to save patient profile.');
    } finally {
      setSavingPatient(false);
    }
  };

  const handleDeletePatient = async (id: number) => {
    if (!confirm('Delete this patient profile?')) return;
    try {
      await patientApi.delete(id);
      if (selectedPatient) {
        const raw = selectedPatient as unknown as Record<string, unknown>;
        const pId = Number(selectedPatient.patientId ?? raw.patient_id);
        if (pId === id) setDetailsModal(false);
      }
      load();
    } catch {
      alert('Could not delete patient record.');
    }
  };

  // ── Medical History Handlers ─────────────────────────────────────────────

  const handleSaveMedicalInfo = async () => {
    const rawPat = selectedPatient as unknown as Record<string, number>;
    const pId = Number(selectedPatient?.patientId ?? rawPat?.patient_id);
    if (!pId) {
      alert('Please save the patient profile first before editing medical history.');
      return;
    }
    setSavingMedicalInfo(true);
    setMedicalInfoSaveSuccess(false);
    try {
      if (patientMedicalInfo && (patientMedicalInfo.medicalInfoId || (patientMedicalInfo as unknown as Record<string, number>).medical_info_id)) {
        const mId = Number(patientMedicalInfo.medicalInfoId || (patientMedicalInfo as unknown as Record<string, number>).medical_info_id);
        await medicalInfoApi.update(mId, { ...medicalInfoForm, patientId: pId });
      } else {
        await medicalInfoApi.create({ ...medicalInfoForm, patientId: pId });
      }
      await loadPatientMedicalInfo(pId);
      setMedicalInfoSaveSuccess(true);
      setTimeout(() => setMedicalInfoSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save medical info:', err);
      alert('Failed to save medical information.');
    } finally {
      setSavingMedicalInfo(false);
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
      isPrimary: patientInsurances.length === 0,
    });
    setShowInsuranceForm(true);
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
    setShowInsuranceForm(true);
  };

  const handleSaveInsurance = async () => {
    if (!insuranceForm.providerName.trim() || !insuranceForm.policyNumber.trim()) {
      alert('Provider name and policy number are required.');
      return;
    }
    const rawPat = selectedPatient as unknown as Record<string, number>;
    const pId = Number(selectedPatient?.patientId ?? rawPat?.patient_id);
    if (!pId) {
      alert('Please save the patient profile first before adding insurance.');
      return;
    }

    setSavingInsurance(true);
    try {
      if (editingInsurance) {
        const insId = Number(editingInsurance.insuranceId ?? (editingInsurance as unknown as Record<string, number>).insurance_id);
        await insuranceApi.update(insId, {
          insuranceId: insId,
          insurance_id: insId,
          patientId: pId,
          ...insuranceForm,
        });
      } else {
        await insuranceApi.create({
          ...insuranceForm,
          patientId: pId,
        });
      }
      setShowInsuranceForm(false);
      await loadPatientInsurances(pId);
    } catch (err) {
      console.error('Failed to save insurance:', err);
      alert('Failed to save insurance policy.');
    } finally {
      setSavingInsurance(false);
    }
  };

  const handleSetPrimaryInsurance = async (ins: Insurance) => {
    const raw = ins as unknown as Record<string, number>;
    const insId = Number(ins.insuranceId ?? raw.insurance_id);
    const rawPat = selectedPatient as unknown as Record<string, number>;
    const pId = Number(selectedPatient?.patientId ?? rawPat?.patient_id);

    try {
      await insuranceApi.setPrimary(insId);
      if (pId) await loadPatientInsurances(pId);
    } catch (err) {
      console.error('Failed to set primary:', err);
      alert('Failed to set insurance as primary.');
    }
  };

  const handleDeleteInsurance = async (ins: Insurance) => {
    const raw = ins as unknown as Record<string, unknown>;
    const insId = Number(ins.insuranceId ?? raw.insurance_id);
    const rawPat = selectedPatient as unknown as Record<string, number>;
    const pId = Number(selectedPatient?.patientId ?? rawPat?.patient_id);
    const provider = String(ins.providerName ?? raw.provider_name ?? 'this');

    if (!confirm(`Delete ${provider} insurance policy?`)) return;

    try {
      await insuranceApi.delete(insId);
      if (pId) await loadPatientInsurances(pId);
    } catch (err) {
      console.error('Failed to delete insurance:', err);
      alert('Failed to delete insurance.');
    }
  };

  // ── Emergency Contacts Handlers ──────────────────────────────────────────

  const handleOpenAddEmergencyContact = () => {
    setEditingEmergencyContact(null);
    setEmergencyContactForm({
      firstName: '',
      lastName: '',
      relationship: 'Parent',
      phone: '',
    });
    setShowEmergencyForm(true);
  };

  const handleOpenEditEmergencyContact = (contact: EmergencyContact) => {
    const raw = contact as unknown as Record<string, unknown>;
    setEditingEmergencyContact(contact);
    setEmergencyContactForm({
      firstName: String(contact.firstName ?? raw.first_name ?? ''),
      lastName: String(contact.lastName ?? raw.last_name ?? ''),
      relationship: String(contact.relationship ?? raw.relationship ?? 'Parent'),
      phone: String(contact.phone ?? raw.phone ?? ''),
    });
    setShowEmergencyForm(true);
  };

  const handleSaveEmergencyContact = async () => {
    if (!emergencyContactForm.firstName.trim() || !emergencyContactForm.lastName.trim() || !emergencyContactForm.phone.trim()) {
      alert('First name, last name, and phone number are required.');
      return;
    }
    const rawPat = selectedPatient as unknown as Record<string, number>;
    const pId = Number(selectedPatient?.patientId ?? rawPat?.patient_id);
    if (!pId) {
      alert('Please save the patient profile first before adding emergency contacts.');
      return;
    }

    setSavingEmergencyContact(true);
    try {
      if (editingEmergencyContact) {
        const raw = editingEmergencyContact as unknown as Record<string, unknown>;
        const cId = Number(editingEmergencyContact.contactId ?? raw.contact_id ?? editingEmergencyContact.emergencyContactId);
        await emergencyContactApi.update(cId, {
          contactId: cId,
          contact_id: cId,
          patientId: pId,
          ...emergencyContactForm,
        });
      } else {
        await emergencyContactApi.create({
          ...emergencyContactForm,
          patientId: pId,
        });
      }
      setShowEmergencyForm(false);
      await loadPatientEmergencyContacts(pId);
    } catch (err) {
      console.error('Failed to save emergency contact:', err);
      alert('Failed to save emergency contact.');
    } finally {
      setSavingEmergencyContact(false);
    }
  };

  const handleDeleteEmergencyContact = async (contact: EmergencyContact) => {
    const raw = contact as unknown as Record<string, unknown>;
    const cId = Number(contact.contactId ?? raw.contact_id ?? contact.emergencyContactId);
    const rawPat = selectedPatient as unknown as Record<string, number>;
    const pId = Number(selectedPatient?.patientId ?? rawPat?.patient_id);
    const fname = String(contact.firstName ?? raw.first_name ?? '');
    const lname = String(contact.lastName ?? raw.last_name ?? '');
    const name = `${fname} ${lname}`.trim() || 'this contact';

    if (!confirm(`Delete ${name} from emergency contacts?`)) return;

    try {
      await emergencyContactApi.delete(cId);
      if (pId) await loadPatientEmergencyContacts(pId);
    } catch (err) {
      console.error('Failed to delete emergency contact:', err);
      alert('Failed to delete emergency contact.');
    }
  };

  const filtered = patients.filter((p) => {
    const raw = p as unknown as Record<string, unknown>;
    const fname = String(p.firstName ?? raw.first_name ?? '');
    const lname = String(p.lastName ?? raw.last_name ?? '');
    const full = `${fname} ${lname}`.toLowerCase();
    return search ? full.includes(search.toLowerCase()) : true;
  });

  const rawSelected = selectedPatient as unknown as Record<string, unknown>;
  const selectedPId = selectedPatient ? Number(selectedPatient.patientId ?? rawSelected?.patient_id ?? 0) : null;
  const selectedFname = String((selectedPatient?.firstName ?? rawSelected?.first_name ?? patientForm.firstName) || '');
  const selectedMname = String((selectedPatient?.middleName ?? rawSelected?.middle_name ?? patientForm.middleName) || '');
  const selectedLname = String((selectedPatient?.lastName ?? rawSelected?.last_name ?? patientForm.lastName) || '');
  const selectedFullName = [selectedFname, selectedMname, selectedLname].filter(Boolean).join(' ') || 'New Patient';
  const selectedInitials = `${selectedFname[0] ?? 'P'}${selectedLname[0] ?? ''}`;

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Manage Patients</h1>
            <p className="page-subtitle">{patients.length} patient records</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Patient
          </Button>
        </div>

        <div className="search-bar" style={{ maxWidth: 400 }}>
          <Search size={15} style={{ color: 'var(--muted)' }} />
          <input
            placeholder="Search patients by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, index) => {
                  const raw = p as unknown as Record<string, unknown>;
                  const pId = Number(p.patientId ?? raw.patient_id ?? index);
                  const fname = String(p.firstName ?? raw.first_name ?? '');
                  const mname = String(raw.middle_name ?? '');
                  const lname = String(p.lastName ?? raw.last_name ?? '');
                  const full = [fname, mname, lname].filter(Boolean).join(' ');
                  const initials = `${fname[0] ?? 'P'}${lname[0] ?? ''}`;

                  const pic = String(p.profilePicturePath || raw.profile_picture_path || '');

                  return (
                    <tr key={`pat-row-${pId || index}`}>
                      <td>
                        <div
                          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                          onClick={() => handleOpenPatientDetails(p)}
                        >
                          <Avatar
                            initials={initials}
                            src={pic}
                            size="sm"
                            zoomable={true}
                            title={full || 'Patient'}
                            subtitle={`Patient #${pId}`}
                          />
                          <div>
                            <p className="font-medium text-sm hover:underline" style={{ margin: 0 }}>
                              {full || 'Patient'}
                            </p>
                            <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>
                              Patient ID: #{pId}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Eye}
                            onClick={() => handleOpenPatientDetails(p)}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeletePatient(pId)}
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
                    <td colSpan={2} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No patient profiles found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── UNIFIED PATIENT DETAILS MODAL ── */}
      <Modal
        open={detailsModal}
        onClose={() => setDetailsModal(false)}
        title={selectedPatient ? `Patient Profile: ${selectedFullName}` : 'Add New Patient'}
        subtitle={
          selectedPatient
            ? `ID: #${selectedPId} · Personal details, emergency contacts, and insurance in one view`
            : 'Fill in the patient information below'
        }
        maxWidth={720}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {patientSaveSuccess && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--success-text)', fontSize: 13, fontWeight: 500 }}>
                  <Check size={16} /> Patient information saved!
                </span>
              )}
            </div>
            <Button variant="ghost" onClick={() => setDetailsModal(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Patient Quick Summary Header (when viewing existing patient) */}
          {selectedPatient && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--accent)',
                border: '1px solid var(--card-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar
                  initials={selectedInitials}
                  src={String(selectedPatient?.profilePicturePath || (selectedPatient as unknown as Record<string, unknown>)?.profile_picture_path || '')}
                  size="md"
                  zoomable={true}
                  title={selectedFullName}
                  subtitle={patientForm.phone || 'Patient'}
                />
                <div>
                  <h3 className="font-semibold text-base" style={{ margin: 0 }}>{selectedFullName}</h3>
                  <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>
                    {patientForm.phone || 'No phone'} · {patientForm.address || 'No address registered'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {patientForm.gender && <Badge variant="muted">{patientForm.gender}</Badge>}
                {patientForm.bloodType && <Badge variant="info">Blood: {patientForm.bloodType}</Badge>}
                {patientForm.dateOfBirth && <Badge variant="muted">DOB: {patientForm.dateOfBirth}</Badge>}
              </div>
            </div>
          )}

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--card-border)', paddingBottom: 8 }}>
            <button
              type="button"
              onClick={() => { setActiveTab('info'); setShowInsuranceForm(false); setShowEmergencyForm(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                border: 'none',
                background: activeTab === 'info' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'info' ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <User size={15} />
              Personal Info
            </button>

            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  alert('Please save the patient information first before managing emergency contacts.');
                  return;
                }
                setActiveTab('emergency');
                setShowInsuranceForm(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: selectedPatient ? 'pointer' : 'not-allowed',
                border: 'none',
                opacity: selectedPatient ? 1 : 0.6,
                background: activeTab === 'emergency' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'emergency' ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <PhoneCall size={15} />
              Emergency Contacts
              {patientEmergencyContacts.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: activeTab === 'emergency' ? 'rgba(255,255,255,0.25)' : 'var(--card-border)',
                    color: activeTab === 'emergency' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {patientEmergencyContacts.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  alert('Please save the patient information first before managing insurance.');
                  return;
                }
                setActiveTab('insurance');
                setShowEmergencyForm(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: selectedPatient ? 'pointer' : 'not-allowed',
                border: 'none',
                opacity: selectedPatient ? 1 : 0.6,
                background: activeTab === 'insurance' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'insurance' ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <Shield size={15} />
              Insurance Policies
              {patientInsurances.length > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: activeTab === 'insurance' ? 'rgba(255,255,255,0.25)' : 'var(--card-border)',
                    color: activeTab === 'insurance' ? '#fff' : 'var(--foreground)',
                  }}
                >
                  {patientInsurances.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!selectedPatient) {
                  alert('Please save the patient information first before editing medical history.');
                  return;
                }
                setActiveTab('medical');
                setShowInsuranceForm(false);
                setShowEmergencyForm(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: selectedPatient ? 'pointer' : 'not-allowed',
                border: 'none',
                opacity: selectedPatient ? 1 : 0.6,
                background: activeTab === 'medical' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'medical' ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s ease',
              }}
            >
              <AlertCircle size={15} />
              Medical History
            </button>
          </div>

          {/* ── TAB 1: PERSONAL INFO FORM ── */}
          {activeTab === 'info' && (
            <div className="space-y-4" style={{ paddingTop: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Linked User Account *</label>
                  <select
                    className="form-input"
                    value={patientForm.userId}
                    onChange={(e) => setPatientForm((p) => ({ ...p, userId: Number(e.target.value) }))}
                  >
                    <option value={0}>Select user account…</option>
                    {users.map((u, idx) => {
                      const rawUsr = u as unknown as Record<string, unknown>;
                      const id = Number(u.userId ?? rawUsr.user_id ?? idx);
                      const name = String(u.userName ?? rawUsr.user_name ?? `user_${id}`);
                      return (
                        <option key={`usr-pat-opt-${id || idx}`} value={id}>
                          @{name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    className="form-input"
                    value={patientForm.firstName}
                    onChange={(e) => setPatientForm((p) => ({ ...p, firstName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Middle Name</label>
                  <input
                    className="form-input"
                    value={patientForm.middleName}
                    onChange={(e) => setPatientForm((p) => ({ ...p, middleName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    className="form-input"
                    value={patientForm.lastName}
                    onChange={(e) => setPatientForm((p) => ({ ...p, lastName: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-input"
                    value={patientForm.gender}
                    onChange={(e) => setPatientForm((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    className="form-input"
                    placeholder="+1 (555) 000-0000"
                    value={patientForm.phone}
                    onChange={(e) => setPatientForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Blood Type</label>
                  <input
                    className="form-input"
                    placeholder="A+, O-, etc."
                    value={patientForm.bloodType}
                    onChange={(e) => setPatientForm((p) => ({ ...p, bloodType: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={patientForm.dateOfBirth}
                    onChange={(e) => setPatientForm((p) => ({ ...p, dateOfBirth: e.target.value }))}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <PhilippineAddressSelector
                    value={patientForm.address}
                    onChange={(addr) => setPatientForm((p) => ({ ...p, address: addr }))}
                    label="Patient Address"
                  />
                  <NearbyHospitalDetector
                    address={patientForm.address}
                    compact={true}
                    showActions={false}
                    title="Detected Facility for Patient Address"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10, borderTop: '1px solid var(--card-border)' }}>
                <Button loading={savingPatient} onClick={handleSavePatient}>
                  {selectedPatient ? 'Save Changes' : 'Create Patient Profile'}
                </Button>
              </div>
            </div>
          )}

          {/* ── TAB 2: EMERGENCY CONTACTS ── */}
          {activeTab === 'emergency' && (
            <div className="space-y-4" style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 className="font-semibold text-sm" style={{ margin: 0 }}>Emergency Contacts</h4>
                  <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>
                    Emergency points of contact for hospital intake and critical reachability.
                  </p>
                </div>
                {!showEmergencyForm && (
                  <Button size="sm" icon={Plus} onClick={handleOpenAddEmergencyContact}>
                    Add Contact
                  </Button>
                )}
              </div>

              {/* Inline Add / Edit Emergency Contact Drawer */}
              {showEmergencyForm && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: '1.5px solid var(--primary)',
                    background: 'var(--card-bg)',
                  }}
                >
                  <h5 className="font-semibold text-sm" style={{ marginBottom: 12 }}>
                    {editingEmergencyContact ? 'Edit Emergency Contact' : 'Add New Emergency Contact'}
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">First Name *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. John"
                        value={emergencyContactForm.firstName}
                        onChange={(e) => setEmergencyContactForm((prev) => ({ ...prev, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Name *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Doe"
                        value={emergencyContactForm.lastName}
                        onChange={(e) => setEmergencyContactForm((prev) => ({ ...prev, lastName: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Relationship *</label>
                      <select
                        className="form-input"
                        value={emergencyContactForm.relationship}
                        onChange={(e) => setEmergencyContactForm((prev) => ({ ...prev, relationship: e.target.value }))}
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
                        className="form-input"
                        placeholder="e.g. +1 (555) 000-0000"
                        value={emergencyContactForm.phone}
                        onChange={(e) => setEmergencyContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                    <Button variant="ghost" size="sm" onClick={() => setShowEmergencyForm(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" loading={savingEmergencyContact} onClick={handleSaveEmergencyContact}>
                      {editingEmergencyContact ? 'Update Contact' : 'Save Contact'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Emergency Contacts List */}
              {loadingEmergencyContacts ? (
                <Spinner center />
              ) : patientEmergencyContacts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--accent)', borderRadius: 8 }}>
                  <PhoneCall size={24} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No emergency contacts registered</p>
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>Add a contact for intake records and emergency reachability.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientEmergencyContacts.map((contact, idx) => {
                    const raw = contact as unknown as Record<string, unknown>;
                    const cId = Number(contact.contactId ?? raw.contact_id ?? contact.emergencyContactId ?? idx);
                    const fname = String(contact.firstName ?? raw.first_name ?? '');
                    const lname = String(contact.lastName ?? raw.last_name ?? '');
                    const fullName = `${fname} ${lname}`.trim() || 'Emergency Contact';
                    const relationship = String(contact.relationship ?? raw.relationship ?? 'Family / Guardian');
                    const phone = String(contact.phone ?? raw.phone ?? '—');

                    return (
                      <div
                        key={`pat-ec-${cId}`}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: '1px solid var(--card-border)',
                          background: 'var(--card-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{fullName}</span>
                            <Badge variant="muted">{relationship}</Badge>
                          </div>
                          <p className="text-xs text-muted" style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Phone size={12} />
                            <a href={`tel:${phone}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}>
                              {phone}
                            </a>
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEditEmergencyContact(contact)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDeleteEmergencyContact(contact)} style={{ color: 'var(--danger-text)' }}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: INSURANCE POLICIES ── */}
          {activeTab === 'insurance' && (
            <div className="space-y-4" style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 className="font-semibold text-sm" style={{ margin: 0 }}>Insurance & Health Coverage</h4>
                  <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>
                    Active insurance policies and healthcare coverage for billing and claims.
                  </p>
                </div>
                {!showInsuranceForm && (
                  <Button size="sm" icon={Plus} onClick={handleOpenAddInsurance}>
                    Add Policy
                  </Button>
                )}
              </div>

              {/* Inline Add / Edit Insurance Form Drawer */}
              {showInsuranceForm && (
                <div
                  style={{
                    padding: 16,
                    borderRadius: 8,
                    border: '1.5px solid var(--primary)',
                    background: 'var(--card-bg)',
                  }}
                >
                  <h5 className="font-semibold text-sm" style={{ marginBottom: 12 }}>
                    {editingInsurance ? 'Edit Insurance Policy' : 'Add New Insurance Policy'}
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Provider Name *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. PhilHealth, Maxicare, Blue Cross"
                        value={insuranceForm.providerName}
                        onChange={(e) => setInsuranceForm((prev) => ({ ...prev, providerName: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Policy Number *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. POL-12345678"
                        value={insuranceForm.policyNumber}
                        onChange={(e) => setInsuranceForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Coverage Type</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Comprehensive, HMO, Dental"
                        value={insuranceForm.coverageType}
                        onChange={(e) => setInsuranceForm((prev) => ({ ...prev, coverageType: e.target.value }))}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valid Until</label>
                      <input
                        type="date"
                        className="form-input"
                        value={insuranceForm.validUntil}
                        onChange={(e) => setInsuranceForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <input
                      type="checkbox"
                      id="primaryPolicyCheckInline"
                      checked={insuranceForm.isPrimary}
                      onChange={(e) => setInsuranceForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="primaryPolicyCheckInline" style={{ fontSize: 13, color: 'var(--foreground)', cursor: 'pointer' }}>
                      Set as Primary Insurance Policy
                    </label>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                    <Button variant="ghost" size="sm" onClick={() => setShowInsuranceForm(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" loading={savingInsurance} onClick={handleSaveInsurance}>
                      {editingInsurance ? 'Update Policy' : 'Save Policy'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Insurance Policies List */}
              {loadingInsurances ? (
                <Spinner center />
              ) : patientInsurances.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--accent)', borderRadius: 8 }}>
                  <CreditCard size={24} style={{ color: 'var(--muted)', margin: '0 auto 8px' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>No insurance policies found</p>
                  <p className="text-xs text-muted" style={{ marginTop: 4 }}>Add insurance policies for this patient during intake.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {patientInsurances.map((ins, idx) => {
                    const raw = ins as unknown as Record<string, unknown>;
                    const insId = Number(ins.insuranceId ?? raw.insurance_id ?? idx);
                    const provider = String(ins.providerName ?? raw.provider_name ?? 'Provider');
                    const policyNo = String(ins.policyNumber ?? raw.policy_number ?? '—');
                    const coverage = String(ins.coverageType ?? raw.coverage_type ?? 'Standard');
                    const validUntil = String(ins.validUntil ?? raw.valid_until ?? 'Active');
                    const isPrimary = Boolean(ins.isPrimary ?? raw.is_primary ?? false);

                    return (
                      <div
                        key={`pat-ins-${insId}`}
                        style={{
                          padding: '12px 16px',
                          borderRadius: 8,
                          border: isPrimary ? '1.5px solid var(--primary)' : '1px solid var(--card-border)',
                          background: isPrimary ? 'rgba(59,130,246,0.03)' : 'var(--card-bg)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>{provider}</span>
                            {isPrimary ? (
                              <Badge variant="success">Primary</Badge>
                            ) : (
                              <Badge variant="muted">Secondary</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted" style={{ marginTop: 2 }}>
                            Policy: <strong>{policyNo}</strong> · Type: {coverage} · Valid: {validUntil}
                          </p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {!isPrimary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={Star}
                              onClick={() => handleSetPrimaryInsurance(ins)}
                              style={{ color: 'var(--primary)' }}
                            >
                              Set Primary
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEditInsurance(ins)}>
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDeleteInsurance(ins)}
                            style={{ color: 'var(--danger-text)' }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: MEDICAL HISTORY ── */}
          {activeTab === 'medical' && (
            <div className="space-y-4" style={{ paddingTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 className="font-semibold text-sm" style={{ margin: 0 }}>Medical History</h4>
                  <p className="text-xs text-muted" style={{ margin: 0, marginTop: 2 }}>
                    Patient allergies, medical background, and current medications on file.
                  </p>
                </div>
                <Button size="sm" loading={savingMedicalInfo} onClick={handleSaveMedicalInfo}>
                  Save Changes
                </Button>
              </div>

              {medicalInfoSaveSuccess && (
                <div style={{ padding: '8px 14px', borderRadius: 8, background: '#d1fae5', color: '#065f46', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Check size={15} />
                  Medical information saved successfully!
                </div>
              )}

              {loadingMedicalInfo ? (
                <Spinner center />
              ) : (
                <div className="space-y-4">
                  <div className="form-group">
                    <label className="form-label">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={13} style={{ color: 'var(--primary)' }} />
                        Allergies
                      </span>
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="List any known allergies (e.g. Penicillin, Peanuts, Latex, Ibuprofen)…"
                      value={medicalInfoForm.allergies}
                      onChange={(e) => setMedicalInfoForm((p) => ({ ...p, allergies: e.target.value }))}
                    />
                    <p className="text-xs text-muted" style={{ marginTop: 4 }}>Separate multiple allergies with commas.</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Eye size={13} style={{ color: 'var(--primary)' }} />
                        Medical History
                      </span>
                    </label>
                    <textarea
                      className="form-input"
                      rows={5}
                      placeholder="Past illnesses, surgeries, chronic conditions, hospitalizations, family history…"
                      value={medicalInfoForm.medicalHistory}
                      onChange={(e) => setMedicalInfoForm((p) => ({ ...p, medicalHistory: e.target.value }))}
                    />
                    <p className="text-xs text-muted" style={{ marginTop: 4 }}>Include all clinically relevant history.</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={13} style={{ color: 'var(--primary)' }} />
                        Current Medications
                      </span>
                    </label>
                    <textarea
                      className="form-input"
                      rows={3}
                      placeholder="List all active medications, dosage, and frequency (e.g. Metformin 500mg twice daily)…"
                      value={medicalInfoForm.medications}
                      onChange={(e) => setMedicalInfoForm((p) => ({ ...p, medications: e.target.value }))}
                    />
                    <p className="text-xs text-muted" style={{ marginTop: 4 }}>Include prescriptions and OTC medications.</p>
                  </div>

                  {!patientMedicalInfo && (
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
                      No medical information on record yet. Fill in the fields above and click &ldquo;Save Changes&rdquo; to create the record.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </AppLayout>
  );
}
