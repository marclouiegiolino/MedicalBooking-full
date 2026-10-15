'use client';
import { useEffect, useState, useRef } from 'react';
import { Users, Plus, Search, Edit, Trash2, Shield, Camera, Upload } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import dynamic from 'next/dynamic';

const PhotoCropModal = dynamic(() => import('@/components/ui/PhotoCropModal'), {
  ssr: false,
  loading: () => null,
});
import { userApi, userManApi, authApi } from '@/lib/api';
import type { UserManResponse } from '@/lib/types';

const ROLE_LABELS: Record<number, string> = { 1: 'Admin', 2: 'Staff', 3: 'User' };
const ROLE_VARIANT: Record<number, 'danger' | 'warning' | 'info'> = { 1: 'danger', 2: 'warning', 3: 'info' };

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserManResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserManResponse | null>(null);
  const [form, setForm] = useState({ username: '', password: '', roleId: 3 });
  const [saving, setSaving] = useState(false);
  const [uploadingUserPhoto, setUploadingUserPhoto] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    userManApi
      .getAll()
      .then((r) => setUsers(extractList<UserManResponse>(r.data)))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setForm({ username: '', password: '', roleId: 3 });
    setModal(true);
  };

  const handleOpenEdit = (user: UserManResponse) => {
    const raw = user as unknown as Record<string, unknown>;
    const name = String(user.userName || raw.user_name || '');
    const roleId = Number(user.userRoleId || raw.user_role_id || 3);
    setEditingUser(user);
    setForm({ username: name, password: '', roleId });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.username) {
      alert('Username is required.');
      return;
    }
    if (!editingUser && !form.password) {
      alert('Password is required when creating a new user.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const raw = editingUser as unknown as Record<string, unknown>;
        const id = Number(editingUser.userId || raw.user_id || 0);
        await userManApi.update(id, {
          user_id: id,
          userId: id,
          user_name: form.username,
          userName: form.username,
          user_role_id: form.roleId,
          userRoleId: form.roleId,
          role_id: form.roleId,
          roleId: form.roleId,
          ...(form.password ? { user_pass: form.password, userPass: form.password, newPassword: form.password } : {}),
        });
      } else {
        await authApi.register({ username: form.username, password: form.password, roleId: form.roleId });
      }
      setModal(false);
      setForm({ username: '', password: '', roleId: 3 });
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string }; status?: number } };
      if (e?.response?.status === 409) alert('Username already exists.');
      else alert('Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const handleAdminPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingUser) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
  };

  const handleCropSave = async (blob: Blob) => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    if (!editingUser) return;

    const raw = editingUser as unknown as Record<string, unknown>;
    const id = Number(editingUser.userId || raw.user_id || 0);
    if (!id) return;

    setUploadingUserPhoto(true);
    try {
      const croppedFile = new File([blob], 'profile.jpg', { type: 'image/jpeg' });
      const res = await userApi.uploadProfilePictureForUser(id, croppedFile);
      const newPic = res.data.profilePicturePath || (res.data as Record<string, unknown>).profile_picture_path as string;
      setEditingUser((prev) => prev ? { ...prev, profilePicturePath: newPic } : prev);
      load();
    } catch {
      alert('Failed to upload user photo.');
    } finally {
      setUploadingUserPhoto(false);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete user "${name}"? This action cannot be undone.`)) return;
    try {
      await userManApi.delete(id);
      load();
    } catch {
      alert('Failed to delete user.');
    }
  };

  const filtered = users.filter((u) => {
    const raw = u as unknown as Record<string, unknown>;
    const name = String((u.userName as string) || (raw.user_name as string) || '');
    return name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Hidden File Input for Admin User Photo Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleAdminPhotoUpload}
        />

        <div className="page-header">
          <div>
            <h1 className="page-title">User Management</h1>
            <p className="page-subtitle">Manage user accounts, roles, and access credentials</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add User
          </Button>
        </div>

        <div className="table-search" style={{ maxWidth: 360 }}>
          <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
          <input
            placeholder="Search by username…"
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
                  <th>User</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>GUID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, index) => {
                  const raw = u as unknown as Record<string, unknown>;
                  const id = Number(u.userId || raw.user_id || index + 1);
                  const name = String((u.userName as string) || (raw.user_name as string) || `user_${id}`);
                  const roleId = Number(u.userRoleId || raw.user_role_id || 3);
                  const guid = String(u.guid || raw.guid || '');
                  const pic = String(u.profilePicturePath || raw.profile_picture_path || '');

                  return (
                    <tr key={`usr-row-${id}-${index}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar initials={name.slice(0, 2).toUpperCase()} src={pic} size="sm" />
                          <span className="font-medium text-sm">{name}</span>
                        </div>
                      </td>
                      <td className="text-sm text-muted">@{name}</td>
                      <td>
                        <Badge variant={ROLE_VARIANT[roleId] ?? 'muted'}>
                          <Shield size={10} style={{ marginRight: 3 }} />
                          {ROLE_LABELS[roleId] ?? `Role ${roleId}`}
                        </Badge>
                      </td>
                      <td className="text-xs text-muted" style={{ fontFamily: 'monospace' }}>
                        {guid ? `${guid.slice(0, 8)}…` : '—'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(u)}>
                            Edit
                          </Button>
                          <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(id, name)}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* User Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editingUser ? 'Edit User' : 'Add New User'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button loading={saving} onClick={handleSave}>
              {editingUser ? 'Update User' : 'Create User'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editingUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 12, borderBottom: '1px solid var(--card-border)' }}>
              <Avatar
                initials={form.username.slice(0, 2).toUpperCase()}
                src={editingUser.profilePicturePath || (editingUser as unknown as Record<string, unknown>).profile_picture_path as string}
                size="lg"
              />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Profile Picture</p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Upload}
                  loading={uploadingUserPhoto}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ marginTop: 6 }}
                >
                  Change User Photo
                </Button>
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Username *</label>
            <input
              className="form-input"
              placeholder="e.g., john_doe"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">
              Password {editingUser ? '(Leave blank to keep unchanged)' : '*'}
            </label>
            <input
              type="password"
              className="form-input"
              placeholder={editingUser ? 'New password (optional)' : 'At least 6 characters'}
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-input"
              value={form.roleId}
              onChange={(e) => setForm((p) => ({ ...p, roleId: Number(e.target.value) }))}
            >
              <option value={1}>Admin</option>
              <option value={2}>Staff</option>
              <option value={3}>User</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Photo Crop Modal */}
      {cropSrc && (
        <PhotoCropModal
          imageSrc={cropSrc}
          onSave={handleCropSave}
          onClose={handleCropCancel}
          title="Adjust User Profile Photo"
        />
      )}
    </AppLayout>
  );
}
