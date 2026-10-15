'use client';

import React, { useState } from 'react';
import { Smartphone, X, ExternalLink } from 'lucide-react';
import WelcomePage from '@/app/welcome/page';
import MobileDashboard from './MobileDashboard';
import MobileDoctorDetail from './MobileDoctorDetail';
import type { Doctor, Appointment } from '@/lib/types';

interface MobilePreviewModalProps {
  doctors?: Doctor[];
  appointments?: Appointment[];
}

export default function MobilePreviewModal({
  doctors = [],
  appointments = [],
}: MobilePreviewModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'welcome' | 'dashboard' | 'booking'>('dashboard');

  const sampleDoctor: Doctor = doctors[0] || ({
    doctorId: 1,
    firstName: 'Darlene',
    lastName: 'Robertson',
    specialtyName: 'Neurologist',
    hospitalName: 'Central Clinic',
    consultationFee: 120,
    profilePicturePath: '/images/doctor-female.jpg',
  } as unknown as Doctor);

  return (
    <>
      {/* Floating launcher button for desktop view */}
      <div className="hp-desktop-mobile-launcher">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="hp-mobile-launcher-btn"
          title="Preview HealthPoint Mobile Experience"
        >
          <Smartphone size={18} />
          <span>Mobile View</span>
          <span className="hp-badge-pill">3 Screens</span>
        </button>
      </div>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="hp-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="hp-preview-modal-dialog animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Screen Switchers */}
            <div className="hp-preview-header">
              <div className="hp-preview-title-box">
                <Smartphone size={20} className="text-primary" />
                <h3 className="hp-preview-heading">HealthPoint Mobile Design</h3>
              </div>

              {/* Screen Selector Tabs */}
              <div className="hp-preview-screen-tabs">
                <button
                  type="button"
                  className={`hp-screen-tab ${activeTab === 'welcome' ? 'active' : ''}`}
                  onClick={() => setActiveTab('welcome')}
                >
                  1. Welcome
                </button>
                <button
                  type="button"
                  className={`hp-screen-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setActiveTab('dashboard')}
                >
                  2. Home
                </button>
                <button
                  type="button"
                  className={`hp-screen-tab ${activeTab === 'booking' ? 'active' : ''}`}
                  onClick={() => setActiveTab('booking')}
                >
                  3. Doctor Detail
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hp-preview-close-btn"
                aria-label="Close Preview"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mobile Device Frame */}
            <div className="hp-phone-frame-container">
              <div className="hp-iphone-shell">
                <div className="hp-iphone-notch">
                  <div className="hp-camera-lens" />
                  <div className="hp-speaker-grill" />
                </div>

                <div className="hp-iphone-screen-viewport">
                  {activeTab === 'welcome' && <WelcomePage />}

                  {activeTab === 'dashboard' && (
                    <div style={{ background: '#f4f8fc', minHeight: '100%' }}>
                      <MobileDashboard
                        appointments={appointments}
                        doctors={doctors}
                        appointmentTypes={[]}
                        userName="Robertson"
                      />
                    </div>
                  )}

                  {activeTab === 'booking' && (
                    <div style={{ background: '#f4f8fc', minHeight: '100%' }}>
                      <MobileDoctorDetail
                        doctor={sampleDoctor}
                        avgRating={4.5}
                        totalReviews={24}
                      />
                    </div>
                  )}
                </div>

                <div className="hp-iphone-home-bar" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
