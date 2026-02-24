/**
 * Compliance Checker Component
 * Real-time validation against jurisdiction rules
 * Phase 5D: Jurisdiction Framework
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, XCircle, InfoIcon } from 'lucide-react';
import { JurisdictionBadge, type CAJurisdiction } from './jurisdiction-badge';
import { cn } from '@/lib/utils';

export interface ComplianceCheck {
  id: string;
  ruleName: string;
  ruleCategory: string;
  status: 'compliant' | 'warning' | 'violation' | 'info';
  message: string;
  legalReference?: string;
  recommendation?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface ComplianceCheckerProps {
  organizationId: string;
  jurisdiction: CAJurisdiction;
  checksToPerform?: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  autoCheck?: boolean;
  onCheckComplete?: (checks: ComplianceCheck[]) => void;
  className?: string;
}

const SEVERITY_ICONS = {
  low: InfoIcon,
  medium: AlertTriangle,
  high: AlertTriangle,
  critical: XCircle
};

const STATUS_CONFIG = {
  compliant: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bg: 'bg-green-50 border-green-200',
    label: 'Compliant'
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50 border-yellow-200',
    label: 'Warning'
  },
  violation: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    label: 'Violation'
  },
  info: {
    icon: InfoIcon,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    label: 'Info'
  }
};

export function ComplianceChecker({
  organizationId,
  jurisdiction,
  checksToPerform = [],
  data = {},
  autoCheck = true,
  onCheckComplete,
  className
}: ComplianceCheckerProps) {
  const [checks, setChecks] = useState<ComplianceCheck[]>([]);
  const [loading, setLoading] = useState(false);

  const buildFallbackChecks = useCallback(async () => {
    const fallbackChecks: ComplianceCheck[] = [];

    if (data.arbitrationDate && data.grievanceDate) {
      const daysDiff = Math.ceil(
        (new Date(data.arbitrationDate).getTime() - new Date(data.grievanceDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );

      const deadlineRule = await fetch(
        `/api/jurisdiction-rules?jurisdiction=${jurisdiction}&category=arbitration_deadline`
      ).then(r => r.json());

      if (deadlineRule.success && deadlineRule.data.length > 0) {
        const rule = deadlineRule.data[0];
        const maxDays = rule.parameters.deadline_days || 30;

        if (daysDiff <= maxDays) {
          fallbackChecks.push({
            id: 'arbitration-deadline',
            ruleName: rule.ruleName,
            ruleCategory: 'arbitration_deadline',
            status: 'compliant',
            message: `Arbitration scheduled within ${maxDays}-day deadline (${daysDiff} days)`,
            legalReference: rule.legalReference,
            severity: 'low'
          });
        } else {
          fallbackChecks.push({
            id: 'arbitration-deadline',
            ruleName: rule.ruleName,
            ruleCategory: 'arbitration_deadline',
            status: 'violation',
            message: `Arbitration deadline exceeded: ${daysDiff} days (max: ${maxDays})`,
            legalReference: rule.legalReference,
            recommendation: 'File extension request or expedited arbitration',
            severity: 'critical'
          });
        }
      }
    }

    if (data.totalMembers && data.votesCase) {
      const turnout = (data.votesCase / data.totalMembers) * 100;

      fallbackChecks.push({
        id: 'strike-vote-quorum',
        ruleName: 'Strike Vote Quorum',
        ruleCategory: 'strike_vote',
        status: turnout >= 50 ? 'compliant' : 'violation',
        message:
          turnout >= 50
            ? `Quorum met: ${turnout.toFixed(1)}% turnout`
            : `Quorum not met: ${turnout.toFixed(1)}% turnout (minimum 50%)`,
        severity: turnout >= 50 ? 'low' : 'critical'
      });
    }

    if (data.signedCards && data.bargainingUnit) {
      const cardPercentage = (data.signedCards / data.bargainingUnit) * 100;

      let thresholds: { automatic?: number; vote?: number } = {};
      if (jurisdiction === 'CA-FED') {
        thresholds = { vote: 35, automatic: 50 };
      } else if (jurisdiction === 'CA-ON') {
        thresholds = { vote: 40, automatic: 55 };
      } else if (jurisdiction === 'CA-QC') {
        thresholds = { vote: 35 };
      }

      if (thresholds.automatic && cardPercentage >= thresholds.automatic) {
        fallbackChecks.push({
          id: 'certification-cards',
          ruleName: 'Certification Card Threshold',
          ruleCategory: 'certification',
          status: 'compliant',
          message: `Automatic certification available: ${cardPercentage.toFixed(1)}% cards (${thresholds.automatic}% required)`,
          severity: 'low'
        });
      } else if (thresholds.vote && cardPercentage >= thresholds.vote) {
        fallbackChecks.push({
          id: 'certification-cards',
          ruleName: 'Certification Card Threshold',
          ruleCategory: 'certification',
          status: 'warning',
          message: `Vote required: ${cardPercentage.toFixed(1)}% cards (${thresholds.vote}%-${thresholds.automatic || 100}% range)`,
          severity: 'medium'
        });
      } else if (thresholds.vote) {
        fallbackChecks.push({
          id: 'certification-cards',
          ruleName: 'Certification Card Threshold',
          ruleCategory: 'certification',
          status: 'violation',
          message: `Insufficient cards: ${cardPercentage.toFixed(1)}% (minimum ${thresholds.vote}%)`,
          recommendation: 'Continue organizing campaign to reach minimum threshold',
          severity: 'high'
        });
      }
    }

    return fallbackChecks;
  }, [jurisdiction, data]);

  const performChecks = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/compliance/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          jurisdiction,
          checksToPerform,
          data,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const apiChecks = Array.isArray(result.checks) ? result.checks : [];
        setChecks(apiChecks);
        onCheckComplete?.(apiChecks);
        return;
      }
const fallbackChecks = await buildFallbackChecks();
      setChecks(fallbackChecks);
      onCheckComplete?.(fallbackChecks);
    } catch (_error) {
try {
        const fallbackChecks = await buildFallbackChecks();
        setChecks(fallbackChecks);
        onCheckComplete?.(fallbackChecks);
      } catch (_fallbackError) {
}
    } finally {
      setLoading(false);
    }
  }, [organizationId, jurisdiction, data, checksToPerform, onCheckComplete, buildFallbackChecks]);

  useEffect(() => {
    if (autoCheck && organizationId && data) {
      performChecks();
    }
  }, [performChecks, autoCheck, organizationId, data]);

  const groupedChecks = checks.reduce((acc, check) => {
    if (!acc[check.status]) {
      acc[check.status] = [];
    }
    acc[check.status].push(check);
    return acc;
  }, {} as Record<string, ComplianceCheck[]>);

  const summary = {
    compliant: groupedChecks.compliant?.length || 0,
    warning: groupedChecks.warning?.length || 0,
    violation: groupedChecks.violation?.length || 0,
    info: groupedChecks.info?.length || 0,
    total: checks.length
  };

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-sm text-muted-foreground">Running compliance checks...</span>
        </div>
      </div>
    );
  }

  if (checks.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Compliance Status</h3>
          <JurisdictionBadge jurisdiction={jurisdiction} size="sm" />
        </div>
        <div className="flex gap-2">
          {summary.compliant > 0 && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              âœ“ {summary.compliant}
            </Badge>
          )}
          {summary.warning > 0 && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
              âš  {summary.warning}
            </Badge>
          )}
          {summary.violation > 0 && (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
              âœ• {summary.violation}
            </Badge>
          )}
        </div>
      </div>

      {/* Checks */}
      <div className="space-y-2">
        {checks.map(check => {
          const config = STATUS_CONFIG[check.status];
          const Icon = config.icon;
          const SeverityIcon = SEVERITY_ICONS[check.severity];

          return (
            <Alert key={check.id} className={cn('border', config.bg)}>
              <Icon className={cn('h-4 w-4', config.color)} />
              <AlertTitle className="flex items-center justify-between">
                <span>{check.ruleName}</span>
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
              </AlertTitle>
              <AlertDescription className="space-y-1">
                <p className="text-sm">{check.message}</p>
                {check.legalReference && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Legal Reference:</strong> {check.legalReference}
                  </p>
                )}
                {check.recommendation && (
                  <p className="text-xs font-medium mt-2 flex items-start gap-1">
                    <SeverityIcon className="h-3 w-3 mt-0.5 shrink-0" />
                    <span>{check.recommendation}</span>
                  </p>
                )}
              </AlertDescription>
            </Alert>
          );
        })}
      </div>
    </div>
  );
}

