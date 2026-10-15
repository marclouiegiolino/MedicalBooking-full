'use client';
import { useEffect, useState } from 'react';
import { Calendar, Plus, Edit, Trash2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { appointmentTypeApi } from '@/lib/api';

interface ApptTypeItem {
  appointmentTypeId?: number;
  appointment_type_id?: number;
  appointmentName?: string;
  appointment_name?: string;
  typeName?: string;
  type_name?: string;
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

export default function AdminAppointmentTypesPage() {
  const [types, setTypes] = useState<ApptTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ApptTypeItem | null>(null);
  const [form, setForm] = useState({ name: '' });

  const load = () => {
    setLoading(true);
    appointmentTypeApi
      .getAll()
      .then((r) => setTypes(extractList<ApptTypeItem>(r.data)))
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setForm({ name: '' });
    setModal(true);
  };

  const handleOpenEdit = (item: ApptTypeItem) => {
    setEditingItem(item);
    const currentName = item.appointmentName || item.appointment_name || item.typeName || item.type_name || '';
    setForm({ name: currentName });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      alert('Appointment type name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        appointment_name: form.name,
        appointmentName: form.name,
        type_name: form.name,
        typeName: form.name,
      };

      if (editingItem) {
        const id = Number(editingItem.appointmentTypeId || editingItem.appointment_type_id || 0);
        await appointmentTypeApi.update(id, payload);
      } else {
        await appointmentTypeApi.create(payload);
      }
      setModal(false);
      setForm({ name: '' });
      load();
    } catch {
      alert('Failed to save appointment type.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this appointment type?')) return;
    try {
      await appointmentTypeApi.delete(id);
      load();
    } catch {
      alert('Could not delete appointment type.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Appointment Types</h1>
            <p className="page-subtitle">{types.length} configured appointment types</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Type
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
                  <th>Appointment Type Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t, index) => {
                  const id = Number(t.appointmentTypeId || t.appointment_type_id || index + 1);
                  const name = t.appointmentName || t.appointment_name || t.typeName || t.type_name || `Type #${id}`;

                  return (
                    <tr key={`appt-type-${id}-${index}`}>
                      <td className="text-sm text-muted">#{id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: '#e0f2fe',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Calendar size={14} style={{ color: '#0284c7' }} />
                          </div>
                          <span className="font-medium text-sm">{name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(t)}>
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
                {types.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No appointment types configured.
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
        title={editingItem ? 'Edit Appointment Type' : 'Add Appointment Type'}
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
            <label className="form-label">Type Name *</label>
            <input
              className="form-input"
              placeholder="e.g., General Consultation, Follow-up Visit"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
