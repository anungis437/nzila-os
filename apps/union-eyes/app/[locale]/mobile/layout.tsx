import React from 'react';
import { BottomNav } from '@/components/mobile/BottomNav';
import { OfflineBanner } from '@/components/mobile/OfflineBanner';

/**
 * Mobile-specific layout wrapper
 * Provides bottom navigation and offline support for mobile users
 */
export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <OfflineBanner />
      <main className="min-h-screen">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
