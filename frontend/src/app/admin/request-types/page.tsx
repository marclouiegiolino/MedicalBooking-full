'use client';
import { useEffect, useState } from 'react';
import { FileText, Plus, Edit, Trash2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { requestTypeApi } from '@/lib/api';

interface ReqTypeItem {
  requestTypeId?: number;
  request_type_id?: number;
  requestName?: string;
  request_name?: string;
  requestTypeName?: string;
  request_type_name?: string;
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

export default function AdminRequestTypesPage() {
  const [types, setTypes] = useState<ReqTypeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ReqTypeItem | null>(null);
  const [form, setForm] = useState({ name: '' });

  const load = () => {
    setLoading(true);
    requestTypeApi
      .getAll()
      .then((r) => setTypes(extractList<ReqTypeItem>(r.data)))
      .catch((err) => {
        console.error('Failed to fetch request types:', err);
        setTypes([]);
      })
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

  const handleOpenEdit = (item: ReqTypeItem) => {
    setEditingItem(item);
    const currentName =
      item.requestName ||
      item.request_name ||
      item.requestTypeName ||
      item.request_type_name ||
      item.typeName ||
      item.type_name ||
      '';
    setForm({ name: currentName });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      alert('Request type name is required.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        request_name: form.name,
        requestName: form.name,
        request_type_name: form.name,
        requestTypeName: form.name,
        type_name: form.name,
        typeName: form.name,
      };

      if (editingItem) {
        const id = Number(editingItem.requestTypeId || editingItem.request_type_id || 0);
        await requestTypeApi.update(id, payload);
      } else {
        await requestTypeApi.create(payload);
      }
      setModal(false);
      setForm({ name: '' });
      load();
    } catch {
      alert('Failed to save request type.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this request type?')) return;
    try {
      await requestTypeApi.delete(id);
      load();
    } catch {
      alert('Could not delete request type.');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Medical Request Types</h1>
            <p className="page-subtitle">{types.length} request types configured</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Request Type
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
                  <th>Request Type Name</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {types.map((t, index) => {
                  const id = Number(t.requestTypeId || t.request_type_id || index + 1);
                  const name =
                    t.requestName ||
                    t.request_name ||
                    t.requestTypeName ||
                    t.request_type_name ||
                    t.typeName ||
                    t.type_name ||
                    `Request Type #${id}`;

                  return (
                    <tr key={`req-type-${id}-${index}`}>
                      <td className="text-sm text-muted">#{id}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 8,
                              background: '#fef3c7',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FileText size={14} style={{ color: '#d97706' }} />
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
                      No request types configured.
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
        title={editingItem ? 'Edit Request Type' : 'Add Request Type'}
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
              placeholder="e.g., Lab Test, X-Ray, Prescription Refill"
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
            />
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
