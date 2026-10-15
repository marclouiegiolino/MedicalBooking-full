'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Star, Plus, Search, Edit, Trash2, Filter, AlertCircle,
  CheckCircle2, Stethoscope, User, Calendar
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';
import StatCard from '@/components/ui/StatCard';
import { reviewApi, doctorApi, patientApi, specialtyApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Review, Doctor, Patients, Specialty } from '@/lib/types';

function extractList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export default function AdminReviewsPage() {
  const { isAdmin } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<Patients[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterDoctor, setFilterDoctor] = useState<number | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const [form, setForm] = useState<{
    doctorId: number;
    patientId: number;
    rating: number;
    comment: string;
  }>({
    doctorId: 0,
    patientId: 0,
    rating: 5,
    comment: '',
  });
  const [hoverRating, setHoverRating] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, docRes, patRes, specRes] = await Promise.allSettled([
        reviewApi.getAll().catch(() => ({ data: [] })),
        doctorApi.getAll().catch(() => ({ data: [] })),
        patientApi.getAll().catch(() => ({ data: [] })),
        specialtyApi.getAll().catch(() => ({ data: [] })),
      ]);

      if (revRes.status === 'fulfilled') {
        setReviews(extractList<Review>(revRes.value?.data));
      }
      if (docRes.status === 'fulfilled') {
        setDoctors(extractList<Doctor>(docRes.value?.data));
      }
      if (patRes.status === 'fulfilled') {
        setPatients(extractList<Patients>(patRes.value?.data));
      }
      if (specRes.status === 'fulfilled') {
        setSpecialties(extractList<Specialty>(specRes.value?.data));
      }
    } catch (err) {
      console.error('Failed to load reviews data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helpers to resolve entity names
  const getDoctor = (doctorId: number) => {
    return doctors.find(d => {
      const raw = d as unknown as Record<string, unknown>;
      return Number(d.doctorId || raw.doctor_id || 0) === doctorId;
    });
  };

  const getDoctorName = (doctorId: number) => {
    const d = getDoctor(doctorId);
    if (!d) return `Doctor #${doctorId}`;
    const raw = d as unknown as Record<string, unknown>;
    const fName = String(d.firstName || raw.first_name || '');
    const lName = String(d.lastName || raw.last_name || '');
    return `Dr. ${fName} ${lName}`.trim() || `Doctor #${doctorId}`;
  };

  const getDoctorSpecialty = (doctorId: number) => {
    const d = getDoctor(doctorId);
    if (!d) return 'General Practice';
    const raw = d as unknown as Record<string, unknown>;
    const sId = Number(d.specialtyId || raw.specialty_id || 0);
    const sName = String(d.specialtyName || raw.specialty_name || '');
    if (sName) return sName;
    const spec = specialties.find(s => Number(s.specialtyId || (s as any).specialty_id || 0) === sId);
    return spec ? String(spec.specialtyName || (spec as any).specialty_name || '') : 'General Practice';
  };

  const getPatient = (patientId: number) => {
    return patients.find(p => {
      const raw = p as unknown as Record<string, unknown>;
      return Number(p.patientId || raw.patient_id || 0) === patientId;
    });
  };

  const getPatientName = (patientId: number) => {
    const p = getPatient(patientId);
    if (!p) return `Patient #${patientId}`;
    const raw = p as unknown as Record<string, unknown>;
    const fName = String(p.firstName || raw.first_name || '');
    const lName = String(p.lastName || raw.last_name || '');
    return `${fName} ${lName}`.trim() || `Patient #${patientId}`;
  };

  // Metrics
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((sum, r) => sum + Number(r.rating || (r as any).rating || 0), 0) / totalReviews)
    : 0;
  const fiveStarCount = reviews.filter(r => Number(r.rating || (r as any).rating || 0) === 5).length;
  const lowRatingCount = reviews.filter(r => Number(r.rating || (r as any).rating || 0) <= 2).length;

  // Filtered reviews
  const filteredReviews = reviews.filter(r => {
    const raw = r as unknown as Record<string, unknown>;
    const docId = Number(r.doctorId || raw.doctor_id || 0);
    const patId = Number(r.patientId || raw.patient_id || 0);
    const rating = Number(r.rating || raw.rating || 0);
    const comment = String(r.comment || raw.comment || '').toLowerCase();

    const docName = getDoctorName(docId).toLowerCase();
    const patName = getPatientName(patId).toLowerCase();

    const matchesSearch = !search.trim() ||
      docName.includes(search.toLowerCase()) ||
      patName.includes(search.toLowerCase()) ||
      comment.includes(search.toLowerCase());

    const matchesRating = filterRating === null || rating === filterRating;
    const matchesDoctor = filterDoctor === null || docId === filterDoctor;

    return matchesSearch && matchesRating && matchesDoctor;
  });

  const handleOpenCreate = () => {
    setEditingReview(null);
    setForm({
      doctorId: doctors.length > 0 ? Number(doctors[0].doctorId || (doctors[0] as any).doctor_id || 0) : 0,
      patientId: patients.length > 0 ? Number(patients[0].patientId || (patients[0] as any).patient_id || 0) : 0,
      rating: 5,
      comment: '',
    });
    setFormError('');
    setFormSuccess('');
    setModalOpen(true);
  };

  const handleOpenEdit = (r: Review) => {
    const raw = r as unknown as Record<string, unknown>;
    setEditingReview(r);
    setForm({
      doctorId: Number(r.doctorId || raw.doctor_id || 0),
      patientId: Number(r.patientId || raw.patient_id || 0),
      rating: Number(r.rating || raw.rating || 5),
      comment: String(r.comment || raw.comment || ''),
    });
    setFormError('');
    setFormSuccess('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.doctorId || form.doctorId <= 0) {
      setFormError('Please select a doctor.');
      return;
    }
    if (!form.patientId || form.patientId <= 0) {
      setFormError('Please select a patient.');
      return;
    }
    if (!form.rating || form.rating < 1 || form.rating > 5) {
      setFormError('Rating must be between 1 and 5.');
      return;
    }
    if (!form.comment.trim()) {
      setFormError('Comment cannot be empty.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingReview) {
        const raw = editingReview as unknown as Record<string, unknown>;
        const revId = Number(editingReview.reviewId || raw.review_id || 0);
        await reviewApi.update(revId, {
          review_id: revId,
          doctor_id: form.doctorId,
          patient_id: form.patientId,
          rating: form.rating,
          comment: form.comment.trim(),
        });
        setFormSuccess('Review updated successfully.');
      } else {
        await reviewApi.create({
          doctor_id: form.doctorId,
          patient_id: form.patientId,
          rating: form.rating,
          comment: form.comment.trim(),
        });
        setFormSuccess('Review created successfully.');
      }

      setTimeout(() => {
        setModalOpen(false);
        loadData();
      }, 600);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to save review.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await reviewApi.delete(id);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to delete review.');
    }
  };

  const ratingLabels = ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Manage Reviews</h1>
            <p className="page-subtitle">
              Monitor, moderate, and manage patient reviews across all doctors and departments.
            </p>
          </div>
          <Button icon={Plus} onClick={handleOpenCreate}>
            Add Review
          </Button>
        </div>

        {/* Metrics Overview */}
        <div className="grid-4" style={{ gap: 14 }}>
          <StatCard
            label="Total Reviews"
            value={totalReviews}
            icon={Star}
            sub="All doctor feedback"
          />
          <StatCard
            label="Average Rating"
            value={`${avgRating.toFixed(2)} / 5.0`}
            icon={Star}
            sub="Across all departments"
          />
          <StatCard
            label="5-Star Ratings"
            value={fiveStarCount}
            icon={CheckCircle2}
            sub={`${totalReviews > 0 ? ((fiveStarCount / totalReviews) * 100).toFixed(0) : 0}% of all reviews`}
          />
          <StatCard
            label="Low Ratings (≤2★)"
            value={lowRatingCount}
            icon={AlertCircle}
            sub="Needs attention"
          />
        </div>

        {/* Search & Filters */}
        <Card className="card-p">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-bar" style={{ flex: '1 1 240px', maxWidth: 360 }}>
              <Search size={15} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <input
                placeholder="Search by doctor, patient, or comment…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Doctor Filter */}
            <select
              className="input"
              style={{ flex: '0 1 200px', height: 38 }}
              value={filterDoctor ?? ''}
              onChange={(e) => setFilterDoctor(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">All Doctors</option>
              {doctors.map((d, idx) => {
                const raw = d as unknown as Record<string, unknown>;
                const did = Number(d.doctorId || raw.doctor_id || 0);
                const name = getDoctorName(did);
                return (
                  <option key={`doc-opt-${did}-${idx}`} value={did}>
                    {name}
                  </option>
                );
              })}
            </select>

            {/* Rating Filter Chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                className={`filter-chip ${filterRating === null ? 'active' : ''}`}
                onClick={() => setFilterRating(null)}
              >
                All Ratings
              </button>
              {[5, 4, 3, 2, 1].map((stars) => (
                <button
                  key={stars}
                  className={`filter-chip ${filterRating === stars ? 'active' : ''}`}
                  onClick={() => setFilterRating(stars)}
                >
                  {stars} ★
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Reviews Table / List */}
        {loading ? (
          <Spinner center />
        ) : filteredReviews.length === 0 ? (
          <Card>
            <div className="empty-state">
              <div className="empty-state-icon">
                <Star size={24} />
              </div>
              <p className="empty-state-title">No reviews found</p>
              <p className="empty-state-desc">
                {search || filterRating !== null || filterDoctor !== null
                  ? 'Try adjusting your search query or filters.'
                  : 'No reviews have been created yet.'}
              </p>
              <div style={{ marginTop: 14 }}>
                <Button icon={Plus} onClick={handleOpenCreate}>
                  Create First Review
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Patient</th>
                    <th>Rating</th>
                    <th>Feedback / Comment</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.map((r, idx) => {
                    const raw = r as unknown as Record<string, unknown>;
                    const revId = Number(r.reviewId || raw.review_id || 0);
                    const docId = Number(r.doctorId || raw.doctor_id || 0);
                    const patId = Number(r.patientId || raw.patient_id || 0);
                    const rating = Number(r.rating || raw.rating || 5);
                    const comment = String(r.comment || raw.comment || '');
                    const date = String(r.createdAt || raw.created_at || '—');

                    const docName = getDoctorName(docId);
                    const docSpec = getDoctorSpecialty(docId);
                    const patName = getPatientName(patId);

                    return (
                      <tr key={`rev-row-${revId}-${idx}`}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar initials={docName.replace('Dr. ', '').slice(0, 2).toUpperCase()} size="sm" />
                            <div>
                              <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                                {docName}
                              </p>
                              <p className="text-xs text-muted">{docSpec}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Avatar initials={patName.slice(0, 2).toUpperCase()} size="sm" />
                            <span className="text-sm font-medium">{patName}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                size={12}
                                style={{
                                  color: '#f59e0b',
                                  fill: i < rating ? '#f59e0b' : 'transparent',
                                }}
                              />
                            ))}
                            <span className="text-xs font-semibold" style={{ marginLeft: 4 }}>
                              {rating}.0
                            </span>
                          </div>
                        </td>
                        <td style={{ maxWidth: 320 }}>
                          <p
                            className="text-sm text-muted"
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'normal',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.5,
                            }}
                          >
                            {comment}
                          </p>
                        </td>
                        <td>
                          <span className="text-xs text-muted">
                            {date.includes('T') ? date.split('T')[0] : date}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 8px' }}
                              title="Edit Review"
                              onClick={() => handleOpenEdit(r)}
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px' }}
                              title="Delete Review"
                              onClick={() => handleDelete(revId)}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Create / Edit Modal */}
        {modalOpen && (
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title={editingReview ? 'Edit Review (Admin Override)' : 'Add New Review (Admin)'}
          >
            <div className="space-y-4">
              {formError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, background: 'var(--danger-bg)', color: 'var(--danger-text)', fontSize: 13 }}>
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}
              {formSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 8, background: 'var(--success-bg)', color: 'var(--success-text)', fontSize: 13 }}>
                  <CheckCircle2 size={15} />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Select Doctor */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Doctor <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={form.doctorId}
                  onChange={(e) => setForm({ ...form, doctorId: Number(e.target.value) })}
                >
                  <option value={0}>-- Select Doctor --</option>
                  {doctors.map((d, idx) => {
                    const raw = d as unknown as Record<string, unknown>;
                    const did = Number(d.doctorId || raw.doctor_id || 0);
                    return (
                      <option key={`doc-sel-${did}-${idx}`} value={did}>
                        {getDoctorName(did)} ({getDoctorSpecialty(did)})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Select Patient */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Patient <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <select
                  className="input"
                  style={{ width: '100%' }}
                  value={form.patientId}
                  onChange={(e) => setForm({ ...form, patientId: Number(e.target.value) })}
                >
                  <option value={0}>-- Select Patient --</option>
                  {patients.map((p, idx) => {
                    const raw = p as unknown as Record<string, unknown>;
                    const pid = Number(p.patientId || raw.patient_id || 0);
                    return (
                      <option key={`pat-sel-${pid}-${idx}`} value={pid}>
                        {getPatientName(pid)} (ID: #{pid})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Rating Selector */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Star Rating (1 to 5) <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setForm({ ...form, rating: star })}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        style={{ padding: 4 }}
                      >
                        <Star
                          size={24}
                          style={{
                            color: '#f59e0b',
                            fill: (hoverRating || form.rating) >= star ? '#f59e0b' : 'transparent',
                          }}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: 'var(--foreground)', marginLeft: 8 }}>
                    {ratingLabels[(hoverRating || form.rating) - 1]} ({hoverRating || form.rating}/5)
                  </span>
                </div>
              </div>

              {/* Comment Textarea */}
              <div>
                <label className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                  Review Comment <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <textarea
                  className="input"
                  rows={4}
                  placeholder="Enter detailed feedback and patient commentary..."
                  value={form.comment}
                  onChange={(e) => setForm({ ...form, comment: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 10 }}>
                <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" /> : (editingReview ? 'Update Review' : 'Create Review')}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </AppLayout>
  );
}
