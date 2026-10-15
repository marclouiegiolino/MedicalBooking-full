'use client';
import { Settings, Bell, Shield, Database, Globe, Users } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';

export default function SettingsPage() {
  const { isAdmin } = useAuth();

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your account and application preferences</p>
          </div>
        </div>

        <div className="grid-main">
          <div className="space-y-5">
            {/* Notification Settings */}
            <Card className="card-p">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Bell size={18} style={{ color:'var(--primary)' }} />
                </div>
                <div>
                  <p className="section-title">Notification Preferences</p>
                  <p className="text-xs text-muted">Configure how you receive alerts</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { label:'Appointment reminders', desc:'Get notified 1 hour before appointments', on:true },
                  { label:'New messages',           desc:'Notifications for doctor messages',       on:true },
                  { label:'Lab results',            desc:'Alerts when results are uploaded',        on:true },
                  { label:'Prescription renewals',  desc:'Reminders for upcoming renewals',        on:false },
                ].map((item) => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
                    <div>
                      <p className="font-medium text-sm" style={{ color:'var(--foreground)' }}>{item.label}</p>
                      <p className="text-xs text-muted" style={{ marginTop:2 }}>{item.desc}</p>
                    </div>
                    <div style={{
                      width:42, height:24, borderRadius:12, position:'relative', cursor:'pointer',
                      background: item.on ? 'var(--primary)' : '#d1d5db', transition:'var(--transition)',
                    }}>
                      <div style={{
                        position:'absolute', top:3, left: item.on ? 21 : 3,
                        width:18, height:18, borderRadius:'50%', background:'white',
                        transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Security */}
            <Card className="card-p">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'#d1fae5', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Shield size={18} style={{ color:'var(--success)' }} />
                </div>
                <div>
                  <p className="section-title">Security</p>
                  <p className="text-xs text-muted">Password and account security</p>
                </div>
              </div>
              <div className="space-y-3">
                <Button variant="secondary" fullWidth>Change Password</Button>
                <Button variant="ghost" fullWidth className="btn-outline">Enable Two-Factor Auth</Button>
                <Button variant="ghost" fullWidth className="btn-outline">View Login History</Button>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            {/* App settings */}
            <Card className="card-p">
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Globe size={18} style={{ color:'#7c3aed' }} />
                </div>
                <p className="section-title">General</p>
              </div>
              <div className="space-y-4">
                {[
                  { label:'Language',  value:'English (US)' },
                  { label:'Timezone', value:'Asia/Manila (UTC+8)' },
                  { label:'Date Format', value:'MM/DD/YYYY' },
                ].map((item) => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <p className="text-sm text-muted">{item.label}</p>
                    <p className="text-sm font-medium" style={{ color:'var(--foreground)' }}>{item.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            {isAdmin() && (
              <Card className="card-p">
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:'var(--warning-bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Database size={18} style={{ color:'var(--warning)' }} />
                  </div>
                  <div>
                    <p className="section-title">Admin Settings</p>
                    <p className="text-xs text-muted">System configuration</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Button variant="secondary" fullWidth icon={Users}>Manage User Roles</Button>
                  <Button variant="ghost" fullWidth className="btn-outline" icon={Database}>Database Backup</Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
