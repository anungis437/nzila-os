/**
 * Case List with Signal Indicators
 * 
 * Displays active cases with real-time signal detection and severity badges.
 * Integrates with LRO Signals API for automated prioritization.
 * 
 * Feature flags:
 * - lro_signals_ui: Enable signal detection and badges
 * - lro_case_list_filters: Enable severity/state/search filters
 * - lro_signal_details: Enable expandable signal details
 */

'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { 
  detectSignals, 
  getHighestSeverityPerCase,
  type CaseForSignals,
  type Signal,
  type SignalSeverity,
} from '@/lib/services/lro-signals';
import { SignalBadge } from './signal-badge';
import { SignalDetails } from './signal-details';
import { useFeatureFlags } from '@/lib/hooks/use-feature-flags';
import { LRO_FEATURES } from '@/lib/services/feature-flags';

export interface CaseListItem extends CaseForSignals {
  assignedOfficerName?: string;
}

interface CaseListProps {
  cases: CaseListItem[];
  showFilters?: boolean;
  currentUserId?: string;
}

type FilterSeverity = SignalSeverity | 'all';

/**
 * Case list component with integrated signal detection
 */
export function CaseList({ cases, showFilters = true, currentUserId }: CaseListProps) {
  // Feature flags
  const flags = useFeatureFlags([
    LRO_FEATURES.SIGNALS_UI,
    LRO_FEATURES.CASE_LIST_FILTERS,
    LRO_FEATURES.SIGNAL_DETAILS,
  ]);
  
  const [severityFilter, setSeverityFilter] = useState<FilterSeverity>('all');
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detect signals for all cases (only if signals UI feature is enabled)
  const casesWithSignals = useMemo(() => {
    if (!flags[LRO_FEATURES.SIGNALS_UI]) {
      // Feature disabled: return cases without signals
      return cases.map(caseData => ({
        ...caseData,
        signals: [],
        highestSignal: null,
      }));
    }
    
    const currentDate = new Date();
    
    return cases.map(caseData => {
      const signals = detectSignals(caseData, currentDate);
      const highestSignal = signals.length > 0 
        ? getHighestSeverityPerCase(signals)[0] 
        : null;
      
      return {
        ...caseData,
        signals,
        highestSignal,
      };
    });
  }, [cases, flags]);

  // Apply filters
  const filteredCases = useMemo(() => {
    return casesWithSignals.filter(caseData => {
      // Severity filter
      if (severityFilter !== 'all') {
        if (!caseData.highestSignal || caseData.highestSignal.severity !== severityFilter) {
          return false;
        }
      }

      // State filter
      if (stateFilter !== 'all' && caseData.currentState !== stateFilter) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          caseData.title.toLowerCase().includes(query) ||
          caseData.memberName.toLowerCase().includes(query) ||
          caseData.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [casesWithSignals, severityFilter, stateFilter, searchQuery]);

  // Sort by severity (critical first)
  const sortedCases = useMemo(() => {
    const severityOrder: Record<SignalSeverity, number> = {
      critical: 0,
      urgent: 1,
      warning: 2,
      info: 3,
    };

    return [...filteredCases].sort((a, b) => {
      const aOrder = a.highestSignal ? severityOrder[a.highestSignal.severity] : 999;
      const bOrder = b.highestSignal ? severityOrder[b.highestSignal.severity] : 999;
      return aOrder - bOrder;
    });
  }, [filteredCases]);

  // Count by severity for filter badges
  const severityCounts = useMemo(() => {
    return {
      critical: casesWithSignals.filter(c => c.highestSignal?.severity === 'critical').length,
      urgent: casesWithSignals.filter(c => c.highestSignal?.severity === 'urgent').length,
      warning: casesWithSignals.filter(c => c.highestSignal?.severity === 'warning').length,
      all: casesWithSignals.length,
    };
  }, [casesWithSignals]);

  return (
    <div className="space-y-4">
      {/* Filters (only if feature enabled) */}
      {showFilters && flags[LRO_FEATURES.CASE_LIST_FILTERS] && (
        <div className="flex flex-col gap-4 p-4 bg-white rounded-lg border">
          {/* Search */}
          <div>
            <input
              type="text"
              placeholder="Search cases by title, member name, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Severity filters */}
          <div className="flex gap-2 flex-wrap">
            <FilterButton
              active={severityFilter === 'all'}
              onClick={() => setSeverityFilter('all')}
              count={severityCounts.all}
            >
              All Cases
            </FilterButton>
            <FilterButton
              active={severityFilter === 'critical'}
              onClick={() => setSeverityFilter('critical')}
              count={severityCounts.critical}
              variant="critical"
            >
              Critical
            </FilterButton>
            <FilterButton
              active={severityFilter === 'urgent'}
              onClick={() => setSeverityFilter('urgent')}
              count={severityCounts.urgent}
              variant="urgent"
            >
              Urgent
            </FilterButton>
            <FilterButton
              active={severityFilter === 'warning'}
              onClick={() => setSeverityFilter('warning')}
              count={severityCounts.warning}
              variant="warning"
            >
              Warning
            </FilterButton>
          </div>

          {/* State filters */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All States</option>
              <option value="submitted">Submitted</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="investigating">Investigating</option>
              <option value="pending_response">Pending Response</option>
              <option value="negotiating">Negotiating</option>
            </select>
          </div>
        </div>
      )}

      {/* Case count */}
      <div className="text-sm text-gray-600">
        Showing {sortedCases.length} of {cases.length} cases
      </div>

      {/* Case list */}
      <div className="space-y-3">
        {sortedCases.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No cases match your filters
          </div>
        ) : (
          sortedCases.map((caseData) => (
            <CaseListItem
              key={caseData.id}
              caseData={caseData}
              signal={caseData.highestSignal}
              currentUserId={currentUserId}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  count: number;
  variant?: 'critical' | 'urgent' | 'warning';
  children: React.ReactNode;
}

function FilterButton({ active, onClick, count, variant, children }: FilterButtonProps) {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors';
  
  const variantClasses = {
    critical: active
      ? 'bg-red-600 text-white'
      : 'bg-red-50 text-red-700 hover:bg-red-100',
    urgent: active
      ? 'bg-orange-600 text-white'
      : 'bg-orange-50 text-orange-700 hover:bg-orange-100',
    warning: active
      ? 'bg-yellow-600 text-white'
      : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
  };

  const defaultClasses = active
    ? 'bg-blue-600 text-white'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200';

  const classes = variant ? variantClasses[variant] : defaultClasses;

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${classes}`}
    >
      {children} <span className="ml-1 font-bold">({count})</span>
    </button>
  );
}

interface CaseListItemProps {
  caseData: CaseListItem & { signals: Signal[]; highestSignal: Signal | null };
  signal: Signal | null;
  currentUserId?: string;
}

function CaseListItem({ caseData, signal, currentUserId }: CaseListItemProps) {
  const [showDetails, setShowDetails] = useState(false);

  const isAssignedToMe = currentUserId && caseData.assignedOfficerId === currentUserId;

  return (
    <div className="bg-white border rounded-lg hover:shadow-md transition-shadow">
      <Link href={`/dashboard/cases/${caseData.id}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            {/* Left side: Case info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                {/* Signal badge */}
                {signal && <SignalBadge signal={signal} />}
                
                {/* Case ID */}
                <span className="text-sm text-gray-500 font-mono">{caseData.id}</span>
                
                {/* Assigned indicator */}
                {isAssignedToMe && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    Assigned to you
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                {caseData.title}
              </h3>

              {/* Member and state */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>👤 {caseData.memberName}</span>
                <span>•</span>
                <span className="capitalize">
                  {caseData.currentState.replace('_', ' ')}
                </span>
                <span>•</span>
                <span className="capitalize">{caseData.priority} Priority</span>
              </div>
            </div>

            {/* Right side: Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-gray-500">
                Updated {formatRelativeTime(caseData.lastUpdated)}
              </div>
              
              {signal && signal.actionable && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setShowDetails(!showDetails);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {showDetails ? 'Hide Details' : 'Show Details'} →
                </button>
              )}
            </div>
          </div>

          {/* Signal details (expanded) */}
          {showDetails && signal && (
            <div className="mt-4 pt-4 border-t">
              <SignalDetails signal={signal} caseId={caseData.id} />
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

/**
 * Format relative time (e.g., "2 days ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString();
}

