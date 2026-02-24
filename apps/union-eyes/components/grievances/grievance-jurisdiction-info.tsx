'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, AlertTriangle, CheckCircle, Clock, Info, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JurisdictionBadge } from '@/components/jurisdiction/jurisdiction-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CAJurisdiction, getDeadlineUrgency } from '@/lib/jurisdiction-helpers';

interface GrievanceJurisdictionInfoProps {
  grievanceId: string;
  organizationId: string;
  currentStep: string;
  filedDate: string;
  status: string;
}

interface StepDeadline {
  step: string;
  stepNumber: number;
  deadline: Date;
  businessDaysRemaining: number;
  isPassed: boolean;
  isActive: boolean;
}

interface ArbitrationDeadline {
  deadlineDays: number;
  deadlineDate: Date;
  businessDaysRemaining: number;
  legalReference: string;
}

export function GrievanceJurisdictionInfo({
  grievanceId,
  organizationId,
  currentStep,
  filedDate,
  status,
}: GrievanceJurisdictionInfoProps) {
  const _t = useTranslations();
  const [jurisdiction, setJurisdiction] = useState<CAJurisdiction | null>(null);
  const [stepDeadlines, setStepDeadlines] = useState<StepDeadline[]>([]);
  const [arbitrationDeadline, setArbitrationDeadline] = useState<ArbitrationDeadline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJurisdictionData = async () => {
      try {
        setLoading(true);

        // Fetch organization's jurisdiction
        const jurisdictionResponse = await fetch(
          `/api/jurisdiction/organization/${organizationId}`
        );

        if (!jurisdictionResponse.ok) {
          throw new Error('Failed to fetch jurisdiction');
        }

        const jurisdictionData = await jurisdictionResponse.json();
        const jur = jurisdictionData.jurisdiction as CAJurisdiction;
        setJurisdiction(jur);

        // Calculate step deadlines (typically 10 business days per step in most jurisdictions)
        const stepDeadlinesData: StepDeadline[] = [];
        const steps = ['Step 1', 'Step 2', 'Step 3'];
        
        for (let i = 0; i < steps.length; i++) {
          const stepStartDate = new Date(filedDate);
          stepStartDate.setDate(stepStartDate.getDate() + (i * 10)); // 10 days per step

          const deadlineResponse = await fetch(
            '/api/jurisdiction/business-days',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                operation: 'add',
                jurisdiction: jur,
                startDate: stepStartDate.toISOString(),
                businessDays: 10,
              }),
            }
          );

          if (deadlineResponse.ok) {
            const deadlineData = await deadlineResponse.json();
            const deadline = new Date(deadlineData.resultDate);
            const now = new Date();
            const businessDaysRemaining = Math.ceil(
              (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );

            stepDeadlinesData.push({
              step: steps[i],
              stepNumber: i + 1,
              deadline,
              businessDaysRemaining,
              isPassed: now > deadline,
              isActive: currentStep.toLowerCase().includes(`step ${i + 1}`),
            });
          }
        }

        setStepDeadlines(stepDeadlinesData);

        // If grievance is at arbitration stage or step 3 denied, calculate arbitration filing deadline
        if (
          status === 'arbitration' ||
          currentStep.toLowerCase().includes('step 3') ||
          currentStep.toLowerCase().includes('arbitration')
        ) {
          const ruleCategory = 'grievance_arbitration';

          const arbitrationResponse = await fetch(
            '/api/jurisdiction/calculate-deadline',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jurisdiction: jur,
                ruleCategory,
                startDate: filedDate,
                mode: 'detailed',
              }),
            }
          );

          if (arbitrationResponse.ok) {
            const arbitrationData = await arbitrationResponse.json();
            setArbitrationDeadline({
              deadlineDays: arbitrationData.deadlineDays,
              deadlineDate: new Date(arbitrationData.deadlineDate),
              businessDaysRemaining: arbitrationData.businessDaysRemaining || 0,
              legalReference: arbitrationData.legalReference || '',
            });
          }
        }
      } catch (err) {
setError(
          err instanceof Error ? err.message : 'Failed to load jurisdiction'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchJurisdictionData();
  }, [grievanceId, organizationId, currentStep, status, filedDate]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="animate-spin h-5 w-5 text-gray-400 mr-2" />
            <span className="text-sm text-gray-500">Loading jurisdiction...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !jurisdiction) {
    return null; // Silently fail - jurisdiction is optional
  }

  return (
    <div className="space-y-4">
      {/* Jurisdiction Badge */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Info size={16} className="text-blue-600" />
            Jurisdiction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <JurisdictionBadge jurisdiction={jurisdiction} size="lg" />
        </CardContent>
      </Card>

      {/* Grievance Step Timeline */}
      {stepDeadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              Grievance Steps & Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stepDeadlines.map((step, _index) => {
                const urgency = getDeadlineUrgency(step.businessDaysRemaining);
                
                return (
                  <div
                    key={step.stepNumber}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      step.isActive
                        ? 'bg-blue-50 border-blue-200'
                        : step.isPassed
                        ? 'bg-gray-50 border-gray-200'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="shrink-0">
                      {step.isPassed ? (
                        <CheckCircle className="h-5 w-5 text-gray-400" />
                      ) : step.isActive ? (
                        <Clock className="h-5 w-5 text-blue-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {step.step}
                        {step.isActive && (
                          <span className="ml-2 text-xs text-blue-600">
                            (Current)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-600">
                        Deadline: {step.deadline.toLocaleDateString('en-CA')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {!step.isPassed && (
                        <span
                          className={`text-xs font-medium px-2 py-1 rounded ${
                            urgency.level === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : urgency.level === 'high'
                              ? 'bg-orange-100 text-orange-700'
                              : urgency.level === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {step.businessDaysRemaining} days
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Arbitration Filing Deadline */}
      {arbitrationDeadline && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-600" />
              Arbitration Filing Deadline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Urgency Alert */}
            {(() => {
              const urgency = getDeadlineUrgency(arbitrationDeadline.businessDaysRemaining);
              return (
                <Alert
                  variant={
                    urgency.level === 'critical' || urgency.level === 'high'
                      ? 'destructive'
                      : 'default'
                  }
                >
                  {urgency.level === 'critical' ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : urgency.level === 'high' ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    <strong>{urgency.label}:</strong>{' '}
                    {arbitrationDeadline.businessDaysRemaining > 0
                      ? `${arbitrationDeadline.businessDaysRemaining} business days remaining to file arbitration`
                      : 'Arbitration filing deadline has passed'}
                  </AlertDescription>
                </Alert>
              );
            })()}

            {/* Deadline Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Filing Deadline:</span>
                <p className="font-medium">
                  {arbitrationDeadline.deadlineDate.toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Filing Window:</span>
                <p className="font-medium">{arbitrationDeadline.deadlineDays} business days</p>
              </div>
            </div>

            {/* Legal Reference */}
            {arbitrationDeadline.legalReference && (
              <div className="pt-2 border-t text-xs text-gray-600">
                <span className="font-medium">Legal Reference:</span>{' '}
                {arbitrationDeadline.legalReference}
              </div>
            )}

            {/* Next Steps */}
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                <ArrowRight size={14} />
                Next Steps
              </p>
              <ul className="text-xs text-gray-600 space-y-1 ml-5 list-disc">
                <li>Prepare arbitration notice with grievance details</li>
                <li>Select arbitrator from approved list (mutual agreement or random selection)</li>
                <li>Submit formal arbitration request to employer</li>
                <li>File with applicable labour board if required by jurisdiction</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

