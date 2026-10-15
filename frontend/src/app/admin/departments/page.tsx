'use client';
import { useEffect, useState } from 'react';
import { Building2, Plus, Edit, Trash2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { departmentApi } from '@/lib/api';
import type { Department } from '@/lib/types';

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Department | null>(null);
  const [form, setForm] = useState({ departmentName: '' });

  const load = () => {
    setLoading(true);
    departmentApi
      .getAll()
      .then((r) => setDepartments(extractList<Department>(r.data)))
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ departmentName: '' });
    setModal(true);
  };

  const handleOpenEdit = (dept: Department) => {
    const raw = dept as unknown as Record<string, unknown>;
    const name = String((raw.department_name as string) || dept.departmentName || (raw.name as string) || '');
    setEditingItem(dept);
    setForm({ departmentName: name });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.departmentName) {
      alert('Department name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        department_name: form.departmentName,
        departmentName: form.departmentName,
      };

      if (editingItem) {
        const raw = editingItem as unknown as Record<string, unknown>;
        const id = Number(editingItem.departmentId || raw.department_id || 0);
        await departmentApi.update(id, payload);
      } else {
        await departmentApi.create(payload);
      }
      setModal(false);
      setForm({ departmentName: '' });
      load();
    } catch {
      alert('Failed to save department.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this department?')) return;
    try {
      await departmentApi.delete(id);
      load();
    } catch {
      alert('Could not delete department.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Departments</h1>
            <p className="page-subtitle">{departments.length} departments</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Department
          </Button>
        </div>

        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Department Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d, index) => {
                  const raw = d as unknown as Record<string, unknown>;
                  const id = Number(d.departmentId || raw.department_id || index + 1);
                  const name =
                    (raw.department_name as string) ||
                    (d.departmentName as string) ||
                    (raw.name as string) ||
                    `Department #${id}`;

                  return (
                    <tr key={`dept-row-${id}-${index}`}>
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
                            <Building2 size={14} style={{ color: 'var(--primary)' }} />
                          </div>
                          <span className="font-medium text-sm">{name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(d)}>
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
                {departments.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No departments yet.
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
        title={editingItem ? 'Edit Department' : 'Add Department'}
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
            <label className="form-label">Department Name *</label>
            <input
              className="form-input"
              placeholder="e.g., Cardiology"
              value={form.departmentName}
              onChange={(e) => setForm({ departmentName: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
