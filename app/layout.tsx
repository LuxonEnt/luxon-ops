import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Luxon Ops',
  description: 'Contractor scheduling, time tracking, payroll, and invoices.',
  manifest: '/manifest.json',
  themeColor: '#0f172a',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
