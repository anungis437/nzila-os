'use client';


export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/MobileHeader';
import { SyncStatusButton } from '@/components/mobile/SyncStatus';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  localUnion?: string;
  synced: boolean;
}

/**
 * Mobile members list page
 * Optimized for mobile with search and offline support
 */
export default function MobileMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    loadMembers();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    
    try {
      if (navigator.onLine) {
        const response = await fetch('/api/members?limit=50');
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
          return;
        }
      }
      
      const cached = localStorage.getItem('cached_members');
      if (cached) {
        setMembers(JSON.parse(cached));
      }
    } catch (error) {
      logger.error('Failed to load members:', error);
      const cached = localStorage.getItem('cached_members');
      if (cached) {
        setMembers(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = 
      searchQuery === '' ||
      `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'all' || 
      member.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const unsyncedCount = members.filter(m => !m.synced).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileHeader
        title="Members"
        rightContent={
          <div className="flex items-center gap-2">
            {unsyncedCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                {unsyncedCount}
              </span>
            )}
            <SyncStatusButton />
          </div>
        }
      />

      {/* Search bar */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-200 p-4">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status filter */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {['all', 'active', 'inactive', 'pending'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full whitespace-nowrap transition-colors',
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Members list */}
      <div className="p-4 space-y-2">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : filteredMembers.length === 0 ? (
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <p className="text-gray-500">
              {searchQuery ? 'No members match your search' : 'No members found'}
            </p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <Link
              key={member.id}
              href={`/members/${member.id}`}
              className="block bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                  member.status === 'active' ? 'bg-green-500' :
                  member.status === 'pending' ? 'bg-yellow-500' :
                  'bg-gray-400'
                )}>
                  {member.firstName[0]}{member.lastName[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900 truncate">
                      {member.firstName} {member.lastName}
                    </h3>
                    {!member.synced && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-amber-500 shrink-0"
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
                  <p className="text-sm text-gray-500 truncate">{member.email}</p>
                  {member.localUnion && (
                    <p className="text-xs text-gray-400">{member.localUnion}</p>
                  )}
                </div>

                {/* Status badge */}
                <span className={cn(
                  'px-2 py-1 text-xs font-medium rounded-full',
                  member.status === 'active' && 'bg-green-100 text-green-700',
                  member.status === 'pending' && 'bg-yellow-100 text-yellow-700',
                  member.status === 'inactive' && 'bg-gray-100 text-gray-600'
                )}>
                  {member.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed bottom-20 left-4 right-4 bg-amber-500 text-white px-4 py-2 rounded-lg text-center text-sm">
          Offline mode - viewing cached data
        </div>
      )}
    </div>
  );
}
