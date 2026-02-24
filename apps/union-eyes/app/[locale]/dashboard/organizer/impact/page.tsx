/**
 * Organizer Impact Dashboard
 * 
 * Shows organizer's impact metrics WITHOUT creating surveillance pressure.
 * Focus: Member outcomes, personal growth, celebration (NOT comparison/competition)
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { OrganizerImpact } from '@/types/marketing';
import { getImpactSummary, compareImpactPeriods } from '@/lib/marketing/organizer-impact';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
import { logger } from '@/lib/logger';

export default function OrganizerImpactPage() {
  const [currentImpact, setCurrentImpact] = useState<OrganizerImpact | null>(null);
  const [previousImpact, setPreviousImpact] = useState<OrganizerImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    async function loadImpact() {
      try {
        const response = await fetch(`/api/organizer/impact?period=${period}`);
        if (response.ok) {
          const data = await response.json();
          setCurrentImpact(data.current);
          setPreviousImpact(data.previous);
        }
      } catch (error) {
        logger.error('Failed to load impact data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadImpact();
  }, [period]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-600">Loading your impact...</p>
        </div>
      </div>
    );
  }

  if (!currentImpact) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Your Impact Dashboard
          </h1>
          <p className="text-gray-600 mb-6">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            Start handling cases to see your impact on members' lives.
          </p>
        </div>
      </div>
    );
  }

  const summary = getImpactSummary(currentImpact);
  const comparisons = previousImpact
    ? compareImpactPeriods(currentImpact, previousImpact)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Your Impact
          </h1>
          <p className="text-lg text-gray-600">
            {/* eslint-disable-next-line react/no-unescaped-entities */}
            See the difference you&apos;re making in members' lives
          </p>
        </div>

        <HumanCenteredCallout
          variant="solidarity"
          message="These metrics celebrate your impact, not measure your productivity. Every member you help matters, regardless of numbers."
          className="mb-8"
        />

        {/* Period Selector */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                period === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('quarter')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                period === 'quarter'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              This Quarter
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                period === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              This Year
            </button>
          </div>
        </div>

        {/* Headline */}
        <div className="bg-linear-to-r from-blue-600 to-blue-800 text-white rounded-lg p-8 mb-8">
          <h2 className="text-3xl font-bold mb-2">{summary.headline}</h2>
          <p className="text-xl text-blue-100">
            {currentImpact.casesHandled} member{currentImpact.casesHandled !== 1 ? 's' : ''} supported this{' '}
            {period === 'month' ? 'month' : period === 'quarter' ? 'quarter' : 'year'}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{currentImpact.casesWon}</p>
                <p className="text-sm text-gray-600">Positive Outcomes</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {currentImpact.memberSatisfactionAvg.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Avg Satisfaction</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {Math.round(currentImpact.avgResolutionTime)}
                </p>
                <p className="text-sm text-gray-600">Avg Days to Resolve</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                </svg>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {currentImpact.democraticParticipationRate}%
                </p>
                <p className="text-sm text-gray-600">Member Participation</p>
              </div>
            </div>
          </div>
        </div>

        {/* Highlights */}
        {summary.highlights.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ✨ Highlights
            </h2>
            <ul className="space-y-2">
              {summary.highlights.map((highlight, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-green-600 text-xl mr-3">✓</span>
                  <span className="text-gray-800">{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Growth Comparisons */}
        {comparisons.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Your Growth
            </h2>
            <p className="text-gray-600 mb-6">
              Comparing this {period} to last {period}
            </p>
            <div className="space-y-4">
              {comparisons.map((comp, idx) => (
                <div key={idx} className="border-l-4 border-gray-200 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900">{comp.metric}</h3>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        comp.improving
                          ? 'bg-green-100 text-green-800'
                          : comp.change === 0
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {comp.change > 0 ? '+' : ''}
                      {comp.change} ({comp.changePercent > 0 ? '+' : ''}
                      {comp.changePercent}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>Previous: {comp.previousValue}</span>
                    <span>→</span>
                    <span className="font-medium text-gray-900">
                      Current: {comp.currentValue}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Areas for Growth */}
        {summary.areasForGrowth.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-3">
              💡 Opportunities
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              These are suggestions, not requirements. Focus on what matters most to your members.
            </p>
            <ul className="space-y-2">
              {summary.areasForGrowth.map((area, idx) => (
                <li key={idx} className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span className="text-gray-800">{area}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recognition Events */}
        {currentImpact.recognitionEvents.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              🏆 Recognition
            </h2>
            <div className="space-y-3">
              {currentImpact.recognitionEvents.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-4 bg-linear-to-r from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg"
                >
                  <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-xl">⭐</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{event.description}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Philosophy Note */}
        <div className="bg-gray-100 rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-2">
            About These Metrics
          </h3>
          <p className="text-sm text-gray-700">
            These numbers reflect your <strong>impact on members&apos; lives</strong>, not your individual
            performance. There are no quotas, no rankings, and no comparisons to other stewards.
            Every case you handle matters, regardless of these numbers. Use this dashboard to
            celebrate your wins and identify areas where you want to grow—on your own terms.
          </p>
        </div>
      </div>
    </div>
  );
}
