'use client';


export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { SyncStatusButton } from '@/components/mobile/SyncStatus';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface Claim {
  id: string;
  memberName: string;
  type: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  submittedAt?: string;
  createdAt: string;
  synced: boolean;
}

const statusColors = {
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-600',
  under_review: 'bg-yellow-100 text-yellow-600',
  approved: 'bg-green-100 text-green-600',
  rejected: 'bg-red-100 text-red-600',
};

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

/**
 * Mobile claims list page
 * Optimized for mobile with offline support
 */
export default function MobileClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    // Check online status
    setIsOffline(!navigator.onLine);
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Load claims
    loadClaims();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadClaims = async () => {
    setIsLoading(true);
    
    try {
      // Try to fetch from API first
      if (navigator.onLine) {
        const response = await fetch('/api/claims?limit=50');
        if (response.ok) {
          const data = await response.json();
          setClaims(data.claims || []);
          return;
        }
      }
      
      // Fallback to cached data
      const cached = localStorage.getItem('cached_claims');
      if (cached) {
        setClaims(JSON.parse(cached));
      }
    } catch (error) {
      logger.error('Failed to load claims:', error);
      
      // Try cached data
      const cached = localStorage.getItem('cached_claims');
      if (cached) {
        setClaims(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClaims = filter === 'all' 
    ? claims 
    : claims.filter(c => c.status === filter);

  const unsyncedCount = claims.filter(c => !c.synced).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Claims"
        rightContent={
          <div className="flex items-center gap-2">
            {unsyncedCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unsyncedCount} pending
              </span>
            )}
            <SyncStatusButton />
          </div>
        }
      />

      {/* Filter tabs */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex px-4 py-2 gap-2 min-w-max">
          {['all', 'draft', 'submitted', 'under_review', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors',
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {status === 'all' ? 'All' : statusLabels[status as keyof typeof statusLabels]}
            </button>
          ))}
        </div>
      </div>

      {/* Claims list */}
      <div className="p-4 space-y-3">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))
        ) : filteredClaims.length === 0 ? (
          <div className="text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto text-gray-400 mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500 mb-4">No claims found</p>
            <Link
              href="/claims/new"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                  clipRule="evenodd"
                />
              </svg>
              New Claim
            </Link>
          </div>
        ) : (
          filteredClaims.map((claim) => (
            <Link
              key={claim.id}
              href={`/claims/${claim.id}`}
              className="block bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">
                    {claim.memberName}
                  </h3>
                  <p className="text-sm text-gray-500">{claim.type}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn(
                    'px-2 py-0.5 text-xs font-medium rounded-full',
                    statusColors[claim.status]
                  )}>
                    {statusLabels[claim.status]}
                  </span>
                  {!claim.synced && (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-amber-500"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {claim.submittedAt
                  ? `Submitted ${new Date(claim.submittedAt).toLocaleDateString()}`
                  : `Created ${new Date(claim.createdAt).toLocaleDateString()}`}
              </p>
            </Link>
          ))
        )}
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed bottom-20 left-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg text-center text-sm">
          You are offline. Changes will sync when connected.
        </div>
      )}
    </div>
  );
}
