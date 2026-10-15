'use client';
import { LucideIcon, TrendingUp } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  trend?: string;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
}

export default function StatCard({ label, value, sub, trend, icon: Icon, iconColor = '#1e40af', iconBg = '#dbeafe' }: StatCardProps) {
  return (
    <div className="stat-card">
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {sub && <p className="stat-sub">{sub}</p>}
        {trend && (
          <p className="stat-trend">
            <TrendingUp size={12} />
            {trend}
          </p>
        )}
      </div>
      <div className="stat-icon" style={{ background: iconBg }}>
        <Icon size={20} color={iconColor} />
      </div>
    </div>
  );
}
