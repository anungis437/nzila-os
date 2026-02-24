'use client';


export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { SyncStatus } from '@/components/mobile/SyncStatus';
import { useNetworkStatus } from '@/lib/mobile/service-worker-registration';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface DashboardStats {
  pendingClaims: number;
  activeMembers: number;
  unreadMessages: number;
  upcomingDeadlines: number;
}

/**
 * Mobile Dashboard Page
 * Main entry point for mobile users with quick stats and actions
 */
export default function MobileDashboardPage() {
  const { isOnline } = useNetworkStatus();
  const [stats, setStats] = useState<DashboardStats>({
    pendingClaims: 0,
    activeMembers: 0,
    unreadMessages: 0,
    upcomingDeadlines: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    try {
      // Fetch stats from API (would be real API in production)
      if (isOnline) {
        // Simulated API response
        setStats({
          pendingClaims: 5,
          activeMembers: 1247,
          unreadMessages: 3,
          upcomingDeadlines: 2,
        });
      } else {
        // Load from cache
        const cached = localStorage.getItem('dashboard_stats');
        if (cached) {
          setStats(JSON.parse(cached));
        }
      }
    } catch (error) {
      logger.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    {
      title: 'New Claim',
      description: 'Submit a new grievance claim',
      href: '/claims/new',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'bg-blue-500',
    },
    {
      title: 'Find Member',
      description: 'Search member directory',
      href: '/members',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      color: 'bg-green-500',
    },
    {
      title: 'Messages',
      description: 'View unread messages',
      href: '/messages',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      color: 'bg-purple-500',
      badge: stats.unreadMessages > 0 ? stats.unreadMessages : undefined,
    },
    {
      title: 'Documents',
      description: 'Access union documents',
      href: '/documents',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Union Eyes"
        rightContent={<SyncStatus showDetails />}
      />

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm">
          You&apos;re offline. Some features may be limited.
        </div>
      )}

      {/* Quick Stats */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Pending Claims"
            value={stats.pendingClaims}
            isLoading={isLoading}
            color="blue"
            href="/claims?filter=pending"
          />
          <StatCard
            title="Active Members"
            value={stats.activeMembers}
            isLoading={isLoading}
            color="green"
            href="/members"
          />
          <StatCard
            title="Messages"
            value={stats.unreadMessages}
            isLoading={isLoading}
            color="purple"
            href="/messages"
            highlight={stats.unreadMessages > 0}
          />
          <StatCard
            title="Deadlines"
            value={stats.upcomingDeadlines}
            isLoading={isLoading}
            color="red"
            href="/calendar"
            highlight={stats.upcomingDeadlines > 0}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-white mb-3', action.color)}>
                {action.icon}
              </div>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{action.title}</h3>
                {action.badge && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {action.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-100">
          <ActivityItem
            title="Claim #1234 updated"
            description="Status changed to Under Review"
            time="2 hours ago"
          />
          <ActivityItem
            title="New member joined"
            description="John Smith from Local 1001"
            time="5 hours ago"
          />
          <ActivityItem
            title="Document uploaded"
            description="CBA 2024 Summary.pdf"
            time="Yesterday"
          />
        </div>
      </div>

      {/* Sync Status Footer */}
      <div className="p-4 pb-24">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Sync Status</h3>
              <p className="text-sm text-gray-500">
                {isOnline ? 'Connected' : 'Offline mode'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'w-3 h-3 rounded-full',
                isOnline ? 'bg-green-500' : 'bg-amber-500'
              )} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  isLoading, 
  color, 
  href,
  highlight 
}: { 
  title: string; 
  value: number; 
  isLoading: boolean;
  color: string;
  href: string;
  highlight?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <Link href={href} className="bg-white rounded-lg p-4 shadow-sm">
      {isLoading ? (
        <div className="animate-pulse">
          <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
          <div className="h-6 bg-gray-200 rounded w-12" />
        </div>
      ) : (
        <>
          <p className="text-xs text-gray-500">{title}</p>
          <p className={cn('text-2xl font-bold mt-1', colorClasses[color], highlight && 'animate-pulse')}>
            {value}
          </p>
        </>
      )}
    </Link>
  );
}

function ActivityItem({ 
  title, 
  description, 
  time 
}: { 
  title: string; 
  description: string; 
  time: string; 
}) {
  return (
    <div className="p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900">{title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <span className="text-xs text-gray-400 ml-2 shrink-0">{time}</span>
      </div>
    </div>
  );
}
