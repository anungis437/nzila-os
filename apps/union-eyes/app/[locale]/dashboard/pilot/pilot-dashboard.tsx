/**
 * Pilot Dashboard Page
 * 
 * Displays pilot health metrics, milestones, and progress tracking.
 * 
 * - NZILA Ventures (platform owner): sees an overview of ALL pilot orgs
 * - Pilot orgs (CUPE, CAPE, CLC): see only their own org's metrics
 */

'use client';

import Link from 'next/link';

import { useState, useEffect } from 'react';
import { PilotMetrics } from '@/types/marketing';
import { calculatePilotHealthBreakdown, getHealthScoreStatus } from '@/lib/pilot/health-scoring';
import { SystemStatusBadge } from '@/components/marketing/system-status-badge';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

export default function PilotDashboard() {
  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [allOrgs, setAllOrgs] = useState<PilotMetrics[] | null>(null);
  const [isPlatformView, setIsPlatformView] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        // Try to load the platform overview first (only succeeds for NZILA)
        const overviewRes = await fetch('/api/pilot/overview');
        if (overviewRes.ok) {
          const data = await overviewRes.json();
          if (data.organizations && data.organizations.length > 0) {
            setAllOrgs(data.organizations);
            setIsPlatformView(true);
            setLoading(false);
            return;
          }
        }

        // Fallback: load single-org metrics
        const response = await fetch('/api/pilot/current');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
        }
      } catch (error) {
        logger.error('Failed to load pilot metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  if (loading) {
    return (
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">Loading pilot metrics...</p>
        </div>
      </div>
    );
  }

  // Platform view: show all pilot orgs
  if (isPlatformView && allOrgs) {
    const activeMetrics = selectedOrg
      ? allOrgs.find((o) => o.organizationId === selectedOrg) ?? null
      : null;

    if (activeMetrics) {
      return (
        <div className="py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <button
              onClick={() => setSelectedOrg(null)}
              className="text-blue-600 hover:text-blue-800 font-medium mb-6 inline-flex items-center gap-1"
            >
              ← Back to Overview
            </button>
            <OrgPilotDetail metrics={activeMetrics} />
          </div>
        </div>
      );
    }

    return <PlatformOverview orgs={allOrgs} onSelectOrg={setSelectedOrg} />;
  }

  // Single org view (pilot org sees its own data)
  if (!metrics) {
    return (
      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            No Active Pilot
          </h1>
          <p className="text-gray-600 mb-6">
            You don&apos;t currently have an active pilot program.
          </p>
          <Link href="/pilot-request"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
          >
            Apply for Pilot Program
          </Link>
        </div>
      </div>
    );
  }

  return <OrgPilotDetail metrics={metrics} />;
}

// ============================================================================
// Platform Overview (NZILA sees all pilot orgs)
// ============================================================================

