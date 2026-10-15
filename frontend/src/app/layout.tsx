import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { default: 'MediBook', template: '%s | MediBook' },
  description: 'Modern medical appointment booking and patient management platform.',
  keywords: ['medical', 'appointments', 'doctors', 'healthcare', 'telemedicine'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1e40af',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

