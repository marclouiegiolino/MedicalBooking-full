'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Video, Heart, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';
import type { Appointment, Doctor, AppointmentType } from '@/lib/types';
import Avatar from '@/components/ui/Avatar';
import { resolveApiImageUrl } from '@/lib/api';

interface MobileDashboardProps {
  appointments: Appointment[];
  doctors: Doctor[];
  appointmentTypes: AppointmentType[];
  userName?: string;
}

export default function MobileDashboard({
  appointments,
  doctors,
  appointmentTypes,
  userName = 'Robertson',
}: MobileDashboardProps) {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Record<number, boolean>>({});
  const [selectedDays, setSelectedDays] = useState<Record<number, number>>({});

  const toggleFavorite = (docId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  const handleSelectDay = (docId: number, day: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedDays((prev) => ({ ...prev, [docId]: day }));
  };

  // Helper resolvers
  const getDocFirst = (d: Doctor) => {
    const raw = d as unknown as Record<string, unknown>;
    return String(raw.first_name || d.firstName || 'Darlene');
  };
  const getDocLast = (d: Doctor) => {
    const raw = d as unknown as Record<string, unknown>;
    return String(raw.last_name || d.lastName || 'Robertson');
  };
  const getDocId = (d: Doctor) => {
    const raw = d as unknown as Record<string, unknown>;
    return Number(d.doctorId || raw.doctor_id || 0);
  };
  const getDocSpec = (d: Doctor) => {
    const raw = d as unknown as Record<string, unknown>;
    return String(raw.specialty_name || d.specialtyName || 'Neurologist');
  };
  const getDocFee = (d: Doctor) => {
    const raw = d as unknown as Record<string, unknown>;
    const fee = Number(d.consultationFee ?? raw.consultation_fee ?? 120);
    return fee > 0 ? fee : 120;
  };
  const getDocPhoto = (d: Doctor, idx: number) => {
    const raw = d as unknown as Record<string, unknown>;
    const photo = String(d.profilePicturePath || raw.profile_picture_path || '');
    if (photo && photo.trim()) {
      return resolveApiImageUrl(photo) || photo;
    }
    return idx % 2 === 0 ? '/images/doctor-female.jpg' : '/images/doctor-clinic.jpg';
  };

  // Active / Upcoming appointments
  const upcomingApts = appointments.filter((a) => {
    const raw = a as unknown as Record<string, unknown>;
    const s = String(a.status || raw.status || '').toLowerCase();
    const sid = Number(a.statusId || raw.status_id || 0);
    return sid !== 4 && sid !== 5 && s !== 'completed' && s !== 'cancelled';
  });

  const nextApt = upcomingApts[0];
  const nextDocName = nextApt
    ? ((nextApt as any).doctor_name || (nextApt as any).doctorName || 'Dr. Darlene Robertson')
    : 'Dr. Darlene Robertson';
  const nextDocRaw = nextApt as unknown as Record<string, unknown> | undefined;
  const nextDocPhoto = resolveApiImageUrl(
    nextDocRaw ? String(nextDocRaw.doctor_photo || nextDocRaw.profile_picture_path || nextDocRaw.profilePicturePath || '') : ''
  ) || '/images/doctor-female.jpg';
  const nextSpecialty = nextApt
    ? ((nextApt as any).specialty_name || (nextApt as any).specialtyName || 'Neurologist')
    : 'Neurologist';
  const aptCount = upcomingApts.length > 0 ? upcomingApts.length : 3;

  // Format date for next appointment card
  const formatAptDate = (apt?: Appointment) => {
    if (!apt) return '1st March, Sunday';
    const raw = apt as unknown as Record<string, unknown>;
    const dStr = String(apt.appointmentDate || raw.appointment_date || '');
    if (!dStr) return '1st March, Sunday';
    try {
      const d = new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', weekday: 'long' });
    } catch {
      return dStr;
    }
  };

  const formatAptTime = (apt?: Appointment) => {
    if (!apt) return '4:00 PM';
    const raw = apt as unknown as Record<string, unknown>;
    const tStr = String(apt.appointmentTime || raw.appointment_time || '');
    if (!tStr) return '4:00 PM';
    const clean = tStr.split('T')[1] || tStr;
    const [h, m] = clean.split(':');
    if (!h) return tStr;
    const numH = Number(h);
    const period = numH >= 12 ? 'PM' : 'AM';
    const h12 = numH % 12 || 12;
    return `${h12}:${m || '00'} ${period}`;
  };

  // Default doctor list if empty
  const displayDoctors: Doctor[] = doctors.length > 0 ? doctors : [
    {
      doctorId: 1,
      firstName: 'Darlene',
      lastName: 'Robertson',
      specialtyName: 'Neurologist',
      consultationFee: 120,
    } as unknown as Doctor,
    {
      doctorId: 2,
      firstName: 'Kathryn',
      lastName: 'Murphy',
      specialtyName: 'Cardiologist',
      consultationFee: 150,
    } as unknown as Doctor,
  ];

  return (
    <div className="hp-mobile-dashboard">
      {/* Big Catchy Title */}
      <div className="hp-dashboard-header">
        <h2 className="hp-main-headline">
          Your health Starts With <br />
          <span className="hp-headline-highlight">The Right Doctor</span>
        </h2>
      </div>

      {/* Featured / Next Appointments Card (Screen 2) */}
      <section className="hp-appointments-banner-section">
        <div className="hp-appointment-card">
          <div className="hp-apt-card-top">
            <span className="hp-apt-badge-label">
              Your Next Appointments ({aptCount})
            </span>
          </div>

          <div className="hp-apt-doctor-row">
            <div className="hp-apt-doctor-info">
              <div className="hp-apt-mini-avatar">
                <img
                  src={nextDocPhoto}
                  alt="Doctor avatar"
                  className="hp-apt-avatar-img"
                  onError={(e) => {
                    if (e.currentTarget.src !== '/images/doctor-female.jpg') {
                      e.currentTarget.src = '/images/doctor-female.jpg';
                    }
                  }}
                />
              </div>
              <div className="hp-apt-doctor-meta">
                <h3 className="hp-apt-doctor-name">{nextDocName}</h3>
                <p className="hp-apt-doctor-specialty">{nextSpecialty}</p>
              </div>
            </div>

            <Link
              href="/consultations"
              className="hp-apt-video-btn"
              title="Start Telehealth Video Consultation"
              aria-label="Start Video Consultation"
            >
              <Video size={18} />
            </Link>
          </div>

          {/* Date & Time Pills */}
          <div className="hp-apt-timing-row">
            <div className="hp-time-pill">
              <Calendar size={13} className="hp-pill-icon" />
              <span>{formatAptDate(nextApt)}</span>
            </div>
            <div className="hp-time-pill">
              <Clock size={13} className="hp-pill-icon" />
              <span>{formatAptTime(nextApt)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Specialists Section */}
      <section className="hp-specialists-section">
        <div className="hp-section-header">
          <h3 className="hp-section-title">Our Specialist</h3>
          <Link href="/doctors" className="hp-see-all-link">
            See all
          </Link>
        </div>

        <div className="hp-specialists-list">
          {displayDoctors.map((doc, idx) => {
            const dId = getDocId(doc);
            const first = getDocFirst(doc);
            const last = getDocLast(doc);
            const spec = getDocSpec(doc);
            const fee = getDocFee(doc);
            const photo = getDocPhoto(doc, idx);
            const isFav = !!favorites[dId];
            const activeDay = selectedDays[dId] || 4;

            return (
              <div
                key={dId || idx}
                className="hp-doctor-card"
                onClick={() => router.push(`/doctors/${dId}`)}
              >
                {/* Left Column: Details */}
                <div className="hp-doc-card-left">
                  {/* Status Indicator */}
                  <div className="hp-doc-status-badge">
                    <span className="hp-online-dot" />
                    <span className="hp-online-text">Online</span>
                  </div>

                  <p className="hp-doc-specialty">{spec}</p>
                  <h4 className="hp-doc-name">
                    Dr. {first} {last}
                  </h4>

                  <div className="hp-doc-price-block">
                    <span className="hp-price-amount">${fee}</span>
                    <span className="hp-price-suffix">/ Per Patient</span>
                  </div>

                  {/* Schedule Day Selector */}
                  <div className="hp-doc-schedule-strip">
                    <span className="hp-schedule-label">Schedule</span>
                    <div className="hp-schedule-dots">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((dayNum) => (
                        <button
                          key={dayNum}
                          type="button"
                          className={`hp-day-dot ${activeDay === dayNum ? 'active' : ''}`}
                          onClick={(e) => handleSelectDay(dId, dayNum, e)}
                        >
                          {dayNum}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column: Doctor Portrait + Favorite */}
                <div className="hp-doc-card-right">
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(dId, e)}
                    className={`hp-fav-heart-btn ${isFav ? 'favorited' : ''}`}
                    aria-label="Add to favorites"
                  >
                    <Heart size={16} fill={isFav ? '#ef4444' : 'none'} color={isFav ? '#ef4444' : '#94a3b8'} />
                  </button>

                  <div className="hp-doc-portrait-wrapper">
                    <img
                      src={photo}
                      alt={`Dr. ${first} ${last}`}
                      className="hp-doc-portrait-img"
                      onError={(e) => {
                        const fallback = idx % 2 === 0 ? '/images/doctor-female.jpg' : '/images/doctor-clinic.jpg';
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
