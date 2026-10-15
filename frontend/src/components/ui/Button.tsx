'use client';
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
  title?: string;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  className = '',
  style,
  icon: Icon,
  iconRight: IconRight,
  disabled,
  loading,
  type = 'button',
  fullWidth,
  title,
}: ButtonProps) {
  const iconSize = size === 'sm' ? 13 : size === 'lg' ? 17 : 15;

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled || loading}
      style={style}
      className={`btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''} ${className}`}
    >
      {loading ? (
        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
      ) : (
        Icon && <Icon size={iconSize} />
      )}
      {children}
      {IconRight && !loading && <IconRight size={iconSize} />}
    </button>
  );
}
