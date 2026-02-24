/**
 * Pilot Dashboard Page
 * 
 * Displays pilot health metrics, milestones, and progress tracking
 * for organizations participating in the Union Eyes pilot program.
 */

'use client';

export const dynamic = 'force-dynamic';
import Link from 'next/link';

import { useState, useEffect } from 'react';
import { PilotMetrics } from '@/types/marketing';
import { calculatePilotHealthBreakdown, getHealthScoreStatus } from '@/lib/pilot/health-scoring';
import { SystemStatusBadge } from '@/components/marketing/system-status-badge';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

export default function PilotDashboardPage() {
  const [metrics, setMetrics] = useState<PilotMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMetrics() {
      try {
        // In production, this would fetch based on authenticated user's organization
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
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">Loading pilot metrics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
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

  const breakdown = calculatePilotHealthBreakdown(metrics);
  const status = getHealthScoreStatus(breakdown.overall);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Pilot Program Dashboard
          </h1>
          <p className="text-gray-600">
            Track your pilot health, milestones, and progress
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
          {/* Adoption */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Organizer Adoption
            </h3>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {breakdown.adoption}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${breakdown.adoption}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {metrics.organizerAdoptionRate}% of organizers actively using the system
            </p>
          </div>

          {/* Engagement */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Member Engagement
            </h3>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {breakdown.engagement}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-green-600 transition-all duration-500"
                style={{ width: `${breakdown.engagement}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {metrics.memberEngagementRate}% of members have interacted with the system
            </p>
          </div>

          {/* Usage */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              System Usage
            </h3>
            <div className="text-4xl font-bold text-purple-600 mb-2">
              {breakdown.usage}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-purple-600 transition-all duration-500"
                style={{ width: `${breakdown.usage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {metrics.casesManaged} cases managed this month
            </p>
          </div>

          {/* Effectiveness */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Effectiveness
            </h3>
            <div className="text-4xl font-bold text-orange-600 mb-2">
              {breakdown.effectiveness}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-orange-600 transition-all duration-500"
                style={{ width: `${breakdown.effectiveness}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              Average time to resolution: {metrics.avgTimeToResolution} hours
            </p>
          </div>

          {/* Progress */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Milestone Progress
            </h3>
            <div className="text-4xl font-bold text-teal-600 mb-2">
              {breakdown.progress}
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-teal-600 transition-all duration-500"
                style={{ width: `${breakdown.progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">
              {metrics.milestones.filter(m => m.status === 'complete').length} of {metrics.milestones.length} milestones complete
            </p>
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Pilot Milestones
          </h2>
          <div className="space-y-4">
            {metrics.milestones.map((milestone, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
              >
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
                      <h3 className="font-semibold text-gray-900">
                        {milestone.name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {milestone.description}
                      </p>
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
                      ✓ Completed: {new Date(milestone.completedAt).toLocaleDateString('en-US')}
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
            <Link href="/trust"
              className="bg-blue-700 text-white px-6 py-3 rounded-md font-medium hover:bg-blue-800 transition-colors"
            >
              System Trust Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
