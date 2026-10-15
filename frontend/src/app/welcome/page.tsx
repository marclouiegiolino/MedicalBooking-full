'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Video, ArrowRight, Activity, Plus, Wifi, Battery, Signal } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function WelcomePage() {
  const router = useRouter();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <div className="hp-welcome-container">
      {/* Mobile iOS Status Bar */}
      <div className="hp-status-bar">
        <span className="hp-status-time">9:41</span>
        <div className="hp-status-icons">
          <Signal size={14} strokeWidth={2.5} />
          <Wifi size={14} strokeWidth={2.5} />
          <Battery size={16} strokeWidth={2.5} />
        </div>
      </div>

      {/* Brand Header */}
      <header className="hp-welcome-header">
        <div className="hp-logo-mark">
          <div className="hp-cross-symbol">
            <span className="hp-cross-dot dot-1" />
            <span className="hp-cross-dot dot-2" />
            <span className="hp-cross-dot dot-3" />
            <span className="hp-cross-dot dot-4" />
          </div>
          <span className="hp-brand-text">HealthPoint</span>
        </div>
      </header>

      {/* Main Visual with Floating Badges */}
      <div className="hp-hero-visual-wrapper">
        <div className="hp-hero-backdrop">
          {/* Doctor Portrait */}
          <div className="hp-hero-img-container">
            <img
              src="/images/doctor-female.jpg"
              alt="Dr. Darlene Robertson - HealthPoint Specialist"
              className="hp-hero-doctor-img"
            />
          </div>

          {/* Floating Badge 1: Patient with headache */}
          <div className="hp-float-card hp-float-migraine">
            <img
              src="/images/patient-headache.jpg"
              alt="Consultation symptom"
              className="hp-float-thumb"
            />
          </div>

          {/* Floating Badge 2: Video consultation icon */}
          <div className="hp-float-card hp-float-video">
            <Video size={18} className="hp-video-icon" />
          </div>
        </div>
      </div>

      {/* Hero Content */}
      <div className="hp-welcome-content">
        <p className="hp-welcome-sub">Welcome to</p>
        <h1 className="hp-welcome-title">
          Next-Level <br />
          <span className="hp-highlight-title">Doctor Speech</span>
        </h1>

        {/* Slide / Action Button */}
        <div className="hp-action-bar">
          <button
            type="button"
            onClick={handleGetStarted}
            className="hp-get-started-btn"
          >
            <div className="hp-btn-circle-arrow">
              <ArrowRight size={18} />
            </div>
            <span className="hp-btn-text">Get Started</span>
            <div className="hp-btn-chevrons">
              <span>›</span>
              <span>›</span>
              <span>›</span>
            </div>
          </button>
        </div>

        {/* Secondary options */}
        <div className="hp-welcome-footer-links">
          <Link href="/dashboard" className="hp-text-link">
            Explore Doctors as Guest
          </Link>
          <span className="hp-bullet">·</span>
          <Link href="/login" className="hp-text-link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
