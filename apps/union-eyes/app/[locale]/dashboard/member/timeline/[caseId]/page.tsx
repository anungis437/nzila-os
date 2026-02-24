/**
 * Member Case Timeline Page
 * 
 * Shows detailed case journey with human-centered explanations
 * for members to understand where their case is and what to expect.
 */


export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buildCaseTimeline, getCaseJourneySummary, calculateCaseProgress, TimelineContext } from '@/lib/member-experience/timeline-builder';
import { GrievanceTimeline } from '@/components/marketing/grievance-timeline';
import { HumanCenteredCallout } from '@/components/marketing/human-centered-callout';
 
import { logger } from '@/lib/logger';

interface TimelinePageProps {
  params: {
    locale: string;
    caseId: string;
  };
}

async function getCaseDetails(caseId: string): Promise<TimelineContext | null> {
  try {
    // In production, this would fetch from the database
    // For now, return null to indicate not found
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/cases/${caseId}/timeline`,
      { cache: 'no-store' }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.timeline;
  } catch (error) {
    logger.error('Failed to fetch case timeline:', error);
    return null;
  }
}

export default async function CaseTimelinePage({ params }: TimelinePageProps) {
  const caseDetails = await getCaseDetails(params.caseId);

  if (!caseDetails) {
    notFound();
  }

  const stages = buildCaseTimeline(caseDetails);
  const summary = getCaseJourneySummary(caseDetails);
  const _progress = calculateCaseProgress(stages);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Your Case Journey
          </h1>
          <p className="text-lg text-gray-600">
            Case #{params.caseId}
          </p>
        </div>

        <HumanCenteredCallout
          variant="human"
          title="Your journey in plain language"
          description="This timeline shows your case's journey in plain language. Every case is different, and we&apos;re here to support you through the entire process."
          className="mb-8"
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Current Stage</p>
                <p className="font-semibold text-gray-900">{summary.currentStageTitle}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Days Since Submission</p>
                <p className="font-semibold text-gray-900">{summary.totalDays}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  summary.isOnTrack ? 'bg-green-100' : 'bg-yellow-100'
                }`}
              >
                <svg
                  className={`w-6 h-6 ${summary.isOnTrack ? 'text-green-600' : 'text-yellow-600'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <p className="font-semibold text-gray-900">
                  {summary.isOnTrack ? 'On Track' : 'In Progress'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Detailed Timeline
          </h2>
          <GrievanceTimeline
            stages={stages}
            variant="full"
            showEstimates={true}
            showProgress={true}
          />
        </div>

        {/* Assigned Steward */}
        {caseDetails.assignedSteward && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-gray-900 mb-3">Your Union Steward</h3>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-200 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-700" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-900">{caseDetails.assignedSteward.name}</p>
                <p className="text-sm text-gray-600">
                  Your steward is handling your case and will contact you if they need anything.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Questions Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">
            Questions About Your Case?
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                What if I have new information?
              </h4>
              <p className="text-gray-700">
                Contact your steward directly or add a note to your case through the dashboard.
                New information can help strengthen your case.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Why is my case taking this long?
              </h4>
              <p className="text-gray-700">
                Every case is different. Some require more investigation, documentation, or
                coordination with management. Your steward is working to get the best outcome,
                not just the fastest one.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 mb-2">
                Can I talk to someone?
              </h4>
              <p className="text-gray-700">
                Absolutely. Your steward is here for you. If you need to talk through what&apos;s
                happening, reach out directly. Union solidarity means you&apos;re never alone in this.
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex gap-4">
              <a
                href={`/${params.locale}/dashboard/member/messages`}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-md font-medium text-center hover:bg-blue-700 transition-colors"
              >
                Message Your Steward
              </a>
              <a
                href={`/${params.locale}/dashboard/member/cases/${params.caseId}`}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-md font-medium text-center hover:bg-gray-300 transition-colors"
              >
                View Case Details
              </a>
            </div>
          </div>
        </div>

        {/* Trust Footer */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Your case data is protected by our{' '}
            <Link href="/trust" className="text-blue-600 hover:underline">
              trust infrastructure
            </Link>
            . Only you and your assigned steward can see these details.
          </p>
        </div>
      </div>
    </div>
  );
}

export async function generateMetadata({ params: _params }: TimelinePageProps) {
  return {
    title: `Case Timeline | Union Eyes`,
    description: 'Track the progress of your case with clear, human-centered explanations.',
  };
}