function PlatformOverview({
  orgs,
  onSelectOrg,
}: {
  orgs: PilotMetrics[];
  onSelectOrg: (id: string) => void;
}) {
  // Aggregate stats
  const avgHealth =
    orgs.length > 0
      ? Math.round(orgs.reduce((s, o) => s + o.healthScore, 0) / orgs.length)
      : 0;
  const totalCases = orgs.reduce((s, o) => s + o.casesManaged, 0);
  const allMilestones = orgs.flatMap((o) => o.milestones);
  const completedMilestones = allMilestones.filter(
    (m) => m.status === 'complete'
  ).length;

  return (
    <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pilot Program Overview
          </h1>
          <p className="text-gray-600">
            Cross-organization view of all active pilots
          </p>
        </div>

        <HumanCenteredCallout
          variant="transparency"
          message="All metrics are calculated from system usage data. No individual surveillance—only organizational health."
          className="mb-8"
        />

        {/* Aggregate KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-sm font-medium text-gray-500 mb-1">
              Active Pilots
            </div>
            <div className="text-4xl font-bold text-gray-900">{orgs.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-sm font-medium text-gray-500 mb-1">
              Avg Health Score
            </div>
            <div
              className="text-4xl font-bold"
              style={{
                color:
                  avgHealth >= 75
                    ? '#10b981'
                    : avgHealth >= 50
                      ? '#f59e0b'
                      : '#ef4444',
              }}
            >
              {avgHealth}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-sm font-medium text-gray-500 mb-1">
              Total Cases (30d)
            </div>
            <div className="text-4xl font-bold text-gray-900">{totalCases}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="text-sm font-medium text-gray-500 mb-1">
              Milestones Done
            </div>
            <div className="text-4xl font-bold text-teal-600">
              {completedMilestones}/{allMilestones.length}
            </div>
          </div>
        </div>

        {/* Per-org cards */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Organization Status
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {orgs
            .sort((a, b) => b.healthScore - a.healthScore)
            .map((org) => {
              const breakdown = calculatePilotHealthBreakdown(org);
              const status = getHealthScoreStatus(breakdown.overall);
              const milestoneDone = org.milestones.filter(
                (m) => m.status === 'complete'
              ).length;

              return (
                <button
                  key={org.organizationId}
                  onClick={() => onSelectOrg(org.organizationId)}
                  className="bg-white rounded-lg shadow-sm p-6 text-left hover:shadow-md transition-shadow w-full"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {org.organizationName ?? org.pilotId}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {org.daysActive} days active
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-3xl font-bold"
                        style={{
                          color:
                            status.status === 'excellent'
                              ? '#10b981'
                              : status.status === 'good'
                                ? '#3b82f6'
                                : status.status === 'needs-attention'
                                  ? '#f59e0b'
                                  : '#ef4444',
                        }}
                      >
                        {breakdown.overall}
                      </div>
                      <SystemStatusBadge
                        system={status.status.replace('-', ' ')}
                        status={
                          status.status === 'excellent' ||
                          status.status === 'good'
                            ? 'active'
                            : 'degraded'
                        }
                      />
                    </div>
                  </div>

                  {/* Mini bar */}
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${breakdown.overall}%`,
                        backgroundColor:
                          status.status === 'excellent'
                            ? '#10b981'
                            : status.status === 'good'
                              ? '#3b82f6'
                              : status.status === 'needs-attention'
                                ? '#f59e0b'
                                : '#ef4444',
                      }}
                    />
                  </div>

                  {/* Quick stats row */}
                  <div className="grid grid-cols-4 gap-3 text-center text-sm">
                    <div>
                      <div className="font-semibold text-gray-900">
                        {org.organizerAdoptionRate}%
                      </div>
                      <div className="text-gray-500">Adoption</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {org.memberEngagementRate}%
                      </div>
                      <div className="text-gray-500">Engagement</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {org.casesManaged}
                      </div>
                      <div className="text-gray-500">Cases</div>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {milestoneDone}/{org.milestones.length}
                      </div>
                      <div className="text-gray-500">Milestones</div>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>

        {/* Support Section */}
        <div className="bg-indigo-600 text-white rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Pilot Program Management</h2>
          <p className="text-lg mb-6 text-indigo-100">
            Click any organization above to view detailed health metrics,
            milestones, and recommendations.
          </p>
          <div className="flex gap-4 justify-center">
            <a
              href="mailto:pilot-support@unioneyes.org"
              className="bg-white text-indigo-600 px-6 py-3 rounded-md font-medium hover:bg-indigo-50 transition-colors"
            >
              Pilot Support
            </a>
            <Link
              href="/dashboard/trust"
              className="bg-indigo-700 text-white px-6 py-3 rounded-md font-medium hover:bg-indigo-800 transition-colors"
            >
              System Trust Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Org Pilot Detail (used for both single-org and drill-down views)
// ============================================================================

function OrgPilotDetail({ metrics }: { metrics: PilotMetrics }) {
  const breakdown = calculatePilotHealthBreakdown(metrics);
  const status = getHealthScoreStatus(breakdown.overall);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {metrics.organizationName
            ? `${metrics.organizationName} — Pilot Dashboard`
            : 'Pilot Program Dashboard'}
        </h1>
        <p className="text-gray-600">
          Track pilot health, milestones, and progress
        </p>
      </div>

      <HumanCenteredCallout
        variant="transparency"
        message="All metrics are calculated from system usage data. No individual surveillance—only organizational health."
        className="mb-8"
      />

      {/* Overall Health Score */}
      <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">
              Overall Pilot Health
            </h2>
            <p className="text-gray-600">
              Days active: <strong>{metrics.daysActive}</strong>
            </p>
          </div>
          <div className="text-right">
            <div className="text-5xl font-bold mb-2" style={{
              color:
                status.status === 'excellent' ? '#10b981' :
                status.status === 'good' ? '#3b82f6' :
                status.status === 'needs-attention' ? '#f59e0b' :
                '#ef4444'
            }}>
              {breakdown.overall}
            </div>
            <SystemStatusBadge
              system={status.status.replace('-', ' ')}
              status={status.status === 'excellent' || status.status === 'good' ? 'active' : 'degraded'}
            />
          </div>
        </div>

        {/* Color-coded bar */}
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${breakdown.overall}%`,
              backgroundColor:
                status.status === 'excellent' ? '#10b981' :
                status.status === 'good' ? '#3b82f6' :
                status.status === 'needs-attention' ? '#f59e0b' :
                '#ef4444'
            }}
          />
        </div>

        {/* Recommendations */}
        {status.recommendations.length > 0 && (
          <div className="mt-6 bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">
              Recommendations
            </h3>
            <ul className="space-y-1 text-sm text-gray-700">
              {status.recommendations.map((rec, idx) => (
                <li key={idx}>• {rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Health Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Organizer Adoption</h3>
          <div className="text-4xl font-bold text-blue-600 mb-2">{breakdown.adoption}</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-blue-600 transition-all duration-500" style={{ width: `${breakdown.adoption}%` }} />
          </div>
          <p className="text-sm text-gray-600">{metrics.organizerAdoptionRate}% of organizers actively using the system</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Member Engagement</h3>
          <div className="text-4xl font-bold text-green-600 mb-2">{breakdown.engagement}</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-green-600 transition-all duration-500" style={{ width: `${breakdown.engagement}%` }} />
          </div>
          <p className="text-sm text-gray-600">{metrics.memberEngagementRate}% of members have interacted with the system</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Usage</h3>
          <div className="text-4xl font-bold text-purple-600 mb-2">{breakdown.usage}</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-purple-600 transition-all duration-500" style={{ width: `${breakdown.usage}%` }} />
          </div>
          <p className="text-sm text-gray-600">{metrics.casesManaged} cases managed this month</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Effectiveness</h3>
          <div className="text-4xl font-bold text-orange-600 mb-2">{breakdown.effectiveness}</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-orange-600 transition-all duration-500" style={{ width: `${breakdown.effectiveness}%` }} />
          </div>
          <p className="text-sm text-gray-600">Average time to resolution: {metrics.avgTimeToResolution} hours</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Milestone Progress</h3>
          <div className="text-4xl font-bold text-teal-600 mb-2">{breakdown.progress}</div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-teal-600 transition-all duration-500" style={{ width: `${breakdown.progress}%` }} />
          </div>
          <p className="text-sm text-gray-600">
            {metrics.milestones.filter(m => m.status === 'complete').length} of {metrics.milestones.length} milestones complete
          </p>
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Pilot Milestones</h2>
        <div className="space-y-4">
          {metrics.milestones.map((milestone, idx) => (
            <div key={idx} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg">
              <div className="shrink-0 mt-1">
                {milestone.status === 'complete' ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                ) : milestone.status === 'in-progress' ? (
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  </div>
                ) : milestone.status === 'blocked' ? (
                  <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                ) : (
                  <div className="w-6 h-6 bg-gray-300 rounded-full" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{milestone.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    milestone.status === 'complete' ? 'bg-green-100 text-green-800' :
                    milestone.status === 'in-progress' ? 'bg-blue-100 text-blue-800' :
                    milestone.status === 'blocked' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {milestone.status}
                  </span>
                </div>
                {milestone.targetDate && (
                  <p className="text-sm text-gray-500 mt-2">
                    Target: {new Date(milestone.targetDate).toLocaleDateString('en-US')}
                  </p>
                )}
                {milestone.completedAt && (
                  <p className="text-sm text-green-600 mt-2">
                    Completed: {new Date(milestone.completedAt).toLocaleDateString('en-US')}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Support Section */}
      <div className="bg-blue-600 text-white rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Need Support?</h2>
        <p className="text-lg mb-6 text-blue-100">
          Our team is here to help you succeed. Reach out anytime with questions or concerns.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="mailto:pilot-support@unioneyes.org"
            className="bg-white text-blue-600 px-6 py-3 rounded-md font-medium hover:bg-blue-50 transition-colors"
          >
            Email Support
          </a>
          <Link href="/dashboard/trust"
            className="bg-blue-700 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-800 transition-colors"
          >
            System Trust Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
