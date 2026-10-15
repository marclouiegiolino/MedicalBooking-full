'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ExternalLink, User as UserIcon } from 'lucide-react';
import { resolveApiImageUrl } from '@/lib/api';

const COLORS = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#ede9fe', color: '#6d28d9' },
  { bg: '#d1fae5', color: '#065f46' },
  { bg: '#fef3c7', color: '#92400e' },
  { bg: '#fee2e2', color: '#991b1b' },
  { bg: '#e0f2fe', color: '#0c4a6e' },
];

function getColor(initials: string) {
  const code = (initials || 'U').charCodeAt(0) || 0;
  const idx = code % COLORS.length;
  return COLORS[idx];
}

export interface AvatarProps {
  initials?: string;
  src?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'portrait-sm' | 'portrait-md' | 'portrait-lg';
  shape?: 'circle' | 'portrait' | 'rounded';
  className?: string;
  style?: React.CSSProperties;
  zoomable?: boolean;
  title?: string;
  subtitle?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function Avatar({
  initials = 'U',
  src,
  alt = 'Avatar',
  size = 'md',
  shape = 'circle',
  className = '',
  style,
  zoomable = false,
  title,
  subtitle,
  onClick,
}: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const resolvedSrc = resolveApiImageUrl(src);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset error if src changes
  useEffect(() => {
    setImgError(false);
  }, [src]);

  // Handle escape key to close zoom modal
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsZoomed(false);
    }
  }, []);

  useEffect(() => {
    if (isZoomed) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isZoomed, handleKeyDown]);

  const { bg, color } = getColor(initials || 'U');

  const isPortrait = shape === 'portrait' || String(size).startsWith('portrait');
  const defaultRadius = isPortrait ? '12px' : shape === 'rounded' ? '8px' : '50%';

  const sizeStyles: Record<string, React.CSSProperties> = {
    xs: { width: 22, height: 22, fontSize: 9 },
    sm: { width: 28, height: 28, fontSize: 11 },
    md: { width: 36, height: 36, fontSize: 13 },
    lg: { width: 48, height: 48, fontSize: 16 },
    xl: { width: 64, height: 64, fontSize: 22 },
    '2xl': { width: 88, height: 88, fontSize: 30 },
    'portrait-sm': { width: 60, height: 80, fontSize: 20, borderRadius: '10px' },
    'portrait-md': { width: 92, height: 122, fontSize: 28, borderRadius: '12px' },
    'portrait-lg': { width: 120, height: 160, fontSize: 36, borderRadius: '14px' },
  };

  const currentSizeStyle = sizeStyles[size] || sizeStyles.md;

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    } else if (zoomable) {
      e.stopPropagation();
      e.preventDefault();
      setIsZoomed(true);
    }
  };

  const hasPhoto = Boolean(resolvedSrc && !imgError);

  const zoomModal = isZoomed && mounted ? (
    createPortal(
      <div
        role="dialog"
        aria-modal="true"
        onClick={() => setIsZoomed(false)}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.82)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Modal Container */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            maxWidth: 'min(90vw, 420px)',
            width: '100%',
            background: 'var(--card-bg, #ffffff)',
            borderRadius: '24px',
            padding: '28px 24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            transform: 'scale(1)',
            animation: 'modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsZoomed(false)}
            aria-label="Close zoom preview"
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.06)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--foreground, #1e293b)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.12)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)')}
          >
            <X size={18} />
          </button>

          {/* Large Image Preview */}
          <div
            style={{
              width: isPortrait ? 'min(75vw, 280px)' : 'min(70vw, 260px)',
              height: isPortrait ? 'min(100vw, 360px)' : 'min(70vw, 260px)',
              borderRadius: isPortrait ? '18px' : '50%',
              overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
              border: '4px solid var(--primary, #2563eb)',
              background: 'var(--card-border, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              flexShrink: 0,
            }}
          >
            {hasPhoto ? (
              <img
                src={resolvedSrc!}
                alt={alt}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: bg,
                  color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '72px',
                  fontWeight: 800,
                  userSelect: 'none',
                }}
              >
                {(initials || 'U').slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Details */}
          {(title || initials) && (
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--foreground, #0f172a)',
                margin: '0 0 4px 0',
              }}
            >
              {title || `User (${initials.toUpperCase()})`}
            </h3>
          )}
          {subtitle && (
            <p
              style={{
                fontSize: '13px',
                color: 'var(--muted, #64748b)',
                margin: '0 0 16px 0',
                fontWeight: 500,
              }}
            >
              {subtitle}
            </p>
          )}

          {/* Actions */}
          {hasPhoto && resolvedSrc && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <a
                href={resolvedSrc}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  background: 'var(--accent, #eff6ff)',
                  color: 'var(--primary, #2563eb)',
                  fontSize: '13px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  transition: 'background 0.15s ease',
                }}
              >
                <ExternalLink size={14} /> Open Full Size
              </a>
            </div>
          )}
        </div>
      </div>,
      document.body
    )
  ) : null;

  const cursorStyle = zoomable || onClick ? { cursor: 'pointer' } : {};

  if (hasPhoto) {
    return (
      <>
        <div
          className={`avatar avatar-${size} ${className}`}
          onClick={handleClick}
          title={zoomable ? 'Click to zoom in' : undefined}
          style={{
            ...currentSizeStyle,
            borderRadius: defaultRadius,
            overflow: 'hidden',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'var(--card-border, #e2e8f0)',
            ...cursorStyle,
            ...style,
          }}
        >
          <img
            src={resolvedSrc!}
            alt={alt}
            onError={() => setImgError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>
        {zoomModal}
      </>
    );
  }

  return (
    <>
      <div
        className={`avatar avatar-${size} ${className}`}
        onClick={handleClick}
        title={zoomable ? 'Click to zoom in' : undefined}
        style={{
          ...currentSizeStyle,
          backgroundColor: bg,
          color,
          borderRadius: defaultRadius,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          flexShrink: 0,
          userSelect: 'none',
          ...cursorStyle,
          ...style,
        }}
      >
        {(initials || 'U').slice(0, 2).toUpperCase()}
      </div>
      {zoomModal}
    </>
  );
}
