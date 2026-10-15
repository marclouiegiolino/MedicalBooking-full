'use client';
import { useEffect, useState, useRef } from 'react';
import { Building2, Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Globe, Clock, ShieldCheck, Loader2 } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import { hospitalInformationApi } from '@/lib/api';
import type { HospitalInformation } from '@/lib/types';
import { geocodeAddress } from '@/lib/osm';
import PhilippineAddressSelector from '@/components/ui/PhilippineAddressSelector';

export default function AdminHospitalInfoPage() {
  const [hospitals, setHospitals] = useState<HospitalInformation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [editingHospital, setEditingHospital] = useState<HospitalInformation | null>(null);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const geocodeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [geoNotice, setGeoNotice] = useState<{
    type: 'success' | 'error' | 'loading' | null;
    text: string;
  }>({ type: null, text: '' });

  const [form, setForm] = useState<{
    hospitalName: string;
    address: string;
    phoneNumber: string;
    email: string;
    logoPath: string;
    latitude: string;
    longitude: string;
    serviceRadius: string;
  }>({
    hospitalName: '',
    address: '',
    phoneNumber: '',
    email: '',
    logoPath: '',
    latitude: '',
    longitude: '',
    serviceRadius: '',
  });

  // Automatically geocode address on change
  const runGeocode = async (addrToLookup: string) => {
    const q = addrToLookup.trim();
    if (!q || q.length < 3) return;
    setGeocoding(true);
    setGeoNotice({ type: 'loading', text: 'Detecting coordinates via OpenStreetMap…' });
    try {
      const res = await geocodeAddress(q);
      if (res.found && res.latitude !== undefined && res.longitude !== undefined) {
        setForm((p) => ({
          ...p,
          latitude: res.latitude!.toString(),
          longitude: res.longitude!.toString(),
        }));
        setGeoNotice({
          type: 'success',
          text: `Coordinates automatically set: ${res.latitude.toFixed(5)}, ${res.longitude.toFixed(5)} (${res.displayName})`,
        });
      } else {
        setGeoNotice({
          type: 'error',
          text: 'Address not found on OpenStreetMap. You can enter latitude & longitude manually below.',
        });
      }
    } catch {
      setGeoNotice({
        type: 'error',
        text: 'Failed to look up address. Please check your connection or enter manually.',
      });
    } finally {
      setGeocoding(false);
    }
  };

  const load = () => {
    setLoading(true);
    hospitalInformationApi
      .getAll()
      .then((res) => {
        const data = res?.data;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.data)
          ? data.data
          : [];
        setHospitals(list);
      })
      .catch((err) => console.error('Error loading hospital information:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingHospital(null);
    setForm({
      hospitalName: '',
      address: '',
      phoneNumber: '',
      email: '',
      logoPath: '',
      latitude: '',
      longitude: '',
      serviceRadius: '',
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setModal(true);
  };

  const handleOpenEdit = (hospital: HospitalInformation) => {
    const raw = hospital as unknown as Record<string, unknown>;
    const lat = Number(hospital.latitude ?? raw.latitude ?? 0);
    const lng = Number(hospital.longitude ?? raw.longitude ?? 0);
    const addr = String(hospital.address ?? raw.address ?? '');

    setEditingHospital(hospital);
    setGeoNotice({ type: null, text: '' });
    setForm({
      hospitalName: String(hospital.hospitalName ?? raw.hospital_name ?? ''),
      address: addr,
      phoneNumber: String(hospital.phoneNumber ?? raw.phone_number ?? ''),
      email: String(hospital.email ?? raw.email ?? ''),
      logoPath: String(hospital.logoPath ?? raw.logo_path ?? ''),
      latitude: lat !== 0 ? String(lat) : '',
      longitude: lng !== 0 ? String(lng) : '',
      serviceRadius: String(hospital.serviceRadius ?? raw.service_radius ?? ''),
    });
    setModal(true);

    // If this hospital has no coordinates yet, auto-geocode the saved address
    if ((lat === 0 || lng === 0) && addr.trim().length >= 4) {
      setTimeout(() => runGeocode(addr), 300);
    }
  };

  const handleSave = async () => {
    if (!form.hospitalName.trim()) {
      alert('Hospital name is required.');
      return;
    }

    setSaving(true);
    const payload = {
      hospitalName: form.hospitalName.trim(),
      hospital_name: form.hospitalName.trim(),
      address: form.address.trim(),
      phoneNumber: form.phoneNumber.trim(),
      phone_number: form.phoneNumber.trim(),
      email: form.email.trim(),
      logoPath: form.logoPath.trim(),
      logo_path: form.logoPath.trim(),
      latitude: form.latitude ? parseFloat(form.latitude) : 0,
      longitude: form.longitude ? parseFloat(form.longitude) : 0,
      serviceRadius: form.serviceRadius ? parseFloat(form.serviceRadius) : 0,
      service_radius: form.serviceRadius ? parseFloat(form.serviceRadius) : 0,
    };

    try {
      if (editingHospital) {
        const raw = editingHospital as unknown as Record<string, number>;
        const hid = Number(editingHospital.hospitalId ?? raw.hospital_id);
        await hospitalInformationApi.update(hid, {
          hospitalId: hid,
          hospital_id: hid,
          ...payload,
        });
      } else {
        await hospitalInformationApi.create(payload);
      }
      setModal(false);
      resetForm();
      load();
    } catch (err) {
      console.error('Failed to save hospital info:', err);
      alert(editingHospital ? 'Failed to update hospital.' : 'Failed to create hospital.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this hospital record?')) return;
    try {
      await hospitalInformationApi.delete(id);
      load();
    } catch {
      alert('Could not delete hospital record.');
    }
  };

  const filtered = hospitals.filter((h) => {
    const raw = h as unknown as Record<string, unknown>;
    const name = String(h.hospitalName ?? raw.hospital_name ?? '').toLowerCase();
    const addr = String(h.address ?? raw.address ?? '').toLowerCase();
    const mail = String(h.email ?? raw.email ?? '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || addr.includes(q) || mail.includes(q);
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Hospital Information</h1>
            <p className="page-subtitle">{hospitals.length} registered hospital facilities & branches</p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Hospital
          </Button>
        </div>

        <div className="search-bar" style={{ maxWidth: 400 }}>
          <Search size={15} style={{ color: 'var(--muted)' }} />
          <input
            placeholder="Search hospitals by name, address, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Cards summary for quick view */}
        {!loading && filtered.length > 0 && (
          <div className="grid-3" style={{ gap: 16 }}>
            {filtered.map((h, idx) => {
              const raw = h as unknown as Record<string, unknown>;
              const hid = Number(h.hospitalId ?? raw.hospital_id ?? idx);
              const name = String(h.hospitalName ?? raw.hospital_name ?? 'Hospital');
              const addr = String(h.address ?? raw.address ?? 'No address specified');
              const phone = String(h.phoneNumber ?? raw.phone_number ?? 'No phone');
              const email = String(h.email ?? raw.email ?? 'No email');
              const logo = String(h.logoPath ?? raw.logo_path ?? '');

              return (
                <Card key={`hosp-card-${hid}`} className="card-p" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {logo ? (
                          <img
                            src={logo}
                            alt={name}
                            style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--card-border)' }}
                          />
                        ) : (
                          <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 8,
                            background: 'var(--primary-light, rgba(37,99,235,0.1))',
                            color: 'var(--primary, #2563eb)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 16
                          }}>
                            <Building2 size={22} />
                          </div>
                        )}
                        <div>
                          <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>{name}</h3>
                          <span className="text-xs text-muted">ID: #{hid}</span>
                        </div>
                      </div>
                      <Badge variant="success">Active Facility</Badge>
                    </div>

                    <div className="space-y-2" style={{ marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <MapPin size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{addr}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Phone size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                        <span>{phone}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Mail size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
                      </div>
                      {(Number(h.latitude ?? raw.latitude ?? 0) !== 0) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Globe size={14} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                          <span style={{ fontFamily: 'monospace', fontSize: 11 }}>
                            {Number(h.latitude ?? raw.latitude).toFixed(5)}, {Number(h.longitude ?? raw.longitude).toFixed(5)}
                            {Number(h.serviceRadius ?? raw.service_radius ?? 0) > 0
                              ? ` · ${Number(h.serviceRadius ?? raw.service_radius)} km radius`
                              : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--card-border)' }}>
                    <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(h)} style={{ flex: 1 }}>
                      Edit
                    </Button>
                    <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(hid)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Detailed Table view */}
        <Card>
          {loading ? (
            <Spinner center />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hospital / Facility</th>
                  <th>Address</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Updated At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, index) => {
                  const raw = h as unknown as Record<string, unknown>;
                  const hid = Number(h.hospitalId ?? raw.hospital_id ?? index);
                  const name = String(h.hospitalName ?? raw.hospital_name ?? '');
                  const addr = String(h.address ?? raw.address ?? '—');
                  const phone = String(h.phoneNumber ?? raw.phone_number ?? '—');
                  const email = String(h.email ?? raw.email ?? '—');
                  const updatedAt = String(h.updatedAt ?? raw.updated_at ?? '—');

                  return (
                    <tr key={`hosp-row-${hid}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32,
                            height: 32,
                            borderRadius: 6,
                            background: 'rgba(37,99,235,0.08)',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Building2 size={16} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{name}</p>
                            <span className="text-xs text-muted">ID: #{hid}</span>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-muted">{addr}</td>
                      <td className="text-sm font-medium">{phone}</td>
                      <td className="text-sm text-muted">{email}</td>
                      <td className="text-xs text-muted">{updatedAt}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button variant="ghost" size="sm" icon={Edit} onClick={() => handleOpenEdit(h)}>
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={Trash2}
                            onClick={() => handleDelete(hid)}
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
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)' }}>
                      No hospital records found. Click &quot;Add Hospital&quot; to create one.
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
        title={editingHospital ? 'Edit Hospital Information' : 'Add Hospital Information'}
        subtitle={
          editingHospital
            ? 'Update facility details, contact info, and logo.'
            : 'Fill in the details below to register a hospital facility.'
        }
        maxWidth={640}
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
              {editingHospital ? 'Update Hospital' : 'Create Hospital'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Hospital Name *</label>
            <input
              className="form-input"
              placeholder="e.g. St. Jude General Hospital"
              value={form.hospitalName}
              onChange={(e) => setForm((p) => ({ ...p, hospitalName: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <PhilippineAddressSelector
              value={form.address}
              onChange={(val) => {
                setForm((p) => ({ ...p, address: val }));
                if (geocodeTimerRef.current) clearTimeout(geocodeTimerRef.current);
                if (val.trim().length >= 4) {
                  geocodeTimerRef.current = setTimeout(() => {
                    runGeocode(val);
                  }, 600);
                }
              }}
              label="Hospital Address (Philippines)"
              required={false}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => runGeocode(form.address)}
                disabled={geocoding || !form.address.trim()}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 12,
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: geocoding || !form.address.trim() ? 'not-allowed' : 'pointer',
                  opacity: geocoding || !form.address.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {geocoding ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                Auto-Detect Coordinates
              </button>
            </div>
            {geoNotice.type && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background:
                    geoNotice.type === 'success'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : geoNotice.type === 'loading'
                      ? 'var(--accent)'
                      : 'rgba(239, 68, 68, 0.1)',
                  color:
                    geoNotice.type === 'success'
                      ? '#10b981'
                      : geoNotice.type === 'loading'
                      ? 'var(--primary)'
                      : 'var(--danger-text)',
                  border: `1px solid ${
                    geoNotice.type === 'success'
                      ? 'rgba(16, 185, 129, 0.25)'
                      : geoNotice.type === 'loading'
                      ? 'var(--card-border)'
                      : 'rgba(239, 68, 68, 0.25)'
                  }`,
                }}
              >
                {geoNotice.type === 'loading' && <Loader2 size={13} className="animate-spin" />}
                {geoNotice.type === 'success' && <span>✓</span>}
                {geoNotice.type === 'error' && <span>⚠️</span>}
                <span>{geoNotice.text}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                className="form-input"
                placeholder="e.g. (02) 8123-4567"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                placeholder="e.g. contact@stjudehospital.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Logo Path / Image URL</label>
            <input
              className="form-input"
              placeholder="e.g. /images/hospitals/st-jude.png or https://..."
              value={form.logoPath}
              onChange={(e) => setForm((p) => ({ ...p, logoPath: e.target.value }))}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                📍 Location Coordinates (OpenStreetMap)
              </p>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>Auto-filled from address</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  placeholder="e.g. 14.5995"
                  value={form.latitude}
                  onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input
                  className="form-input"
                  type="number"
                  step="any"
                  placeholder="e.g. 120.9842"
                  value={form.longitude}
                  onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 10 }}>
              <label className="form-label">Service Radius (km)</label>
              <input
                className="form-input"
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 10 (hospitals visible within 10 km of patient)"
                value={form.serviceRadius}
                onChange={(e) => setForm((p) => ({ ...p, serviceRadius: e.target.value }))}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Tip: As you type the address above, OpenStreetMap automatically calculates the exact latitude and longitude.
            </p>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
