'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleDataItem {
  date?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  appointmentDate?: string | null;
  appointment_date?: string | null;
  [key: string]: unknown;
}

export interface ModuleConfig {
  key: string;
  label: string;
  color: string;
  data: ModuleDataItem[];
}

interface ChartPoint {
  month: string;
  [moduleKey: string]: number | string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthLabel(d: Date): string {
  return `${MONTH_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
}

function extractDate(item: ModuleDataItem): Date | null {
  const raw =
    item.appointmentDate ??
    item.appointment_date ??
    item.createdAt ??
    item.created_at ??
    item.date ??
    null;
  if (!raw) return null;
  const d = new Date(raw as string);
  return isNaN(d.getTime()) ? null : d;
}

function buildChartData(modules: ModuleConfig[]): ChartPoint[] {
  const now = new Date();
  const months: Array<{ label: string; year: number; month: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ label: getMonthLabel(d), year: d.getFullYear(), month: d.getMonth() });
  }

  const counts: Record<string, Record<string, number>> = {};
  modules.forEach((mod) => {
    counts[mod.key] = {};
    months.forEach((m) => { counts[mod.key][m.label] = 0; });

    mod.data.forEach((item) => {
      const d = extractDate(item);
      if (!d) return;
      const label = getMonthLabel(d);
      if (counts[mod.key][label] !== undefined) {
        counts[mod.key][label] += 1;
      }
    });
  });

  return months.map((m) => {
    const point: ChartPoint = { month: m.label };
    modules.forEach((mod) => {
      point[mod.key] = counts[mod.key][m.label] ?? 0;
    });
    return point;
  });
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 10,
        padding: '10px 14px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}
    >
      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((entry: any) => (
        <div
          key={entry.dataKey}
          style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--foreground)', fontWeight: 500 }}>
            {entry.name}:
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: entry.color }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Filter Tab ────────────────────────────────────────────────────────────────

function FilterTab({
  label, color, active, onClick,
}: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 99,
        border: `1.5px solid ${active ? color : 'var(--card-border)'}`,
        background: active ? `${color}18` : 'transparent',
        color: active ? color : 'var(--muted)',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: active ? color : 'var(--card-border)',
          transition: 'background 0.18s ease',
        }}
      />
      {label}
    </button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface ModuleStatsChartProps {
  modules: ModuleConfig[];
  loading?: boolean;
}

export default function ModuleStatsChart({ modules, loading }: ModuleStatsChartProps) {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(
    () => new Set(modules.map((m) => m.key))
  );

  const chartData = useMemo(() => buildChartData(modules), [modules]);

  const toggleKey = (key: string) => {
    setActiveKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const visibleModules = modules.filter((m) => activeKeys.has(m.key));

  const totalActivity = useMemo(() => {
    return modules.reduce((sum, mod) => sum + mod.data.length, 0);
  }, [modules]);

  return (
    <div
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.06)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 20,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={20} style={{ color: '#3b82f6' }} />
          </div>
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              Module Statistics
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              Monthly trend — last 8 months ·{' '}
              <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>
                {loading ? '…' : totalActivity.toLocaleString()}
              </span>{' '}
              total records
            </p>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {modules.map((mod) => (
            <FilterTab
              key={mod.key}
              label={mod.label}
              color={mod.color}
              active={activeKeys.has(mod.key)}
              onClick={() => toggleKey(mod.key)}
            />
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div
          style={{
            height: 280,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted)',
            fontSize: 13,
          }}
        >
          Loading chart data…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="4 4"
              stroke="var(--card-border)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'var(--muted)', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted)', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--card-border)', strokeWidth: 1.5 }} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              iconType="circle"
              iconSize={9}
            />
            {visibleModules.map((mod) => (
              <Line
                key={mod.key}
                type="monotone"
                dataKey={mod.key}
                name={mod.label}
                stroke={mod.color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: mod.color, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: mod.color, stroke: 'var(--card-bg)', strokeWidth: 2 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Summary footer */}
      {!loading && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--card-border)',
          }}
        >
          {modules.map((mod) => {
            const lastPt = chartData[chartData.length - 1];
            const prevPt = chartData[chartData.length - 2];
            const last = Number(lastPt?.[mod.key] ?? 0);
            const prev = Number(prevPt?.[mod.key] ?? 0);
            const diff = last - prev;
            const up = diff >= 0;
            return (
              <div key={mod.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: mod.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>
                  {mod.label}:
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                  {mod.data.length}
                </span>
                {diff !== 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: up ? '#10b981' : '#ef4444',
                      background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                      padding: '1px 6px',
                      borderRadius: 99,
                    }}
                  >
                    {up ? '+' : ''}{diff} MoM
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
