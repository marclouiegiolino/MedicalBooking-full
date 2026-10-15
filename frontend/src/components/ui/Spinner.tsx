'use client';

interface SpinnerProps {
  size?: 'sm' | 'lg';
  center?: boolean;
}

export default function Spinner({ size, center }: SpinnerProps) {
  const el = <div className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} />;
  if (center) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        {el}
      </div>
    );
  }
  return el;
}
