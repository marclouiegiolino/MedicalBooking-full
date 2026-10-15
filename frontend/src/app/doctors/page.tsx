'use client';
import { useEffect, useState } from 'react';
import { Search, Star, Stethoscope, Building2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import Spinner from '@/components/ui/Spinner';
import { doctorApi, specialtyApi, departmentApi, reviewApi, hospitalInformationApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Doctor, Specialty, Department, Review, HospitalInformation } from '@/lib/types';

/* ── helpers to read both camelCase and snake_case API fields ─────────── */
function specId(s: Specialty): number {
  const raw = s as unknown as Record<string, unknown>;
  return Number(s.specialtyId || raw.specialty_id || 0);
}
function specName(s: Specialty): string {
  const raw = s as unknown as Record<string, unknown>;
  return (raw.specialty_name as string) || s.specialtyName || '';
}
function docId(d: Doctor): number {
  const raw = d as unknown as Record<string, unknown>;
  return Number(d.doctorId || raw.doctor_id || 0);
}
function docSpecId(d: Doctor): number {
  const raw = d as unknown as Record<string, unknown>;
  return Number(d.specialtyId || raw.specialty_id || 0);
}
function docDeptId(d: Doctor): number {
  const raw = d as unknown as Record<string, unknown>;
  return Number(d.departmentId || raw.department_id || 0);
}
function docFirst(d: Doctor): string {
  const raw = d as unknown as Record<string, unknown>;
  return (raw.first_name as string) || d.firstName || '';
}
function docLast(d: Doctor): string {
  const raw = d as unknown as Record<string, unknown>;
  return (raw.last_name as string) || d.lastName || '';
}
function docSpecName(d: Doctor): string {
  const raw = d as unknown as Record<string, unknown>;
  return (raw.specialty_name as string) || d.specialtyName || '';
}
function docDeptName(d: Doctor): string {
  const raw = d as unknown as Record<string, unknown>;
  return (raw.department_name as string) || d.departmentName || '';
}

export default function DoctorsPage() {
  const { isDoctor } = useAuth();
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [hospitals, setHospitals] = useState<HospitalInformation[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSpec, setFilterSpec] = useState(0);

  useEffect(() => {
    if (isDoctor()) {
      router.replace('/dashboard');
      return;
    }
  }, [isDoctor, router]);

  useEffect(() => {
    if (isDoctor()) return;
    Promise.allSettled([
      doctorApi.getAll().catch(() => ({ data: [] })),
      specialtyApi.getAll().catch(() => ({ data: [] })),
      departmentApi.getAll().catch(() => ({ data: [] })),
      reviewApi.getAll().catch(() => ({ data: [] })),
      hospitalInformationApi.getAll().catch(() => ({ data: [] })),
    ])
      .then(([drRes, spRes, deptRes, revRes, hospRes]) => {
        if (drRes.status === 'fulfilled') {
          const drData = drRes.value?.data;
          const drList = Array.isArray(drData)
            ? drData
            : Array.isArray(drData?.items)
            ? drData.items
            : Array.isArray(drData?.data)
            ? drData.data
            : Array.isArray(drData?.doctors)
            ? drData.doctors
            : [];
          setDoctors(drList);
        }

        if (spRes.status === 'fulfilled') {
          const spData = spRes.value?.data;
          const spList = Array.isArray(spData)
            ? spData
            : Array.isArray(spData?.items)
            ? spData.items
            : [];
          setSpecialties(spList);
        }

        if (deptRes.status === 'fulfilled') {
          const deptData = deptRes.value?.data;
          const deptList = Array.isArray(deptData)
            ? deptData
            : Array.isArray(deptData?.items)
            ? deptData.items
            : [];
          setDepartments(deptList);
        }

        if (revRes.status === 'fulfilled') {
          const rData = revRes.value?.data;
          const rList = Array.isArray(rData)
            ? rData
            : Array.isArray(rData?.items)
            ? rData.items
            : [];
          setReviews(rList);
        }

        if (hospRes.status === 'fulfilled') {
          const hData = hospRes.value?.data;
          const hList = Array.isArray(hData)
            ? hData
            : Array.isArray(hData?.items)
            ? hData.items
            : Array.isArray(hData?.data)
            ? hData.data
            : [];
          setHospitals(hList);
        }
      })
      .catch((err) => console.error('Error loading doctor directory:', err))
      .finally(() => setLoading(false));
  }, [isDoctor]);

  const getDocSpecName = (d: Doctor) => {
    const sname = docSpecName(d);
    if (sname) return sname;
    const sid = docSpecId(d);
    const found = specialties.find((s) => specId(s) === sid);
    if (found) return specName(found);
    return 'General Practice';
  };

  const getDocHospitalName = (d: Doctor) => {
    const raw = d as unknown as Record<string, unknown>;
    const hid = Number(d.hospitalId || raw.hospital_id || 0);
    if (!hid) return '';
    const found = hospitals.find((h) => {
      const rawH = h as unknown as Record<string, unknown>;
      return Number(h.hospitalId || rawH.hospital_id || 0) === hid;
    });
    if (found) {
      const rawFound = found as unknown as Record<string, unknown>;
      return String(found.hospitalName || rawFound.hospital_name || '');
    }
    return '';
  };

  const getDocDeptName = (d: Doctor) => {
    const dname = docDeptName(d);
    if (dname) return dname;
    const did = docDeptId(d);
    const found = departments.find((dep) => Number(dep.departmentId || (dep as any).department_id) === did);
    if (found) return found.departmentName || (found as any).department_name || 'Medical Department';
    return 'Medical Department';
  };

  const filtered = doctors.filter((d) => {
    const first = docFirst(d);
    const last = docLast(d);
    const matchSearch = search
      ? `${first} ${last}`.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchSpec = filterSpec ? docSpecId(d) === filterSpec : true;
    return matchSearch && matchSpec;
  });

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Doctor Directory</h1>
            <p className="page-subtitle">Find and connect with our medical specialists</p>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div className="search-bar" style={{ flex:'1 1 240px', maxWidth:380 }}>
            <Search size={15} style={{ color:'var(--muted)', flexShrink:0 }} />
            <input placeholder="Search by name or specialty…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            <button className={`filter-chip ${filterSpec === 0 ? 'active' : ''}`} onClick={() => setFilterSpec(0)}>All</button>
            {specialties.map((s, idx) => {
              const sid = specId(s);
              const sname = specName(s);
              return (
                <button
                  key={`spec-filter-${sid}-${idx}`}
                  className={`filter-chip ${filterSpec === sid ? 'active' : ''}`}
                  onClick={() => setFilterSpec(sid)}
                >
                  {sname}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? <Spinner center /> : filtered.length === 0 ? (
          <Card>
            <div className="empty-state">
              <div className="empty-state-icon"><Stethoscope size={24} /></div>
              <p className="empty-state-title">No doctors found</p>
              <p className="empty-state-desc">Try adjusting your search or filters.</p>
            </div>
          </Card>
        ) : (
          <div className="grid-3">
            {filtered.map((d, idx) => {
              const did = docId(d);
              const first = docFirst(d);
              const last = docLast(d);
              const fee = Number(d.consultationFee ?? (d as unknown as Record<string, unknown>).consultation_fee ?? 0);
              const initials = `${first?.[0] ?? ''}${last?.[0] ?? ''}`;

              const rawDoc = d as unknown as Record<string, unknown>;
              const pic = String(d.profilePicturePath || rawDoc.profile_picture_path || '');
              const docReviews = reviews.filter(r => {
                const rRaw = r as unknown as Record<string, unknown>;
                return Number(r.doctorId || rRaw.doctor_id || 0) === did;
              });
              const docRevCount = docReviews.length;
              const docAvgRating = docRevCount > 0
                ? (docReviews.reduce((sum, r) => sum + Number(r.rating || (r as any).rating || 0), 0) / docRevCount)
                : 5.0;

              const hospName = getDocHospitalName(d);

              return (
                <Link key={`doc-card-${did}-${idx}`} href={`/doctors/${did}`} style={{ textDecoration:'none' }}>
                  <Card className="card-p doctor-card">
                    <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:14 }}>
                      {/* Vertical Portrait Headshot */}
                      <div
                        style={{
                          position: 'relative',
                          borderRadius: '14px',
                          padding: 2.5,
                          background: 'linear-gradient(135deg, var(--primary, #3b82f6) 0%, #60a5fa 60%, rgba(59, 130, 246, 0.3) 100%)',
                          boxShadow: '0 6px 16px -2px rgba(37, 99, 235, 0.22), 0 2px 6px rgba(0,0,0,0.06)',
                          flexShrink: 0,
                        }}
                      >
                        <Avatar
                          initials={initials}
                          src={pic}
                          shape="portrait"
                          size="portrait-md"
                          zoomable={true}
                          title={`Dr. ${first} ${last}`}
                          subtitle={getDocSpecName(d)}
                          style={{
                            width: 96,
                            height: 128,
                            fontSize: 30,
                            fontWeight: 700,
                            border: '2px solid var(--card-bg, #ffffff)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p className="font-semibold text-sm" style={{ color:'var(--foreground)' }}>
                          Dr. {first} {last}
                        </p>
                        <p className="text-xs text-muted" style={{ marginTop:2 }}>
                          {getDocSpecName(d)}
                        </p>
                        {hospName && (
                          <p className="text-xs text-muted" style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Building2 size={11} style={{ color: 'var(--primary)' }} />
                            <span>{hospName}</span>
                          </p>
                        )}
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4, flexWrap:'wrap' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:3 }}>
                            <Star size={11} style={{ color:'#f59e0b', fill:'#f59e0b' }} />
                            <span className="text-xs font-semibold">{docAvgRating.toFixed(1)}</span>
                            <span className="text-xs text-muted">({docRevCount})</span>
                          </div>
                          <span className="text-xs text-muted">·</span>
                          <span className="text-xs font-semibold">₱{fee.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:12, borderTop:'1px solid var(--card-border)' }}>
                      <Badge variant="success">Available Today</Badge>
                      <span className="text-xs text-muted">{getDocDeptName(d)}</span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
