/**
 * Public Status Page
 * 
 * Accessible at /status for public monitoring
 */


export const dynamic = 'force-dynamic';

import { StatusPage } from '@/components/monitoring/StatusPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Status | Union Eyes',
  description: 'Real-time status of Union Eyes services and infrastructure',
};

export default function StatusPageRoute() {
  return (
    <div className="min-h-screen bg-background">
      <StatusPage />
    </div>
  );
}

