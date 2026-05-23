/**
 * OrganizationalContinuityNote — Wave 7 procurement inevitability surface.
 *
 * A small, low-energy band rendered immediately under the hero on
 * procurement-facing marketing surfaces (trust, pricing, pilot-request,
 * platform overview). Its role is *not* to convert — it is to stabilize
 * the reading register of the page so a procurement reviewer encounters
 * an organizational posture before any feature framing.
 *
 * No CTA, no marketing energy, no productivity language. One paragraph
 * of continuity-safe operational honesty.
 */
import { ScrollText } from 'lucide-react';

type OrganizationalContinuityNoteProps = {
  /** One-line operational identity of the surface, e.g. "Trust posture". */
  surface: string;
  /**
   * Continuity-safe paragraph describing the organizational reading of the
   * surface. Should avoid SaaS / productivity / optimization framing and
   * instead speak to continuity, reviewer-of-record, and operational
   * resilience.
   */
  posture: string;
};

export function OrganizationalContinuityNote({
  surface,
  posture,
}: OrganizationalContinuityNoteProps) {
  return (
    <aside
      role="note"
      aria-label={`${surface} organizational posture`}
      className="border-y border-slate-200 bg-slate-50/70"
    >
      <div className="mx-auto flex max-w-5xl items-start gap-4 px-6 py-5">
        <ScrollText
          className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
          aria-hidden
        />
        <div className="flex flex-col gap-1.5 text-sm leading-relaxed text-slate-700">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {surface}
          </span>
          <p>{posture}</p>
        </div>
      </div>
    </aside>
  );
}
