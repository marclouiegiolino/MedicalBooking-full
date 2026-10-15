'use client';
import { useEffect, useState, useRef } from 'react';
import { MapPin, Navigation, Phone, CheckCircle2, AlertTriangle, ExternalLink, Calendar, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { HospitalInformation, NearbyByAddressResult } from '@/lib/types';
import { getNearbyHospitalsForAddress, formatDistance } from '@/lib/osm';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

interface NearbyHospitalDetectorProps {
  address?: string;
  compact?: boolean;
  showActions?: boolean;
  title?: string;
  onDetected?: (result: NearbyByAddressResult) => void;
}

export default function NearbyHospitalDetector({
  address = '',
  compact = false,
  showActions = true,
  title = 'Nearby Healthcare Facility',
  onDetected,
}: NearbyHospitalDetectorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NearbyByAddressResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueriedRef = useRef<string>('');

  useEffect(() => {
    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 3) {
      setResult(null);
      setError(null);
      setLoading(false);
      lastQueriedRef.current = '';
      return;
    }

    if (trimmed === lastQueriedRef.current) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);
    setError(null);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        lastQueriedRef.current = trimmed;
        const res = await getNearbyHospitalsForAddress(trimmed);
        setResult(res);
        if (onDetected) onDetected(res);
        if (!res.found) {
          setError(res.message || 'Could not locate address on OpenStreetMap.');
        }
      } catch (err) {
        console.error('Nearby hospital detection error:', err);
        setError('Failed to detect nearby hospitals.');
      } finally {
        setLoading(false);
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [address, onDetected]);

  if (!address || address.trim().length < 3) {
    return null;
  }

  // Nearest hospital
  const nearest = result?.hospitals && result.hospitals.length > 0 ? result.hospitals[0] : null;

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: compact ? '8px 12px' : '12px 16px',
          background: 'var(--accent)',
          borderRadius: 10,
          border: '1px solid var(--card-border)',
          fontSize: 12.5,
          color: 'var(--muted)',
          marginTop: 8,
        }}
      >
        <Loader2 size={15} className="animate-spin" style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span>Detecting nearby hospitals for &quot;{address}&quot; via OpenStreetMap…</span>
      </div>
    );
  }

  if (error || !result?.found || !nearest) {
    if (!result?.found && !loading) {
      return (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: compact ? '8px 12px' : '12px 14px',
            background: 'var(--card-bg)',
            borderRadius: 10,
            border: '1px dashed var(--card-border)',
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 8,
          }}
        >
          <MapPin size={15} style={{ color: 'var(--muted)', flexShrink: 0, marginTop: 2 }} />
          <div>
            <span>No facility match detected yet for this address on OpenStreetMap.</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Try including city or district (e.g. &quot;Espana Blvd, Manila&quot; or &quot;Quezon City&quot;).
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  const rawH = nearest as unknown as Record<string, unknown>;
  const hospName = nearest.hospitalName || String(rawH.hospital_name || 'Hospital Facility');
  const hospAddr = nearest.address || String(rawH.address || '');
  const hospPhone = nearest.phoneNumber || String(rawH.phone_number || '');
  const distKm = nearest.distanceKm ?? (nearest.distance_km as number | undefined);
  const isCovered = nearest.isWithinServiceRadius ?? (nearest.is_within_service_radius as boolean | undefined) ?? true;
  const radiusKm = nearest.serviceRadius || Number(rawH.service_radius || 0);

  // Compact badge rendering (for forms / modals)
  if (compact) {
    return (
      <div
        style={{
          marginTop: 8,
          padding: '10px 12px',
          background: 'var(--card-bg)',
          borderRadius: 8,
          border: '1px solid var(--card-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15 }}>🏥</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{hospName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {distKm !== undefined && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--primary)',
                  background: 'var(--accent)',
                  padding: '2px 8px',
                  borderRadius: 6,
                }}
              >
                📍 {formatDistance(distKm)}
              </span>
            )}
            <Badge variant={isCovered ? 'success' : 'warning'}>
              {isCovered ? 'Within Coverage' : 'Outside Radius'}
            </Badge>
          </div>
        </div>

        {hospAddr && (
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--muted)' }}>
            {hospAddr}
          </p>
        )}
      </div>
    );
  }

  // Full detailed card rendering (for Profile page / Dashboard)
  return (
    <div
      style={{
        marginTop: 12,
        padding: '14px 16px',
        background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(var(--primary-rgb, 14, 165, 233), 0.04) 100%)',
        borderRadius: 12,
        border: '1px solid var(--card-border)',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            🏥
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
              {title}
            </p>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>
              {hospName}
            </h4>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {distKm !== undefined && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--primary)',
                background: 'var(--accent)',
                padding: '3px 10px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Navigation size={12} />
              {formatDistance(distKm)}
            </span>
          )}

          <Badge variant={isCovered ? 'success' : 'warning'}>
            {isCovered ? '✓ In Service Area' : 'Outside Standard Area'}
          </Badge>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
        {hospAddr && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={13} style={{ flexShrink: 0, color: 'var(--muted)' }} />
            <span>{hospAddr}</span>
          </div>
        )}
        {hospPhone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={13} style={{ flexShrink: 0, color: 'var(--muted)' }} />
            <span>{hospPhone}</span>
          </div>
        )}
        {radiusKm > 0 && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            Coverage Service Radius: <strong>{radiusKm} km</strong>
          </div>
        )}
      </div>

      {result.displayName && (
        <p style={{ margin: '8px 0 0 0', fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', borderTop: '1px dashed var(--card-border)', paddingTop: 6 }}>
          📍 Patient location matched: {result.displayName}
        </p>
      )}

      {showActions && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Link href="/hospitals" style={{ textDecoration: 'none' }}>
            <Button variant="ghost" size="sm" icon={ExternalLink}>
              View on Map
            </Button>
          </Link>
          <Link href="/appointments/book" style={{ textDecoration: 'none' }}>
            <Button size="sm" icon={Calendar}>
              Book at Hospital
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
