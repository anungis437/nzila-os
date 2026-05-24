/**
 * SovereigntyPostureBanner — Wave 6 sovereignty atmosphere embodiment.
 *
 * Server component rendered at the top of sovereignty-gated layouts so
 * that the organizational contract of the surface is *visible* before any
 * authoritative content loads. This is not decorative — it is the
 * runtime's way of communicating that the surface beneath it is
 * governance-safe, continuity-critical, and reviewer-of-record framed.
 *
 * Used by: cognition, longitudinal-cognition, security, customer-success,
 * operations, ops dashboard layouts.
 */
import { ShieldAlert } from 'lucide-react';

type SovereigntyPostureBannerProps = {
  /** Display name of the surface, e.g. "Cognition" */
  surface: string;
  /** Minimum role required by this surface's gate. */
  minRole:
    | 'officer'
    | 'admin'
    | 'national_officer'
    | 'fed_staff'
    | 'system_admin'
    | 'president';
  /**
   * One-line operational posture for this surface — what kind of
   * organizational responsibility a viewer is taking on by being here.
   */
  posture: string;
  /** Optional translated label for the sovereignty layer (defaults to English). */
  layerLabel?: string;
  /** Optional translated role label override (defaults to English ROLE_LABELS lookup). */
  roleLabel?: string;
  /** Optional translated access note (defaults to English). */
  accessNote?: string;
};

const ROLE_LABELS: Record<SovereigntyPostureBannerProps['minRole'], string> = {
  officer: 'Officer of record',
  admin: 'Administrator of record',
  national_officer: 'National officer of record',
  fed_staff: 'Federation staff of record',
  system_admin: 'Sovereignty operator of record',
  president: 'President of record',
};

export function SovereigntyPostureBanner({
  surface,
  minRole,
  posture,
  layerLabel = 'Sovereignty layer',
  roleLabel,
  accessNote = 'Access is logged; actions taken here are part of the organizational record.',
}: SovereigntyPostureBannerProps) {
  const resolvedRoleLabel = roleLabel ?? ROLE_LABELS[minRole];
  return (
    <div
      role="note"
      aria-label={`${surface} sovereignty posture`}
      className="border-b border-amber-200 bg-amber-50/80"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-3 px-6 py-3">
        <ShieldAlert
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
          aria-hidden
        />
        <div className="flex flex-col gap-0.5 text-xs leading-snug text-amber-900">
          <span className="font-semibold uppercase tracking-wider">
            {layerLabel} · {surface}
          </span>
          <span>
            <span className="font-medium">{resolvedRoleLabel}.</span>{' '}
            {posture} {accessNote}
          </span>
        </div>
      </div>
    </div>
  );
}
