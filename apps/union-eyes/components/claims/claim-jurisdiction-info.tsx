'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JurisdictionBadge } from '@/components/jurisdiction/jurisdiction-badge';
import { DeadlineCalculator } from '@/components/jurisdiction/deadline-calculator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CAJurisdiction, getDeadlineUrgency, mapJurisdictionValue } from '@/lib/jurisdiction-helpers-client';

interface ClaimJurisdictionInfoProps {
  claimId: string;
  organizationId: string;
  claimType: string;
  status: string;
  filedDate?: string;
}

interface DeadlineInfo {
  jurisdiction: CAJurisdiction;
  ruleCategory: string;
  deadlineDays: number;
  deadlineDate: Date;
  businessDaysRemaining: number;
  calendarDaysRemaining: number;
  legalReference: string;
}

export function ClaimJurisdictionInfo({
  claimId,
  organizationId,
  claimType,
  status,
  filedDate,
}: ClaimJurisdictionInfoProps) {
  const _t = useTranslations();
  const [jurisdiction, setJurisdiction] = useState<CAJurisdiction | null>(null);
  const [deadlineInfo, setDeadlineInfo] = useState<DeadlineInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJurisdictionData = async () => {
      try {
        setLoading(true);

        // Fetch organization's jurisdiction
        const jurisdictionResponse = await fetch(
          `/api/organizations/${organizationId}`
        );

        if (!jurisdictionResponse.ok) {
          throw new Error('Failed to fetch jurisdiction');
        }

        const jurisdictionData = await jurisdictionResponse.json();
        const organization = jurisdictionData?.data ?? jurisdictionData;
        const rawJurisdiction =
          (organization?.jurisdiction ??
            organization?.provinceTerritory ??
            organization?.province_territory ??
            '') as string;
        const jur = mapJurisdictionValue(rawJurisdiction);
        setJurisdiction(jur);

        // If claim involves grievance/arbitration and has a filed date, calculate deadline
        if (
          filedDate &&
          (claimType.includes('grievance') || status === 'assigned')
        ) {
          const ruleCategory = 'grievance_arbitration';

          const deadlineResponse = await fetch(
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

          if (deadlineResponse.ok) {
            const deadlineData = await deadlineResponse.json();
            setDeadlineInfo({
              jurisdiction: jur,
              ruleCategory,
              deadlineDays: deadlineData.deadlineDays,
              deadlineDate: new Date(deadlineData.deadlineDate),
              businessDaysRemaining: deadlineData.businessDaysRemaining || 0,
              calendarDaysRemaining: deadlineData.calendarDaysRemaining || 0,
              legalReference: deadlineData.legalReference || '',
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
  }, [claimId, organizationId, claimType, status, filedDate]);

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

  const urgency = deadlineInfo
    ? getDeadlineUrgency(deadlineInfo.businessDaysRemaining)
    : null;

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

      {/* Deadline Information */}
      {deadlineInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar size={16} className="text-blue-600" />
              Arbitration Deadline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Urgency Alert */}
            {urgency && (
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
                  {deadlineInfo.businessDaysRemaining > 0
                    ? `${deadlineInfo.businessDaysRemaining} business days remaining`
                    : 'Deadline has passed'}
                </AlertDescription>
              </Alert>
            )}

            {/* Deadline Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Deadline Date:</span>
                <p className="font-medium">
                  {deadlineInfo.deadlineDate.toLocaleDateString('en-CA', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Filing Window:</span>
                <p className="font-medium">{deadlineInfo.deadlineDays} business days</p>
              </div>
              <div>
                <span className="text-gray-500">Business Days Left:</span>
                <p className="font-medium">{deadlineInfo.businessDaysRemaining}</p>
              </div>
              <div>
                <span className="text-gray-500">Calendar Days Left:</span>
                <p className="font-medium">{deadlineInfo.calendarDaysRemaining}</p>
              </div>
            </div>

            {/* Legal Reference */}
            {deadlineInfo.legalReference && (
              <div className="pt-2 border-t text-xs text-gray-600">
                <span className="font-medium">Legal Reference:</span>{' '}
                {deadlineInfo.legalReference}
              </div>
            )}

            {/* Interactive Calculator */}
            <div className="pt-2 border-t">
              <DeadlineCalculator
                organizationId={organizationId}
                ruleCategory={deadlineInfo.ruleCategory}
                defaultStartDate={filedDate ? new Date(filedDate) : undefined}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

