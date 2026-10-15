'use client';
import { useEffect, useState } from 'react';
import { Shield, Plus, Edit, Trash2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { userRoleApi } from '@/lib/api';

interface RoleItem {
  userRoleId?: number;
  user_role_id?: number;
  roleId?: number;
  role_id?: number;
  userRole?: string;
  user_role?: string;
  roleName?: string;
  role_name?: string;
}

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<RoleItem | null>(null);
  const [form, setForm] = useState({ roleName: '' });

  const load = () => {
    setLoading(true);
    userRoleApi
      .getAll()
      .then((r) => setRoles(extractList<RoleItem>(r.data)))
      .catch(() => setRoles([]))
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

  const handleOpenEdit = (item: RoleItem) => {
    setEditingItem(item);
    const currentName = item.roleName || item.role_name || item.userRole || item.user_role || '';
    setForm({ roleName: currentName });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.roleName) {
      alert('Role name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        role_name: form.roleName,
        roleName: form.roleName,
        user_role: form.roleName,
        userRole: form.roleName,
      };

      if (editingItem) {
        const id = Number(
          editingItem.userRoleId ||
            editingItem.user_role_id ||
            editingItem.roleId ||
            editingItem.role_id ||
            0
        );
        await userRoleApi.update(id, payload);
      } else {
        await userRoleApi.create(payload);
      }
      setModal(false);
      setForm({ roleName: '' });
      load();
    } catch {
      alert('Failed to save role.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this user role?')) return;
    try {
      await userRoleApi.delete(id);
      load();
    } catch {
      alert('Could not delete role.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">User Roles & Permissions</h1>
            <p className="page-subtitle">{roles.length} system roles</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Role
          </Button>
        </div>

        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role ID</th>
                  <th>Role Name</th>
                  <th>Badge Preview</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r, index) => {
                  const id = Number(
                    r.userRoleId || r.user_role_id || r.roleId || r.role_id || index + 1
                  );
                  const name = r.roleName || r.role_name || r.userRole || r.user_role || `Role #${id}`;

                  const variant = id === 1 ? 'danger' : id === 2 ? 'warning' : 'info';

                  return (
                    <tr key={`role-row-${id}-${index}`}>
                      <td className="text-sm text-muted">#{id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Shield size={16} style={{ color: 'var(--primary)' }} />
                          <span className="font-medium text-sm">{name}</span>
                        </div>
                      </td>
                      <td>
                        <Badge variant={variant}>{name}</Badge>
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
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No roles configured.
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
        title={editingItem ? 'Edit Role' : 'Add Role'}
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
            <label className="form-label">Role Name *</label>
            <input
              className="form-input"
              placeholder="e.g., Administrator, Doctor, Patient, Nurse"
              value={form.roleName}
              onChange={(e) => setForm({ roleName: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
