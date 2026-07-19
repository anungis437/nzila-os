/**
 * CourtLens badges — display primitives for matter queue and matter detail.
 *
 * Ported from legacy `src/components/courtlens/Badges.jsx` (approved Phase 1
 * port candidate — see `docs/courtlens/legacy-inventory-review.json`).
 *
 * Adaptations from legacy source:
 *  - Typed against real domain enums (`IncidentSeverity`, `IncidentStatus`,
 *    `AiSummaryStatus`, `CourtLensMatterPracticeArea`) rather than raw strings.
 *  - Uses `next-intl` `useTranslations('courtlens.badges')` instead of the
 *    legacy `useAppLanguage` / `getTenantLabel` layer.
 *  - Uses inline SVG icons from `./icons` instead of `lucide-react` (not a
 *    dependency of `apps/abr`).
 *  - Uses Tailwind neutral palette (`slate`/`amber`/`red`/`green`/`indigo`) —
 *    no reliance on tenant-specific CSS variables that were part of the legacy
 *    design system.
 *
 * All components are pure display and safe to render in server or client
 * component trees. `next-intl` `useTranslations` requires a client boundary
 * only when used from a client component — server components should import
 * `getTranslations` and pass labels down as props if needed.
 */

'use client';

import { useTranslations } from 'next-intl';

import type {
  AiSummaryStatus,
  CourtLensMatterPracticeArea,
} from '@/modules/incidents/courtlens';
import type { IncidentSeverity, IncidentStatus } from '@/modules/incidents/types';

import { CheckCircleIcon, EditIcon, EyeIcon, SparklesIcon, XCircleIcon } from './icons';

// ── Urgency ──────────────────────────────────────────────────────────────────

type UrgencyStyle = {
  className: string;
  dot: string;
};

