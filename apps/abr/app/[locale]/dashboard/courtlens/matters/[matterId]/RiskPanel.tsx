import { useTranslations } from 'next-intl';

import type { CourtLensRiskFlags } from '@/modules/incidents/courtlens';
import type { IncidentSeverity } from '@/modules/incidents/types';

import { UrgencyBadge } from '../../_ui/badges';

/**
 * RiskPanel — read-only display of harm-signal flags for a CourtLens matter.
 *
 * Ported from legacy `court-lens-ready/src/components/courtlens/matter/RiskPanel.jsx`.
 *
 * Adapted to the actual domain shape: `CourtLensRiskFlags` is a boolean-object
 * (13 flags), NOT a list of `{id, risk_type, review_status}` records like the
 * legacy Base44 shape. Write actions (`change_urgency`, `resolve_flag`) are
 * intentionally deferred until the corresponding server API exists.
 *
 * Server component — no client interactivity.
 */

const ALL_FLAG_KEYS: ReadonlyArray<keyof CourtLensRiskFlags> = [
  'risk_lockout',
  'risk_eviction',
  'risk_utility_shutoff',
  'risk_safety',
  'risk_homelessness',
  'risk_income_loss',
  'risk_unsafe_work',
  'risk_retaliation',
  'risk_garnishment',
  'risk_bank_freeze',
  'risk_identity_theft',
  'risk_essential_services',
  'risk_harassment',
];

// Which flags escalate to "critical" severity styling (bodily safety, shelter
// loss, unlawful eviction/lockout). Everything else renders with high styling
// when active.
const CRITICAL_FLAG_KEYS: ReadonlySet<keyof CourtLensRiskFlags> = new Set([
  'risk_lockout',
  'risk_safety',
  'risk_homelessness',
]);

export interface RiskPanelProps {
  urgencyLabel: string;
  urgencyLevel: IncidentSeverity;
  riskFlags: CourtLensRiskFlags | null;
}

export function RiskPanel({ urgencyLabel, urgencyLevel, riskFlags }: RiskPanelProps): React.ReactElement {
  const t = useTranslations('courtlens.riskPanel');

  const activeFlags = riskFlags
    ? ALL_FLAG_KEYS.filter((key) => riskFlags[key] === true)
    : [];

  return (
    <div className="space-y-6" data-testid="courtlens-risk-panel">
      {/* Urgency summary */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-poppins text-base font-semibold text-navy">{t('harmSignalLevel')}</h3>
          <UrgencyBadge level={urgencyLevel} />
        </div>
        <p className="text-sm text-slate-600">
          {t('harmSignalDescription', { level: urgencyLabel })}
        </p>
      </div>

      {/* Detected flags */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-4 font-poppins text-base font-semibold text-navy">
          {t('detectedHarmSignals', { count: activeFlags.length })}
        </h3>
        {activeFlags.length === 0 ? (
          <p
            className="py-4 text-center text-sm text-slate-500"
            data-testid="risk-panel-empty"
          >
            {t('noHarmSignals')}
          </p>
        ) : (
          <ul className="space-y-3" data-testid="risk-panel-flags">
            {activeFlags.map((flagKey) => {
              const isCritical = CRITICAL_FLAG_KEYS.has(flagKey);
              return (
                <li
                  key={flagKey}
                  data-testid={`risk-panel-flag-${flagKey}`}
                  className={
                    isCritical
                      ? 'rounded-lg border border-red-200 bg-red-50 p-4'
                      : 'rounded-lg border border-amber-200 bg-amber-50 p-4'
                  }
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={
                        'mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ' +
                        (isCritical ? 'bg-red-500' : 'bg-amber-500')
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-navy">
                        {t(`flags.${flagKey}`)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {t(`flagDescriptions.${flagKey}`)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          {t('flagsAutoDetected')}
        </p>
      </div>
    </div>
  );
}

export default RiskPanel;
