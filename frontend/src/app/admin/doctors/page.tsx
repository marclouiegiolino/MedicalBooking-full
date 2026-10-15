'use client';
import { useEffect, useState } from 'react';
import { Stethoscope, Plus, Search, Edit, Trash2, UserCheck, Building2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { doctorApi, departmentApi, specialtyApi, userManApi, hospitalInformationApi } from '@/lib/api';
import type { Doctor, Department, Specialty, UserManResponse, HospitalInformation } from '@/lib/types';

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [hospitals, setHospitals] = useState<HospitalInformation[]>([]);
  const [users, setUsers] = useState<UserManResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    userId: number;
    departmentId: number;
    specialtyId: number;
    hospitalId: number;
    firstName: string;
    middleName: string;
    lastName: string;
    licenseNumber: string;
    consultationFee: number | string;
  }>({
    userId: 0,
    departmentId: 0,
    specialtyId: 0,
    hospitalId: 0,
    firstName: '',
    middleName: '',
    lastName: '',
    licenseNumber: '',
    consultationFee: 0,
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      doctorApi.getAll(),
      departmentApi.getAll(),
      specialtyApi.getAll(),
      userManApi.getAll(),
      hospitalInformationApi.getAll().catch(() => ({ data: [] })),
    ])
      .then(([dr, dep, sp, usr, hosp]) => {
        const drData = dr?.data;
        const drList = Array.isArray(drData)
          ? drData
          : Array.isArray(drData?.items)
          ? drData.items
          : Array.isArray(drData?.data)
          ? drData.data
          : Array.isArray(drData?.doctors)
          ? drData.doctors
          : [];

        const depData = dep?.data;
        const depList = Array.isArray(depData)
          ? depData
          : Array.isArray(depData?.items)
          ? depData.items
          : [];

        const spData = sp?.data;
        const spList = Array.isArray(spData)
          ? spData
          : Array.isArray(spData?.items)
          ? spData.items
          : [];

        const usrData = usr?.data;
        const usrList = Array.isArray(usrData)
          ? usrData
          : Array.isArray(usrData?.items)
          ? usrData.items
          : [];

        const hospData = hosp?.data;
        const hospList = Array.isArray(hospData)
          ? hospData
          : Array.isArray(hospData?.items)
          ? hospData.items
          : Array.isArray(hospData?.data)
          ? hospData.data
          : [];

        setDoctors(drList);
        setDepartments(depList);
        setSpecialties(spList);
        setUsers(usrList);
        setHospitals(hospList);
      })
      .catch((err) => console.error('Error loading doctor data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingDoctor(null);
    setForm({
      userId: 0,
      departmentId: 0,
      specialtyId: 0,
      hospitalId: 0,
      firstName: '',
      middleName: '',
      lastName: '',
      licenseNumber: '',
      consultationFee: 0,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setModal(true);
  };

  const handleOpenEdit = (doctor: Doctor) => {
    const raw = doctor as unknown as Record<string, unknown>;
    const feeVal = doctor.consultationFee ?? raw.consultation_fee ?? 0;
    setEditingDoctor(doctor);
    setForm({
      userId: Number(doctor.userId ?? raw.user_id ?? 0),
      departmentId: Number(doctor.departmentId ?? raw.department_id ?? 0),
      specialtyId: Number(doctor.specialtyId ?? raw.specialty_id ?? 0),
      hospitalId: Number(doctor.hospitalId ?? raw.hospital_id ?? 0),
      firstName: String(doctor.firstName ?? raw.first_name ?? ''),
      middleName: String(doctor.middleName ?? raw.middle_name ?? ''),
      lastName: String(doctor.lastName ?? raw.last_name ?? ''),
      licenseNumber: String(doctor.licenseNumber ?? raw.license_number ?? ''),
      consultationFee: String(feeVal),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.departmentId || !form.specialtyId) {
      alert('First name, last name, department, and specialty are required.');
      return;
    }
    setSaving(true);
    const numericFee = parseFloat(String(form.consultationFee)) || 0;
    const targetUserId = form.userId > 0 ? form.userId : null;
    const targetHospitalId = form.hospitalId > 0 ? form.hospitalId : 0;
    const payload = {
      ...form,
      userId: targetUserId,
      user_id: targetUserId,
      hospitalId: targetHospitalId,
      hospital_id: targetHospitalId,
      consultationFee: numericFee,
      consultation_fee: numericFee,
    };

    try {
      if (editingDoctor) {
        const docId = Number(editingDoctor.doctorId ?? (editingDoctor as unknown as Record<string, number>).doctor_id);
        await doctorApi.update(docId, {
          doctorId: docId,
          doctor_id: docId,
          ...payload,
        });
      } else {
        await doctorApi.create(payload);
      }
      setModal(false);
      resetForm();
      load();
    } catch (err) {
      console.error('Failed to save doctor:', err);
      alert(editingDoctor ? 'Failed to update doctor.' : 'Failed to create doctor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this doctor?')) return;
    try {
      await doctorApi.delete(id);
      load();
    } catch {
      alert('Could not delete doctor.');
    }
  };

  const filtered = doctors.filter((d) => {
    const raw = d as unknown as Record<string, unknown>;
    const fname = String(d.firstName ?? raw.first_name ?? '');
    const lname = String(d.lastName ?? raw.last_name ?? '');
    const fullName = `${fname} ${lname}`.toLowerCase();
    return search ? fullName.includes(search.toLowerCase()) : true;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Manage Doctors</h1>
            <p className="page-subtitle">{doctors.length} registered doctors</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Doctor
          </Button>
        </div>

        <div className="search-bar" style={{ maxWidth: 400 }}>
          <Search size={15} style={{ color: 'var(--muted)' }} />
          <input
            placeholder="Search doctors…"
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
                  <th>Doctor</th>
                  <th>Department</th>
                  <th>Specialty</th>
                  <th>Hospital</th>
                  <th>Linked User</th>
                  <th>License</th>
                  <th>Fee</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, index) => {
                  const rawDoc = d as unknown as Record<string, unknown>;
                  const doctorId = Number(d.doctorId ?? rawDoc.doctor_id ?? index);
                  const deptId = Number(d.departmentId ?? rawDoc.department_id);
                  const specId = Number(d.specialtyId ?? rawDoc.specialty_id);
                  const hospId = Number(d.hospitalId ?? rawDoc.hospital_id ?? 0);
                  const linkedUserId = Number(d.userId ?? rawDoc.user_id);
                  const firstName = String(d.firstName ?? rawDoc.first_name ?? '');
                  const middleName = String(d.middleName ?? rawDoc.middle_name ?? '');
                  const lastName = String(d.lastName ?? rawDoc.last_name ?? '');
                  const licenseNumber = String(d.licenseNumber ?? rawDoc.license_number ?? '');
                  const consultationFee = Number(d.consultationFee ?? rawDoc.consultation_fee ?? 0);

                  const dept = departments.find((dep) => {
                    const rawDep = dep as unknown as Record<string, unknown>;
                    return Number(dep.departmentId ?? rawDep.department_id) === deptId;
                  });

                  const spec = specialties.find((sp) => {
                    const rawSp = sp as unknown as Record<string, unknown>;
                    return Number(sp.specialtyId ?? rawSp.specialty_id) === specId;
                  });

                  const hosp = hospitals.find((h) => {
                    const rawH = h as unknown as Record<string, unknown>;
                    return Number(h.hospitalId ?? rawH.hospital_id) === hospId;
                  });

                  const linkedUser = users.find((u) => {
                    const rawUsr = u as unknown as Record<string, unknown>;
                    return Number(u.userId ?? rawUsr.user_id) === linkedUserId;
                  });

                  const deptName = (dept as unknown as Record<string, string>)?.departmentName ?? (dept as unknown as Record<string, string>)?.department_name;
                  const specName = (spec as unknown as Record<string, string>)?.specialtyName ?? (spec as unknown as Record<string, string>)?.specialty_name;
                  const hospName = (hosp as unknown as Record<string, string>)?.hospitalName ?? (hosp as unknown as Record<string, string>)?.hospital_name;
                  const linkedUserName = (linkedUser as unknown as Record<string, string>)?.userName ?? (linkedUser as unknown as Record<string, string>)?.user_name;

                  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
                  const initials = `${firstName[0] ?? 'D'}${lastName[0] ?? ''}`;
                  const pic = String(d.profilePicturePath || rawDoc.profile_picture_path || '');

                  return (
                    <tr key={`doc-row-${doctorId || index}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar
                            initials={initials}
                            src={pic}
                            size="sm"
                            zoomable={true}
                            title={`Dr. ${fullName}`}
                            subtitle={specName || deptName}
                          />
                          <div>
                            <p className="font-medium text-sm">Dr. {fullName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{deptName ?? (deptId ? `#${deptId}` : '—')}</td>
                      <td className="text-sm text-muted">{specName ?? (specId ? `#${specId}` : '—')}</td>
                      <td className="text-sm text-muted">
                        {hospName ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <Building2 size={13} style={{ color: 'var(--primary)' }} />
                            <span>{hospName}</span>
                          </div>
                        ) : hospId ? (
                          `#${hospId}`
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {linkedUser ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
                            <UserCheck size={14} style={{ color: 'var(--primary)' }} />
                            <span className="font-medium">@{linkedUserName}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">Unlinked</span>
                        )}
                      </td>
                      <td className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                        {licenseNumber || '—'}
                      </td>
                      <td className="text-sm font-medium">
                        ₱{consultationFee.toFixed(2)}
                      </td>
                      <td>
                        <Badge variant="success">Active</Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(d)}>
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(doctorId)}
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
                    <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No doctors found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Modal
        open={modal}
        onClose={() => {
          setModal(false);
          resetForm();
        }}
        title={editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
        subtitle={
          editingDoctor
            ? 'Update doctor profile and API fields.'
            : 'Fill in the details below to add a new doctor.'
        }
        maxWidth={580}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingDoctor ? 'Update Doctor' : 'Create Doctor'}
            </Button>
          </>
        }
      >
        {editingDoctor && (() => {
          const raw = editingDoctor as unknown as Record<string, unknown>;
          const fName = String(editingDoctor.firstName || raw.first_name || form.firstName || '');
          const lName = String(editingDoctor.lastName || raw.last_name || form.lastName || '');
          const fullName = `${fName} ${lName}`.trim() || 'Doctor';
          const initials = `${fName[0] || 'D'}${lName[0] || ''}`.toUpperCase();
          const pic = String(editingDoctor.profilePicturePath || raw.profile_picture_path || '');
          const currentSpec = specialties.find(s => Number(s.specialtyId || (s as any).specialty_id) === form.specialtyId);
          const currentDept = departments.find(d => Number(d.departmentId || (d as any).department_id) === form.departmentId);

          return (
            <div
              style={{
                background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(59, 130, 246, 0.04) 50%, var(--accent) 100%)',
                border: '1px solid var(--card-border)',
                borderRadius: 'calc(var(--radius) + 2px)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  position: 'relative',
                  borderRadius: '16px',
                  padding: 3,
                  background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 50%, rgba(59, 130, 246, 0.3) 100%)',
                  boxShadow: '0 8px 24px -4px rgba(37, 99, 235, 0.28), 0 2px 6px rgba(0, 0, 0, 0.08)',
                  flexShrink: 0,
                }}
              >
                <Avatar
                  initials={initials}
                  src={pic}
                  shape="portrait"
                  size="portrait-md"
                  zoomable={true}
                  title={`Dr. ${fullName}`}
                  subtitle={currentSpec?.specialtyName || 'Doctor'}
                  style={{
                    width: 96,
                    height: 128,
                    fontSize: 34,
                    fontWeight: 700,
                    border: '3px solid var(--card-bg, #ffffff)',
                    borderRadius: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--foreground)' }}>
                    Dr. {fullName}
                  </h3>
                  <Badge variant="info">Doctor</Badge>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                  {currentSpec?.specialtyName || 'Medical Specialist'} {currentDept?.departmentName ? `· ${currentDept.departmentName}` : ''}
                </p>
                {form.licenseNumber && (
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--foreground)', fontFamily: 'monospace', fontWeight: 600 }}>
                    License: {form.licenseNumber}
                  </p>
                )}
              </div>
            </div>
          );
        })()}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">First Name *</label>
            <input
              className="form-input"
              placeholder="John"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Middle Name</label>
            <input
              className="form-input"
              placeholder="M."
              value={form.middleName}
              onChange={(e) => setForm((p) => ({ ...p, middleName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Last Name *</label>
            <input
              className="form-input"
              placeholder="Doe"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Linked User Account</label>
            <select
              className="form-input"
              value={form.userId}
              onChange={(e) => setForm((p) => ({ ...p, userId: Number(e.target.value) }))}
            >
              <option key="usr-default" value={0}>
                No linked user (Standalone doctor record)
              </option>
              {users.map((u, idx) => {
                const rawUsr = u as unknown as Record<string, unknown>;
                const id = Number(u.userId ?? rawUsr.user_id ?? idx);
                const uname = String(u.userName ?? rawUsr.user_name ?? `user_${id}`);
                const roleId = Number(u.userRoleId ?? rawUsr.user_role_id ?? 0);
                const roleName = roleId === 1 ? 'Admin' : roleId === 2 ? 'Staff' : 'User';

                return (
                  <option key={`usr-opt-${id || idx}`} value={id}>
                    {uname} ({roleName})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Hospital / Facility Affiliation</label>
            <select
              className="form-input"
              value={form.hospitalId}
              onChange={(e) => setForm((p) => ({ ...p, hospitalId: Number(e.target.value) }))}
            >
              <option key="hosp-default" value={0}>
                No hospital specified (or General Hospital)
              </option>
              {hospitals.map((h, idx) => {
                const rawH = h as unknown as Record<string, unknown>;
                const id = Number(h.hospitalId ?? rawH.hospital_id ?? idx);
                const name = String(h.hospitalName ?? rawH.hospital_name ?? `Hospital #${id}`);
                const addr = String(h.address ?? rawH.address ?? '');
                return (
                  <option key={`hosp-opt-${id || idx}`} value={id}>
                    {name} {addr ? `(${addr})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Department *</label>
            <select
              className="form-input"
              value={form.departmentId}
              onChange={(e) => setForm((p) => ({ ...p, departmentId: Number(e.target.value) }))}
            >
              <option key="dept-default" value={0}>
                Select department…
              </option>
              {departments.map((d, idx) => {
                const rawDep = d as unknown as Record<string, unknown>;
                const id = Number(d.departmentId ?? rawDep.department_id ?? idx);
                const name = String(d.departmentName ?? rawDep.department_name ?? 'General Department');
                return (
                  <option key={`dept-opt-${id || idx}`} value={id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Specialty *</label>
            <select
              className="form-input"
              value={form.specialtyId}
              onChange={(e) => setForm((p) => ({ ...p, specialtyId: Number(e.target.value) }))}
            >
              <option key="spec-default" value={0}>
                Select specialty…
              </option>
              {specialties.map((s, idx) => {
                const rawSp = s as unknown as Record<string, unknown>;
                const id = Number(s.specialtyId ?? rawSp.specialty_id ?? idx);
                const name = String(s.specialtyName ?? rawSp.specialty_name ?? 'General Specialty');
                return (
                  <option key={`spec-opt-${id || idx}`} value={id}>
                    {name}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">License Number</label>
            <input
              className="form-input"
              placeholder="PRC-12345"
              value={form.licenseNumber}
              onChange={(e) => setForm((p) => ({ ...p, licenseNumber: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Consultation Fee (₱)</label>
            <input
              type="text"
              inputMode="decimal"
              className="form-input"
              placeholder="500.00"
              value={form.consultationFee ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, consultationFee: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
