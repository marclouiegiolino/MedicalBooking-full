'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Crop as CropIcon } from 'lucide-react';

// Handle ESM / CJS interop for Cropper
const EasyCropper: any = (Cropper as any)?.default || Cropper;

// ─── Canvas helper ─────────────────────────────────────────────────────────────

async function getCroppedBlob(
  imageSrc: string,
  pixelCrop: Area,
  outputSize = 400,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width  = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Smooth rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    outputSize, outputSize,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin for remote URLs; blob: and data: URLs break if crossOrigin is set in some browsers
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = src;
  });
}

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface PhotoCropModalProps {
  imageSrc: string;
  onSave: (blob: Blob) => void;
  onClose: () => void;
  title?: string;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function PhotoCropModal({
  imageSrc,
  onSave,
  onClose,
  title = 'Adjust Profile Photo',
}: PhotoCropModalProps) {
  const [crop,        setCrop]        = useState<Point>({ x: 0, y: 0 });
  const [zoom,        setZoom]        = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedArea) return;
    setSaving(true);
    setError('');
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea, 400);
      onSave(blob);
    } catch (e: any) {
      console.error('Crop failed:', e);
      setError(e?.message || 'Failed to process image. Please try again.');
      setSaving(false);
    }
  };

  const iconBtn: React.CSSProperties = {
    width: 34, height: 34, borderRadius: 8,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: 'var(--foreground, #fff)',
    flexShrink: 0,
    transition: 'background 0.15s ease',
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5, 8, 18, 0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      {/* Panel */}
      <div
        style={{
          width: '100%', maxWidth: 480,
          background: 'var(--card-bg, #1e293b)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 20,
          boxShadow: '0 30px 70px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(37,99,235,0.15)',
              color: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CropIcon size={18} />
            </div>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--foreground, #fff)' }}>
                {title}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--muted, #94a3b8)' }}>
                Drag image to reposition · Use slider to zoom
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{ ...iconBtn, borderRadius: '50%' }}
            title="Cancel & close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Cropper Container */}
        <div style={{ position: 'relative', width: '100%', height: 330, background: '#090d16' }}>
          <EasyCropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: '#090d16' },
              cropAreaStyle: {
                border: '3px solid #3b82f6',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
              },
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <button
            style={iconBtn}
            onClick={() => setZoom((z) => Math.max(1, +(z - 0.15).toFixed(2)))}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>

          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#3b82f6',
              cursor: 'pointer',
              height: 6,
            }}
          />

          <button
            style={iconBtn}
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>

          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0 }} />

          <button
            style={iconBtn}
            onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }}
            title="Reset position and zoom"
          >
            <RotateCcw size={15} />
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={{
            margin: '0 20px 8px', padding: '10px 14px', borderRadius: 10,
            background: 'rgba(239,68,68,0.12)', color: '#f87171', fontSize: 13,
            border: '1px solid rgba(239,68,68,0.25)',
          }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'flex-end',
          padding: '14px 20px 20px',
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '9px 18px', borderRadius: 10,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'var(--foreground, #fff)', fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '9px 24px', borderRadius: 10,
              background: '#2563eb',
              border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.75 : 1,
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
            }}
          >
            {saving ? (
              <>
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'cropSpin 0.7s linear infinite',
                }} />
                Saving…
              </>
            ) : (
              <>
                <Check size={16} /> Save & Apply
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes cropSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