const URGENCY_STYLES: Record<IncidentSeverity, UrgencyStyle> = {
  critical: { className: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  high: { className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  medium: { className: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  low: { className: 'bg-slate-50 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
};

const URGENCY_FALLBACK: UrgencyStyle = {
  className: 'bg-slate-50 text-slate-600 border-slate-200',
  dot: 'bg-slate-400',
};

export type UrgencyBadgeSize = 'xs' | 'sm' | 'md';

const URGENCY_SIZE_CLASSES: Record<UrgencyBadgeSize, string> = {
  xs: 'text-[10px] px-1.5 py-0.5',
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
};

export interface UrgencyBadgeProps {
  level: IncidentSeverity;
  size?: UrgencyBadgeSize;
}

export function UrgencyBadge({ level, size = 'sm' }: UrgencyBadgeProps) {
  const t = useTranslations('courtlens.badges');
  const style = URGENCY_STYLES[level] ?? URGENCY_FALLBACK;
  const sizeClass = URGENCY_SIZE_CLASSES[size];
  const label = level in URGENCY_STYLES ? t(`urgency.${level}`) : String(level ?? '');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${style.className} ${sizeClass}`}
      data-testid={`urgency-badge-${level}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}

// ── Matter status ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<IncidentStatus, { className: string; dot: string }> = {
  new: { className: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  triage: { className: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  assigned: { className: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  investigating: { className: 'bg-cyan-50 text-cyan-700 border-cyan-200', dot: 'bg-cyan-500' },
  action_planning: { className: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  monitoring: { className: 'bg-teal-50 text-teal-700 border-teal-200', dot: 'bg-teal-500' },
  resolved: { className: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  closed: { className: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  archived: { className: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400' },
};

const STATUS_FALLBACK = { className: 'bg-slate-50 text-slate-600 border-slate-200', dot: 'bg-slate-400' };

export interface StatusBadgeProps {
  status: IncidentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const t = useTranslations('courtlens.badges');
  const style = STATUS_STYLES[status] ?? STATUS_FALLBACK;
  const label = status in STATUS_STYLES ? t(`status.${status}`) : String(status ?? '');
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${style.className}`}
      data-testid={`status-badge-${status}`}
    >
      {label}
    </span>
  );
}

// ── AI summary status ────────────────────────────────────────────────────────

const AI_STATUS_STYLES: Record<
  AiSummaryStatus,
  { className: string; Icon: (props: { className?: string }) => React.ReactElement }
> = {
  ai_draft: { className: 'bg-violet-50 text-violet-700 border-violet-200', Icon: SparklesIcon },
  needs_verification: { className: 'bg-violet-50 text-violet-700 border-violet-200', Icon: EyeIcon },
  approved: { className: 'bg-green-50 text-green-700 border-green-200', Icon: CheckCircleIcon },
  rejected: { className: 'bg-red-50 text-red-700 border-red-200', Icon: XCircleIcon },
  revised_by_human: { className: 'bg-indigo-50 text-indigo-700 border-indigo-200', Icon: EditIcon },
};

const AI_STATUS_FALLBACK = {
  className: 'bg-slate-50 text-slate-600 border-slate-200',
  Icon: SparklesIcon,
};

export interface AiSummaryBadgeProps {
  status: AiSummaryStatus;
}

export function AiSummaryBadge({ status }: AiSummaryBadgeProps) {
  const t = useTranslations('courtlens.badges');
  const style = AI_STATUS_STYLES[status] ?? AI_STATUS_FALLBACK;
  const Icon = style.Icon;
  const label = status in AI_STATUS_STYLES ? t(`aiSummary.${status}`) : String(status ?? '');
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium ${style.className}`}
      data-testid={`ai-summary-badge-${status}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// ── Confidence bar ───────────────────────────────────────────────────────────

export interface ConfidenceBarProps {
  /** Confidence score in the `[0, 1]` range. Values outside are clamped. */
  score: number | null | undefined;
}

export function ConfidenceBar({ score }: ConfidenceBarProps) {
  const raw = typeof score === 'number' && Number.isFinite(score) ? score : 0;
  const clamped = Math.min(1, Math.max(0, raw));
  const pct = Math.round(clamped * 100);
  const color = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2" data-testid="confidence-bar">
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="AI confidence"
      >
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums text-slate-600">{pct}%</span>
    </div>
  );
}

// ── Minimal dot indicators ───────────────────────────────────────────────────

export interface UrgencyDotProps {
  level: IncidentSeverity;
  className?: string;
}

export function UrgencyDot({ level, className = '' }: UrgencyDotProps) {
  const t = useTranslations('courtlens.badges');
  const style = URGENCY_STYLES[level] ?? URGENCY_FALLBACK;
  const title = level in URGENCY_STYLES ? t(`urgency.${level}`) : String(level ?? '');
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${style.dot} ${className}`}
      title={title}
      data-testid={`urgency-dot-${level}`}
    />
  );
}

const PRACTICE_AREA_DOTS: Record<CourtLensMatterPracticeArea, string> = {
  housing: 'bg-blue-500',
  employment: 'bg-teal-500',
  debt: 'bg-purple-500',
  unknown: 'bg-slate-400',
};

export interface PracticeAreaDotProps {
  area: CourtLensMatterPracticeArea;
  className?: string;
}

export function PracticeAreaDot({ area, className = '' }: PracticeAreaDotProps) {
  const t = useTranslations('courtlens.badges');
  const color = PRACTICE_AREA_DOTS[area];
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color} ${className}`}
      title={t(`practiceArea.${area}`)}
      data-testid={`practice-area-dot-${area}`}
    />
  );
}

export interface StatusDotProps {
  status: IncidentStatus;
  className?: string;
}

export function StatusDot({ status, className = '' }: StatusDotProps) {
  const t = useTranslations('courtlens.badges');
  const style = STATUS_STYLES[status] ?? STATUS_FALLBACK;
  const title = status in STATUS_STYLES ? t(`status.${status}`) : String(status ?? '');
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${style.dot} ${className}`}
      title={title}
      data-testid={`status-dot-${status}`}
    />
  );
}
