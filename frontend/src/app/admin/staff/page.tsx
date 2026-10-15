'use client';
import { useEffect, useState } from 'react';
import { UserCheck, Plus, Search, Edit, Trash2, Shield, Building2, Briefcase, User as UserIcon } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { staffApi, departmentApi, jobRoleApi, userManApi } from '@/lib/api';
import type { Staff, Department, JobRole, UserManResponse } from '@/lib/types';

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminStaffPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [users, setUsers] = useState<UserManResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState<number | 'all'>('all');
  const [filterRole, setFilterRole] = useState<number | 'all'>('all');
  const [modal, setModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    userId: 0,
    accessId: 2, // 2 = Staff
    roleId: 0,
    departmentId: 0,
    employeeNo: '',
    firstName: '',
    middleName: '',
    lastName: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      staffApi.getAll(),
      departmentApi.getAll(),
      jobRoleApi.getAll(),
      userManApi.getAll(),
    ])
      .then(([stRes, depRes, roleRes, userRes]) => {
        setStaffList(extractList<Staff>(stRes.data));
        setDepartments(extractList<Department>(depRes.data));
        setJobRoles(extractList<JobRole>(roleRes.data));
        setUsers(extractList<UserManResponse>(userRes.data));
      })
      .catch((err) => console.error('Failed to load staff management data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setEditingStaff(null);
    setForm({
      userId: 0,
      accessId: 2,
      roleId: jobRoles[0] ? Number(jobRoles[0].roleId || jobRoles[0].role_id) : 0,
      departmentId: 0,
      employeeNo: '',
      firstName: '',
      middleName: '',
      lastName: '',
    });
    setModal(true);
  };

  const handleOpenEdit = (staff: Staff) => {
    setEditingStaff(staff);
    const raw = staff as unknown as Record<string, unknown>;
    setForm({
      userId: Number(staff.userId || raw.user_id || 0),
      accessId: Number(staff.accessId || raw.access_id || 2),
      roleId: Number(staff.roleId || raw.role_id || raw.job_role_id || 0),
      departmentId: Number(staff.departmentId || raw.department_id || 0),
      employeeNo: String(staff.employeeNo || raw.employee_no || ''),
      firstName: String(staff.firstName || raw.first_name || ''),
      middleName: String(staff.middleName || raw.middle_name || ''),
      lastName: String(staff.lastName || raw.last_name || ''),
    });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.userId) {
      alert('Please select a user account for this staff member.');
      return;
    }
    if (!form.roleId) {
      alert('Please select a job role.');
      return;
    }
    if (!form.firstName.trim() || !form.lastName.trim()) {
      alert('First name and Last name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: form.userId,
        userId: form.userId,
        access_id: form.accessId,
        accessId: form.accessId,
        job_role_id: form.roleId,
        role_id: form.roleId,
        roleId: form.roleId,
        department_id: form.departmentId > 0 ? form.departmentId : null,
        departmentId: form.departmentId > 0 ? form.departmentId : null,
        employee_no: form.employeeNo.trim(),
        employeeNo: form.employeeNo.trim(),
        first_name: form.firstName.trim(),
        firstName: form.firstName.trim(),
        middle_name: form.middleName.trim(),
        middleName: form.middleName.trim(),
        last_name: form.lastName.trim(),
        lastName: form.lastName.trim(),
      };

      if (editingStaff) {
        const raw = editingStaff as unknown as Record<string, unknown>;
        const id = Number(editingStaff.staffId || raw.staff_id || 0);
        await staffApi.update(id, payload);
      } else {
        await staffApi.create(payload);
      }
      setModal(false);
      load();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: string } })?.response?.data || 'Failed to save staff member.';
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    try {
      await staffApi.delete(id);
      load();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: string } })?.response?.data || 'Could not delete staff member.';
      alert(errorMsg);
    }
  };

  // Maps for quick lookup
  const deptMap = new Map<number, string>();
  departments.forEach((d) => {
    const raw = d as unknown as Record<string, unknown>;
    const id = Number(d.departmentId || raw.department_id || 0);
    const name = String(d.departmentName || raw.department_name || '');
    deptMap.set(id, name);
  });

  const roleMap = new Map<number, string>();
  jobRoles.forEach((r) => {
    const raw = r as unknown as Record<string, unknown>;
    const id = Number(r.roleId || raw.role_id || 0);
    const name = String(r.roleName || raw.role_name || '');
    roleMap.set(id, name);
  });

  const userMap = new Map<number, string>();
  users.forEach((u) => {
    const raw = u as unknown as Record<string, unknown>;
    const id = Number(u.userId || raw.user_id || 0);
    const name = String(u.userName || raw.username || raw.user_name || '');
    userMap.set(id, name);
  });

  const filteredStaff = staffList.filter((s) => {
    const raw = s as unknown as Record<string, unknown>;
    const fName = String(s.firstName || raw.first_name || '');
    const lName = String(s.lastName || raw.last_name || '');
    const empNo = String(s.employeeNo || raw.employee_no || '');
    const fullName = `${fName} ${lName}`.toLowerCase();
    const uId = Number(s.userId || raw.user_id || 0);
    const username = (userMap.get(uId) || '').toLowerCase();
    const roleIdVal = Number(s.roleId || raw.role_id || raw.job_role_id || 0);
    const roleName = (roleMap.get(roleIdVal) || '').toLowerCase();
    const deptIdVal = Number(s.departmentId || raw.department_id || 0);

    const matchesSearch =
      fullName.includes(search.toLowerCase()) ||
      empNo.toLowerCase().includes(search.toLowerCase()) ||
      username.includes(search.toLowerCase()) ||
      roleName.includes(search.toLowerCase());

    const matchesDept = filterDepartment === 'all' || deptIdVal === filterDepartment;
    const matchesRole = filterRole === 'all' || roleIdVal === filterRole;

    return matchesSearch && matchesDept && matchesRole;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Staff Management</h1>
            <p className="page-subtitle">{staffList.length} staff members across departments</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Staff Member
          </Button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="search-bar" style={{ maxWidth: 300 }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search staff, emp #, username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 180 }}
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All Departments</option>
            {departments.map((d) => {
              const raw = d as unknown as Record<string, unknown>;
              const id = Number(d.departmentId || raw.department_id);
              const name = String(d.departmentName || raw.department_name);
              return (
                <option key={`dept-opt-${id}`} value={id}>
                  {name}
                </option>
              );
            })}
          </select>

          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 180 }}
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          >
            <option value="all">All Job Roles</option>
            {jobRoles.map((r) => {
              const raw = r as unknown as Record<string, unknown>;
              const id = Number(r.roleId || raw.role_id);
              const name = String(r.roleName || raw.role_name);
              return (
                <option key={`role-opt-${id}`} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </div>

        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Employee #</th>
                    <th>Job Role</th>
                    <th>Department</th>
                    <th>User Account</th>
                    <th>Access Level</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((s, index) => {
                    const raw = s as unknown as Record<string, unknown>;
                    const id = Number(s.staffId || raw.staff_id || index + 1);
                    const fName = String(s.firstName || raw.first_name || '');
                    const mName = String(s.middleName || raw.middle_name || '');
                    const lName = String(s.lastName || raw.last_name || '');
                    const fullName = [fName, mName, lName].filter(Boolean).join(' ') || `Staff #${id}`;
                    const empNo = String(s.employeeNo || raw.employee_no || '—');
                    const roleIdVal = Number(s.roleId || raw.role_id || raw.job_role_id || 0);
                    const roleName = roleMap.get(roleIdVal) || `Role #${roleIdVal}`;
                    const deptIdVal = Number(s.departmentId || raw.department_id || 0);
                    const deptName = deptIdVal > 0 ? (deptMap.get(deptIdVal) || `Dept #${deptIdVal}`) : 'General / None';
                    const uId = Number(s.userId || raw.user_id || 0);
                    const username = userMap.get(uId) || `User #${uId}`;
                    const accessIdVal = Number(s.accessId || raw.access_id || 2);
                    const accessLabel = accessIdVal === 1 ? 'Admin' : accessIdVal === 2 ? 'Staff' : 'User';

                    const initials = `${fName[0] || ''}${lName[0] || ''}`.toUpperCase() || 'ST';

                    const pic = String(s.profilePicturePath || raw.profile_picture_path || '');

                    return (
                      <tr key={`staff-row-${id}-${index}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar
                              initials={initials}
                              src={pic}
                              size="sm"
                              zoomable={true}
                              title={fullName}
                              subtitle={`Employee #${empNo}`}
                            />
                            <div>
                              <p className="font-medium text-sm" style={{ margin: 0 }}>
                                {fullName}
                              </p>
                              <span className="text-xs text-muted">ID: #{id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm font-medium" style={{ fontFamily: 'monospace' }}>
                            {empNo}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Briefcase size={14} style={{ color: 'var(--primary)' }} />
                            <span className="text-sm font-medium">{roleName}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Building2 size={14} style={{ color: 'var(--muted)' }} />
                            <span className="text-sm">{deptName}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <UserIcon size={14} style={{ color: 'var(--muted)' }} />
                            <span className="text-sm text-muted">@{username}</span>
                          </div>
                        </td>
                        <td>
                          <Badge variant={accessIdVal === 1 ? 'danger' : 'info'}>
                            {accessLabel}
                          </Badge>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(s)}>
                              Edit
                            </Button>
                            <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(id)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStaff.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        {search || filterDepartment !== 'all' || filterRole !== 'all'
                          ? 'No staff members match the selected filters.'
                          : 'No staff members registered yet.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingStaff ? 'Update Staff' : 'Create Staff'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editingStaff && (() => {
            const raw = editingStaff as unknown as Record<string, unknown>;
            const fName = String(editingStaff.firstName || raw.first_name || form.firstName || '');
            const lName = String(editingStaff.lastName || raw.last_name || form.lastName || '');
            const fullName = `${fName} ${lName}`.trim() || 'Staff Member';
            const initials = `${fName[0] || 'S'}${lName[0] || ''}`.toUpperCase();
            const pic = String(editingStaff.profilePicturePath || raw.profile_picture_path || '');
            const currentRole = jobRoles.find(r => Number(r.roleId || (r as any).role_id) === form.roleId);
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
                  marginBottom: 8,
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
                    title={fullName}
                    subtitle={currentRole?.roleName || 'Staff'}
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
                      {fullName}
                    </h3>
                    <Badge variant="info">Staff</Badge>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                    {currentRole?.roleName || 'Staff Member'} {currentDept?.departmentName ? `· ${currentDept.departmentName}` : ''}
                  </p>
                  {form.employeeNo && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--foreground)', fontFamily: 'monospace', fontWeight: 600 }}>
                      EMP: {form.employeeNo}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="form-group">
            <label className="form-label">User Account *</label>
            <select
              className="form-input"
              value={form.userId}
              onChange={(e) => setForm({ ...form, userId: Number(e.target.value) })}
            >
              <option value={0}>Select a user account...</option>
              {users.map((u) => {
                const raw = u as unknown as Record<string, unknown>;
                const id = Number(u.userId || raw.user_id);
                const name = String(u.userName || raw.username || raw.user_name);
                return (
                  <option key={`modal-user-${id}`} value={id}>
                    #{id} - {name}
                  </option>
                );
              })}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Job Role *</label>
              <select
                className="form-input"
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: Number(e.target.value) })}
              >
                <option value={0}>Select job role...</option>
                {jobRoles.map((r) => {
                  const raw = r as unknown as Record<string, unknown>;
                  const id = Number(r.roleId || raw.role_id);
                  const name = String(r.roleName || raw.role_name);
                  return (
                    <option key={`modal-role-${id}`} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Department (Optional)</label>
              <select
                className="form-input"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: Number(e.target.value) })}
              >
                <option value={0}>None / General</option>
                {departments.map((d) => {
                  const raw = d as unknown as Record<string, unknown>;
                  const id = Number(d.departmentId || raw.department_id);
                  const name = String(d.departmentName || raw.department_name);
                  return (
                    <option key={`modal-dept-${id}`} value={id}>
                      {name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Access Level</label>
              <select
                className="form-input"
                value={form.accessId}
                onChange={(e) => setForm({ ...form, accessId: Number(e.target.value) })}
              >
                <option value={2}>Staff (Access ID 2)</option>
                <option value={1}>Admin (Access ID 1)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Employee Number</label>
              <input
                className="form-input"
                placeholder="e.g., EMP-1042"
                value={form.employeeNo}
                onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                className="form-input"
                placeholder="First name"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Middle Name</label>
              <input
                className="form-input"
                placeholder="Middle name"
                value={form.middleName}
                onChange={(e) => setForm({ ...form, middleName: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                className="form-input"
                placeholder="Last name"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
