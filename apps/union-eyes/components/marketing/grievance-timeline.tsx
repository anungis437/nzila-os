/**
 * Grievance Timeline Component
 * 
 * Visual timeline showing case journey with human-readable explanations.
 * Uses FSM state transitions to build compassionate, informative timeline.
 */

'use client';

import { TimelineStage, estimateTimeRemaining, isStageDelayed } from '@/lib/member-experience/timeline-builder';

interface GrievanceTimelineProps {
  stages: TimelineStage[];
  variant?: 'full' | 'compact';
  showEstimates?: boolean;
  showProgress?: boolean;
}

export function GrievanceTimeline({
  stages,
  variant = 'full',
  showEstimates = true,
  showProgress = true,
}: GrievanceTimelineProps) {
  const currentStage = stages.find((s) => s.isCurrentStage);
  const progress = stages.filter((s) => s.isPastStage).length / stages.length * 100;

  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        {showProgress && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Case Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {stages.map((stage, _index) => (
          <div
            key={stage.id}
            className={`flex items-start gap-3 ${
              stage.isFutureStage ? 'opacity-40' : ''
            }`}
          >
            {/* Status Indicator */}
            <div className="shrink-0 mt-1">
              {stage.isPastStage ? (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              ) : stage.isCurrentStage ? (
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                </div>
              ) : (
                <div className="w-6 h-6 bg-gray-300 rounded-full" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-gray-900">{stage.title}</h4>
              <p className="text-sm text-gray-600 line-clamp-1">
                {stage.description}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {stage.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {stage.isCurrentStage && ` • ${stage.daysInStage} days`}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Progress Bar */}
      {showProgress && (
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span className="font-medium">Case Progress</span>
            <span className="font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {currentStage && (
            <p className="text-sm text-gray-600 mt-2">
              Current stage: <strong>{currentStage.title}</strong>
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-6">
        {stages.map((stage, index) => {
          const isDelayed = isStageDelayed(stage);
          const timeRemaining = stage.isCurrentStage ? estimateTimeRemaining(stage) : null;

          return (
            <div
              key={stage.id}
              className={`relative ${stage.isFutureStage ? 'opacity-40' : ''}`}
            >
              {/* Connector Line */}
              {index > 0 && (
                <div
                  className={`absolute left-6 -top-6 w-0.5 h-6 ${
                    stage.isPastStage || stage.isCurrentStage ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}

              <div className="flex items-start gap-4">
                {/* Status Indicator */}
                <div className="shrink-0 relative z-10">
                  {stage.isPastStage ? (
                    <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  ) : stage.isCurrentStage ? (
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                        isDelayed ? 'bg-yellow-500' : 'bg-blue-500'
                      }`}
                    >
                      <div className="w-6 h-6 bg-white rounded-full animate-pulse" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-300 rounded-full shadow" />
                  )}
                </div>

                {/* Content Card */}
                <div
                  className={`flex-1 rounded-lg border-2 p-6 ${
                    stage.isCurrentStage
                      ? isDelayed
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-blue-500 bg-blue-50'
                      : stage.isPastStage
                      ? 'border-green-200 bg-white'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {stage.title}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {stage.timestamp.toLocaleDateString('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        {' • '}
                        <span className="font-medium">
                          {stage.daysInStage} {stage.daysInStage === 1 ? 'day' : 'days'}
                          {stage.isCurrentStage ? ' (ongoing)' : ''}
                        </span>
                      </p>
                    </div>

                    {stage.isCurrentStage && (
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          isDelayed
                            ? 'bg-yellow-200 text-yellow-800'
                            : 'bg-blue-200 text-blue-800'
                        }`}
                      >
                        {isDelayed ? 'Taking Longer' : 'In Progress'}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-700 mb-4">{stage.description}</p>

                  {/* Current Stage Details */}
                  {stage.isCurrentStage && (
                    <>
                      {/* Next Steps */}
                      {stage.explanation.nextSteps.length > 0 && (
                        <div className="mb-4">
                          <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                            What&apos;s Happening Now:
                          </h4>
                          <ul className="space-y-1">
                            {(stage.explanation.nextSteps as string[]).map((step: string, idx: number) => (
                              <li key={idx} className="flex items-start text-sm text-gray-700">
                                <span className="text-blue-600 mr-2">•</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Time Estimate */}
                      {showEstimates && timeRemaining && (
                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5 text-gray-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">
                              {timeRemaining}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Empathy Message */}
                      {stage.explanation.empathyMessage && (
                        <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
                          <p className="text-sm text-blue-900 italic">
                            {stage.explanation.empathyMessage}
                          </p>
                        </div>
                      )}

                      {/* Resources */}
                      {stage.explanation.resourcesAvailable && stage.explanation.resourcesAvailable.length > 0 && (
                        <div className="mt-4">
                          <h4 className="font-semibold text-gray-900 mb-2 text-sm">
                            Resources:
                          </h4>
                          <ul className="space-y-1">
                            {stage.explanation.resourcesAvailable.map((resource: { title: string; description: string; url?: string }, idx: number) => (
                              <li key={idx} className="text-sm">
                                <a
                                  href={resource.url}
                                  className="text-blue-600 hover:underline"
                                >
                                  {resource.title}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Delay Warning */}
                      {isDelayed && (
                        <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg
                              className="w-5 h-5 text-yellow-700 shrink-0 mt-0.5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-yellow-900 mb-1">
                                This stage is taking longer than usual
                              </p>
                              <p className="text-sm text-yellow-800">
                                Your steward is aware and will reach out if there&apos;s anything you need to do.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Past Stage Summary */}
                  {stage.isPastStage && (
                    <div className="flex items-center gap-2 text-sm text-green-700">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">Completed in {stage.daysInStage} days</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Compact Timeline Summary
 * For dashboard widgets or small spaces
 */
interface TimelineSummaryProps {
  currentStageTitle: string;
  totalDays: number;
  progress: number;
  isOnTrack: boolean;
}

export function TimelineSummary({
  currentStageTitle,
  totalDays,
  progress,
  isOnTrack,
}: TimelineSummaryProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Case Status</h3>
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            isOnTrack ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}
        >
          {isOnTrack ? 'On Track' : 'Needs Attention'}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-600 mb-1">Current Stage</p>
          <p className="font-medium text-gray-900">{currentStageTitle}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">Days Since Submission</p>
          <p className="font-medium text-gray-900">{totalDays}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-2">Progress</p>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}% complete</p>
        </div>
      </div>
    </div>
  );
}
