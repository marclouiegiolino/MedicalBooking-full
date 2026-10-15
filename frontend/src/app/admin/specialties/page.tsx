'use client';
import { useEffect, useState } from 'react';
import { ClipboardList, Plus, Edit, Trash2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { specialtyApi } from '@/lib/api';
import type { Specialty } from '@/lib/types';

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminSpecialtiesPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Specialty | null>(null);
  const [form, setForm] = useState({ specialtyName: '' });

  const load = () => {
    setLoading(true);
    specialtyApi
      .getAll()
      .then((r) => setSpecialties(extractList<Specialty>(r.data)))
      .catch(() => setSpecialties([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ specialtyName: '' });
    setModal(true);
  };

  const handleOpenEdit = (spec: Specialty) => {
    const raw = spec as unknown as Record<string, unknown>;
    const name = String((raw.specialty_name as string) || spec.specialtyName || (raw.name as string) || '');
    setEditingItem(spec);
    setForm({ specialtyName: name });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.specialtyName) {
      alert('Specialty name required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        specialty_name: form.specialtyName,
        specialtyName: form.specialtyName,
      };

      if (editingItem) {
        const raw = editingItem as unknown as Record<string, unknown>;
        const id = Number(editingItem.specialtyId || raw.specialty_id || 0);
        await specialtyApi.update(id, payload);
      } else {
        await specialtyApi.create(payload);
      }
      setModal(false);
      setForm({ specialtyName: '' });
      load();
    } catch {
      alert('Failed to save specialty.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this specialty?')) return;
    try {
      await specialtyApi.delete(id);
      load();
    } catch {
      alert('Could not delete specialty.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Medical Specialties</h1>
            <p className="page-subtitle">{specialties.length} specialties</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Specialty
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
                  <th>Specialty Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {specialties.map((s, index) => {
                  const raw = s as unknown as Record<string, unknown>;
                  const id = Number(s.specialtyId || raw.specialty_id || index + 1);
                  const name =
                    (raw.specialty_name as string) ||
                    (s.specialtyName as string) ||
                    (raw.name as string) ||
                    `Specialty #${id}`;

                  return (
                    <tr key={`spec-row-${id}-${index}`}>
                      <td className="text-sm text-muted">#{id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: '#ede9fe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ClipboardList size={14} style={{ color: '#7c3aed' }} />
                          </div>
                          <span className="font-medium text-sm">{name}</span>
                        </div>
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
                {specialties.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No specialties yet.
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
        title={editingItem ? 'Edit Specialty' : 'Add Specialty'}
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
            <label className="form-label">Specialty Name *</label>
            <input
              className="form-input"
              placeholder="e.g., Cardiology"
              value={form.specialtyName}
              onChange={(e) => setForm({ specialtyName: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
