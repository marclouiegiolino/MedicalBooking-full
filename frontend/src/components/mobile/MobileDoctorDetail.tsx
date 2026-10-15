'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, Star, MapPin, Stethoscope,
  MessageSquare, Settings, CheckCircle2, Clock, Calendar, Heart
} from 'lucide-react';
import type { Doctor, DoctorSchedule } from '@/lib/types';
import { appointmentApi, resolveApiImageUrl } from '@/lib/api';

interface MobileDoctorDetailProps {
  doctor: Doctor;
  schedules?: DoctorSchedule[];
  avgRating?: number;
  totalReviews?: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const PERIOD_SLOTS: Record<string, string[]> = {
  Morning: ['8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM'],
  Afternoon: ['1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM'],
  Evening: ['5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM'],
  Night: ['8:00 PM', '8:30 PM', '9:00 PM'],
};

export default function MobileDoctorDetail({
  doctor,
  schedules = [],
  avgRating = 4.5,
  totalReviews = 18,
}: MobileDoctorDetailProps) {
  const router = useRouter();

  // Selected date state
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonthIdx, setCurrentMonthIdx] = useState(1); // 1 = February
  const [selectedDayNum, setSelectedDayNum] = useState(14); // 14 Wed active
  const [selectedPeriod, setSelectedPeriod] = useState<'Morning' | 'Afternoon' | 'Evening' | 'Night'>('Morning');
  const [selectedSlot, setSelectedSlot] = useState('8:30 AM');
  const [isBooked, setIsBooked] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonthIdx === 0) {
      setCurrentMonthIdx(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonthIdx((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIdx === 11) {
      setCurrentMonthIdx(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonthIdx((m) => m + 1);
    }
  };

  // Generate 7 days strip around the selected day
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDays = [
    { day: 'Mon', num: 12 },
    { day: 'Tue', num: 13 },
    { day: 'Wed', num: 14 },
    { day: 'Thu', num: 15 },
    { day: 'Fri', num: 16 },
    { day: 'Sat', num: 17 },
    { day: 'Sun', num: 18 },
  ];

  // Doctor information resolvers
  const raw = doctor as unknown as Record<string, unknown>;
  const first = String(raw.first_name || doctor.firstName || 'Darlene');
  const last = String(raw.last_name || doctor.lastName || 'Robertson');
  const spec = String(raw.specialty_name || doctor.specialtyName || 'Neurologist');
  const hosp = String(raw.hospital_name || (doctor as any).hospitalName || '500m');
  const rawPic = String(doctor.profilePicturePath || raw.profile_picture_path || '');
  const photo = (rawPic ? resolveApiImageUrl(rawPic) : null) || '/images/doctor-clinic.jpg';

  const handleBookNow = async () => {
    setBookingLoading(true);
    try {
      // Simulate booking submission or API call
      await new Promise((r) => setTimeout(r, 600));
      setIsBooked(true);
    } catch {
      alert('Unable to book slot. Please try another time.');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="hp-doctor-detail-page">
      {/* Header bar */}
      <header className="hp-detail-top-nav">
        <button
          type="button"
          onClick={() => router.back()}
          className="hp-nav-circle-btn"
          aria-label="Back to Doctors"
        >
          <ChevronLeft size={20} />
        </button>

        <h1 className="hp-detail-header-title">Doctor Detail</h1>

        <button
          type="button"
          onClick={() => setIsFavorited((v) => !v)}
          className={`hp-nav-circle-btn ${isFavorited ? 'active' : ''}`}
          aria-label="Bookmark"
        >
          <Heart size={18} fill={isFavorited ? '#ef4444' : 'none'} color={isFavorited ? '#ef4444' : 'currentColor'} />
        </button>
      </header>

      {/* Hero Visual: Full width portrait with clinic background */}
      <div className="hp-detail-hero-section">
        <div className="hp-hero-image-wrap">
          <img
            src={photo}
            alt={`Dr. ${first} ${last}`}
            className="hp-detail-hero-img"
            onError={(e) => {
              if (e.currentTarget.src !== '/images/doctor-clinic.jpg') {
                e.currentTarget.src = '/images/doctor-clinic.jpg';
              }
            }}
          />
        </div>

        {/* Floating Overlap Card matching Screen 3 */}
        <div className="hp-detail-overlap-card">
          <h2 className="hp-detail-doc-name">
            Dr. {first} {last}
          </h2>

          <div className="hp-detail-meta-row">
            <div className="hp-meta-badge">
              <Star size={13} className="hp-star-icon" fill="#f59e0b" color="#f59e0b" />
              <span>{avgRating.toFixed(1)}</span>
            </div>

            <div className="hp-meta-badge">
              <MapPin size={13} className="hp-pin-icon" />
              <span>{hosp.includes('Hospital') ? '500m' : hosp}</span>
            </div>

            <div className="hp-meta-badge">
              <Stethoscope size={13} className="hp-spec-icon" />
              <span>{spec}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <section className="hp-detail-calendar-section">
        <div className="hp-month-header">
          <h3 className="hp-month-title">
            {MONTH_NAMES[currentMonthIdx]} {currentYear}
          </h3>
          <div className="hp-month-nav-arrows">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="hp-month-arrow-btn"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              className="hp-month-arrow-btn"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Horizontal Weekday & Date Ribbon */}
        <div className="hp-date-ribbon">
          {weekDays.map((item) => {
            const isSelected = selectedDayNum === item.num;
            return (
              <button
                key={item.num}
                type="button"
                onClick={() => setSelectedDayNum(item.num)}
                className={`hp-date-cell ${isSelected ? 'selected' : ''}`}
              >
                <span className="hp-date-day-name">{item.day}</span>
                <span className="hp-date-day-num">{item.num}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Time Section */}
      <section className="hp-detail-time-section">
        <h3 className="hp-time-section-title">Time</h3>

        {/* Period Filter Tabs */}
        <div className="hp-period-tabs">
          {(['Morning', 'Afternoon', 'Evening', 'Night'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => {
                setSelectedPeriod(period);
                setSelectedSlot(PERIOD_SLOTS[period][0] || '8:00 AM');
              }}
              className={`hp-period-tab ${selectedPeriod === period ? 'active' : ''}`}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Time Chips Grid */}
        <div className="hp-time-chips-grid">
          {PERIOD_SLOTS[selectedPeriod].map((slot) => {
            const isSelected = selectedSlot === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setSelectedSlot(slot)}
                className={`hp-time-chip ${isSelected ? 'selected' : ''}`}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </section>

      {/* Bottom Sticky Action Bar */}
      <div className="hp-detail-bottom-bar">
        <Link
          href={`/consultations`}
          className="hp-chat-bubble-btn"
          title="Message Doctor"
          aria-label="Message Doctor"
        >
          <MessageSquare size={20} />
        </Link>

        <button
          type="button"
          onClick={handleBookNow}
          disabled={bookingLoading}
          className="hp-book-now-btn"
        >
          {bookingLoading ? 'Reserving...' : isBooked ? 'Appointment Booked!' : 'Book Now'}
        </button>
      </div>

      {/* Confirmation Modal / Toast */}
      {isBooked && (
        <div className="hp-booking-toast animate-scale-in">
          <div className="hp-toast-content">
            <CheckCircle2 size={24} className="hp-toast-icon" />
            <div>
              <h4 className="hp-toast-title">Appointment Confirmed!</h4>
              <p className="hp-toast-desc">
                {MONTH_NAMES[currentMonthIdx]} {selectedDayNum}, {currentYear} at {selectedSlot} with Dr. {first} {last}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBooked(false)}
              className="hp-toast-close"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
