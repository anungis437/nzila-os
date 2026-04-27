/**
 * Signal Details Component
 * 
 * Expanded view of signal information with actionable steps.
 */

import type { Signal } from '@/lib/services/lro-signals';
import { useTranslations } from 'next-intl';
import { SignalTypeBadge } from './signal-badge';

interface SignalDetailsProps {
  signal: Signal;
  caseId: string;
}

export function SignalDetails({ signal, caseId }: SignalDetailsProps) {
  const t = useTranslations('signalDetails');
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SignalTypeBadge signal={signal} />
            <span className="text-sm text-gray-500">
              {formatTimestamp(signal.generatedAt, t)}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-3">{signal.description}</p>
        </div>
      </div>

      {/* Context details */}
      {Object.keys(signal.context).length > 0 && (
        <div className="bg-gray-50 rounded p-3 space-y-1">
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            {t('context')}
          </div>
          {signal.context.memberName && (
            <ContextRow label={t('member')} value={signal.context.memberName} />
          )}
          {signal.context.currentState && (
            <ContextRow 
              label={t('state')}
              value={signal.context.currentState.replace('_', ' ')} 
            />
          )}
          {signal.context.casePriority && (
            <ContextRow 
              label={t('priority')}
              value={signal.context.casePriority} 
            />
          )}
          {signal.context.daysElapsed !== undefined && (
            <ContextRow 
              label={t('daysElapsed')}
              value={t('daysElapsedValue', { count: signal.context.daysElapsed })}
            />
          )}
          {signal.context.slaStatus && (
            <ContextRow 
              label={t('slaStatus')}
              value={signal.context.slaStatus.toUpperCase()} 
            />
          )}
          {signal.context.slaType && (
            <ContextRow 
              label={t('slaType')}
              value={signal.context.slaType} 
            />
          )}
        </div>
      )}

      {/* Action button */}
      {signal.actionable && signal.actionText && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm font-medium text-gray-700">{t('recommendedAction')}</span>
          <button
            onClick={() => handleAction(caseId, signal)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {signal.actionText}
          </button>
        </div>
      )}
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}:</span>
      <span className="font-medium text-gray-900 capitalize">{value}</span>
    </div>
  );
}

function formatTimestamp(date: Date, t: (key: string, vars?: Record<string, string | number | Date>) => string): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return t('time.justNow');
  if (diffMins < 60) return t('time.minAgo', { count: diffMins });
  if (diffMins < 1440) return t('time.hourAgo', { count: Math.floor(diffMins / 60) });
  
  return date.toLocaleDateString();
}

/**
 * Handle signal action (navigate to appropriate workflow step)
 */
function handleAction(caseId: string, signal: Signal) {
  // Map signal types to actions
  const actionMap: Record<Signal['type'], string> = {
    acknowledgment_overdue: `/dashboard/cases/${caseId}?action=acknowledge`,
    member_waiting: `/dashboard/cases/${caseId}?action=send_update`,
    escalation_needed: `/dashboard/cases/${caseId}?action=escalate`,
    sla_breached: `/dashboard/cases/${caseId}?action=review`,
    sla_at_risk: `/dashboard/cases/${caseId}?action=prioritize`,
    case_stale: `/dashboard/cases/${caseId}?action=update_status`,
    urgent_state: `/dashboard/cases/${caseId}`,
  };

  const url = actionMap[signal.type] || `/dashboard/cases/${caseId}`;
  window.location.href = url;
}

