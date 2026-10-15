'use client';
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({ children, className = '', style, onClick, hover = false, ...rest }: CardProps) {
  return (
    <div
      className={`card ${className}`}
      style={{ ...(onClick || hover ? { cursor: 'pointer' } : {}), ...style }}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  );
}

