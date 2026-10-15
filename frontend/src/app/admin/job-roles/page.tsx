'use client';
import { useEffect, useState } from 'react';
import { Briefcase, Plus, Edit, Trash2, Search } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { jobRoleApi } from '@/lib/api';
import type { JobRole } from '@/lib/types';

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminJobRolesPage() {
  const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<JobRole | null>(null);
  const [form, setForm] = useState({ roleName: '' });

  const load = () => {
    setLoading(true);
    jobRoleApi
      .getAll()
      .then((r) => setJobRoles(extractList<JobRole>(r.data)))
      .catch(() => setJobRoles([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ roleName: '' });
    setModal(true);
  };

  const handleOpenEdit = (item: JobRole) => {
    setEditingItem(item);
    const currentName = item.roleName || item.role_name || '';
    setForm({ roleName: currentName });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.roleName.trim()) {
      alert('Job role name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        role_name: form.roleName.trim(),
        roleName: form.roleName.trim(),
      };

      if (editingItem) {
        const id = Number(editingItem.roleId || editingItem.role_id || 0);
        await jobRoleApi.update(id, payload);
      } else {
        await jobRoleApi.create(payload);
      }
      setModal(false);
      setForm({ roleName: '' });
      load();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: string } })?.response?.data || 'Failed to save job role.';
      alert(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this job role?')) return;
    try {
      await jobRoleApi.delete(id);
      load();
    } catch (err: unknown) {
      const errorMsg = (err as { response?: { data?: string } })?.response?.data || 'Could not delete job role.';
      alert(errorMsg);
    }
  };

  const filteredRoles = jobRoles.filter((r) => {
    const name = r.roleName || r.role_name || '';
    return name.toLowerCase().includes(search.toLowerCase()) || String(r.roleId || r.role_id).includes(search);
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Job Roles</h1>
            <p className="page-subtitle">{jobRoles.length} staff positions & job titles</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Job Role
          </Button>
        </div>

        {/* Search */}
        <div style={{ maxWidth: 360 }}>
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search job roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role ID</th>
                  <th>Job Title / Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((r, index) => {
                  const id = Number(r.roleId || r.role_id || index + 1);
                  const name = r.roleName || r.role_name || `Role #${id}`;

                  return (
                    <tr key={`jobrole-row-${id}-${index}`}>
                      <td className="text-sm text-muted">#{id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: 'var(--accent)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Briefcase size={15} style={{ color: 'var(--primary)' }} />
                          </div>
                          <span className="font-medium text-sm">{name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(r)}>
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
                {filteredRoles.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      {search ? 'No job roles match your search.' : 'No job roles configured yet.'}
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
        onClose={() => setModal(false)}
        title={editingItem ? 'Edit Job Role' : 'Add Job Role'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingItem ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Job Role Title *</label>
            <input
              className="form-input"
              placeholder="e.g., Nurse, Receptionist, Lab Technician, Pharmacist, Medical Director"
              value={form.roleName}
              onChange={(e) => setForm({ roleName: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
