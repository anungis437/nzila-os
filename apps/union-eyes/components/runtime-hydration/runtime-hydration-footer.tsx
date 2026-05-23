/**
 * RuntimeHydrationFooter — Wave 2 depth-convergence overlay.
 *
 * Additive, read-only, governance-safe runtime overlay that sits at the
 * bottom of an organizational surface and tells the reviewer:
 *
 *   - WHERE the organizational state on the surface came from (provenance)
 *   - WHEN it occurred / which governance epoch it belongs to (chronology)
 *   - WHAT continuity context it sits inside (continuity)
 *   - WHO it relates to in the organizational structure (topology)
 *   - WHY this state is visible at all (explainability)
 *
 * It performs NO data fetching. It performs NO mutation. It performs NO
 * scoring, ranking, or analytics. It is a pure presentation contract over
 * caller-supplied refs that already passed the IGG protected-fence
 * (`assertNoProtectedKindsInProjections` / `assertNoProtectedKindsInReadSurface`).
 *
 * The component is designed to be safely composable on every depth-2 /
 * depth-3 cockpit without disturbing the inner client component tree.
 *
 * Doctrine fence (mirrors IGG `governance/trust.ts` and `governance/continuity.ts`):
 *   - No scoring, weighting, or trust-score rendering.
 *   - No predictive language.
 *   - No autonomous-governance posture.
 *   - Framed as "assistive · human-reviewed · review-required".
 *
 * Layer references are pure IDs (or short labels) — callers are responsible
 * for stripping any protected kind before passing refs in.
 */

import type { ReactNode } from 'react';

export interface RuntimeRef {
  /** Stable identifier — must already be protected-fence-safe. */
  readonly id: string;
  /** Optional short label for display. Never includes protected-kind tokens. */
  readonly label?: string;
}

export interface RuntimeProvenancePanelProps {
  readonly sourceAdapter?: string;
  readonly substrateVersion?: string;
  readonly contractVersion?: string;
  readonly evidenceRefs?: readonly RuntimeRef[];
  readonly lineageRefs?: readonly RuntimeRef[];
  /** When the underlying substrate snapshot was projected (ISO-8601). */
  readonly projectedAt?: string;
}

export interface RuntimeChronologyOverlayProps {
  readonly epoch?: string;
  readonly precedingEventRefs?: readonly RuntimeRef[];
  readonly anchorOccurredAt?: string;
  readonly chronologyWindow?: { readonly from?: string; readonly to?: string };
}

export interface RuntimeContinuityOverlayProps {
  readonly successionBreakpointRefs?: readonly RuntimeRef[];
  readonly unresolvedTransitionRefs?: readonly RuntimeRef[];
  readonly memoryGapRefs?: readonly RuntimeRef[];
  readonly continuityCohortRef?: RuntimeRef;
}

export interface RuntimeTopologyOverlayProps {
  readonly ancestorRefs?: readonly RuntimeRef[];
  readonly descendantRefs?: readonly RuntimeRef[];
  readonly affiliationRefs?: readonly RuntimeRef[];
  readonly delegationRefs?: readonly RuntimeRef[];
}

/**
 * Wave 3 — continuity cognition overlay. Pure substrate presence: counts,
 * chronology-ordered succession refs, and procedural-fragility entity refs.
 * No scoring. No severity. No charts. No alerts.
 */
export interface RuntimeCognitionOverlayProps {
  readonly unresolvedTransitionSummary?: {
    readonly totalCount: number;
    readonly byKind?: Readonly<Record<string, number>>;
    readonly oldestOccurredAt?: string;
    readonly newestOccurredAt?: string;
  };
  readonly breakpointSummary?: {
    readonly totalCount: number;
    readonly bracketedCount: number;
    readonly unbracketedCount: number;
  };
  readonly lineageBreakSummary?: {
    readonly totalCount: number;
    readonly byReason?: Readonly<Record<string, number>>;
  };
  readonly memoryGapSummary?: {
    readonly totalCount: number;
    readonly missingEvidenceCount: number;
    readonly missingKnowledgeCount: number;
    readonly missingPolicyCount: number;
  };
  readonly successionPathwayRefs?: readonly RuntimeRef[];
  readonly proceduralFragilityRefs?: readonly RuntimeRef[];
}

export interface RuntimeExplainabilityOverlayProps {
  /**
   * A short, governance-safe answer to "why is this organizational state
   * visible?" — e.g. "Projected from IGG entity graph via continuity
   * cohort lineage; redacted by protected-semantics fence."
   */
  readonly visibilityRationale: string;
  /** Assistive disclosure. Always rendered with the human-review framing. */
  readonly reviewPosture?:
    | 'assistive · human-reviewed · review-required'
    | 'inspectable · read-only · provenance-stamped'
    | 'organizational context · not monitoring · not scoring';
}

export interface RuntimeHydrationFooterProps {
  /** Human-readable name of the surface this footer is attached to. */
  readonly surface: string;
  readonly provenance?: RuntimeProvenancePanelProps;
  readonly chronology?: RuntimeChronologyOverlayProps;
  readonly continuity?: RuntimeContinuityOverlayProps;
  readonly topology?: RuntimeTopologyOverlayProps;
  readonly cognition?: RuntimeCognitionOverlayProps;
  readonly explainability: RuntimeExplainabilityOverlayProps;
  /** Optional slot for surface-specific notes. */
  readonly children?: ReactNode;
}

// ── Atoms ────────────────────────────────────────────────────────────────

function RefList({ refs, empty }: { refs?: readonly RuntimeRef[]; empty: string }) {
  if (!refs || refs.length === 0) {
    return <span className="text-slate-400">{empty}</span>;
  }
  return (
    <ul className="mt-1 flex flex-wrap gap-1.5">
      {refs.map((r) => (
        <li
          key={r.id}
          className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700"
          title={r.id}
        >
          {r.label ?? r.id}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <div className="mt-1.5 text-xs text-slate-700">{children}</div>
    </div>
  );
}

// ── Sub-overlays (exported for granular composition) ─────────────────────

export function RuntimeProvenancePanel(props: RuntimeProvenancePanelProps) {
  return (
    <Section title="Provenance">
      <dl className="space-y-1">
        {props.sourceAdapter && (
          <div>
            <dt className="inline text-slate-500">Source adapter:</dt>{' '}
            <dd className="inline font-mono text-slate-800">{props.sourceAdapter}</dd>
          </div>
        )}
        {props.substrateVersion && (
          <div>
            <dt className="inline text-slate-500">Substrate version:</dt>{' '}
            <dd className="inline font-mono text-slate-800">{props.substrateVersion}</dd>
          </div>
        )}
        {props.contractVersion && (
          <div>
            <dt className="inline text-slate-500">Contract version:</dt>{' '}
            <dd className="inline font-mono text-slate-800">{props.contractVersion}</dd>
          </div>
        )}
        {props.projectedAt && (
          <div>
            <dt className="inline text-slate-500">Projected at:</dt>{' '}
            <dd className="inline font-mono text-slate-800">{props.projectedAt}</dd>
          </div>
        )}
      </dl>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Evidence refs</p>
        <RefList refs={props.evidenceRefs} empty="No evidence references attached." />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Lineage refs</p>
        <RefList refs={props.lineageRefs} empty="No lineage references attached." />
      </div>
    </Section>
  );
}

export function RuntimeChronologyOverlay(props: RuntimeChronologyOverlayProps) {
  return (
    <Section title="Chronology">
      <dl className="space-y-1">
        {props.epoch && (
          <div>
            <dt className="inline text-slate-500">Governance epoch:</dt>{' '}
            <dd className="inline text-slate-800">{props.epoch}</dd>
          </div>
        )}
        {props.anchorOccurredAt && (
          <div>
            <dt className="inline text-slate-500">Anchor occurred at:</dt>{' '}
            <dd className="inline font-mono text-slate-800">{props.anchorOccurredAt}</dd>
          </div>
        )}
        {props.chronologyWindow && (props.chronologyWindow.from || props.chronologyWindow.to) && (
          <div>
            <dt className="inline text-slate-500">Window:</dt>{' '}
            <dd className="inline font-mono text-slate-800">
              {props.chronologyWindow.from ?? '…'} → {props.chronologyWindow.to ?? '…'}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Preceding governance events</p>
        <RefList
          refs={props.precedingEventRefs}
          empty="No preceding governance events attached."
        />
      </div>
    </Section>
  );
}

export function RuntimeContinuityOverlay(props: RuntimeContinuityOverlayProps) {
  return (
    <Section title="Continuity">
      {props.continuityCohortRef && (
        <p className="mb-1">
          <span className="text-slate-500">Continuity cohort:</span>{' '}
          <span className="font-mono text-slate-800">
            {props.continuityCohortRef.label ?? props.continuityCohortRef.id}
          </span>
        </p>
      )}
      <div className="mt-1">
        <p className="text-[11px] text-slate-500">Succession breakpoints</p>
        <RefList
          refs={props.successionBreakpointRefs}
          empty="No succession breakpoints in scope."
        />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Unresolved transitions</p>
        <RefList
          refs={props.unresolvedTransitionRefs}
          empty="No unresolved transitions detected."
        />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Organizational memory gaps</p>
        <RefList refs={props.memoryGapRefs} empty="No organizational memory gaps recorded." />
      </div>
    </Section>
  );
}

export function RuntimeTopologyOverlay(props: RuntimeTopologyOverlayProps) {
  return (
    <Section title="Topology">
      <div>
        <p className="text-[11px] text-slate-500">Ancestor entities</p>
        <RefList refs={props.ancestorRefs} empty="No ancestor entities projected." />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Descendant entities</p>
        <RefList refs={props.descendantRefs} empty="No descendant entities projected." />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Affiliations</p>
        <RefList refs={props.affiliationRefs} empty="No affiliations attached." />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Delegations</p>
        <RefList refs={props.delegationRefs} empty="No delegations attached." />
      </div>
    </Section>
  );
}

export function RuntimeExplainabilityOverlay(props: RuntimeExplainabilityOverlayProps) {
  const posture =
    props.reviewPosture ?? 'assistive · human-reviewed · review-required';
  return (
    <Section title="Why is this visible?">
      <p className="text-slate-700">{props.visibilityRationale}</p>
      <p className="mt-2 text-[11px] uppercase tracking-wide text-amber-700">{posture}</p>
    </Section>
  );
}

// ── Cognition overlay (Wave 3) ───────────────────────────────────────────

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800">{value}</span>
    </div>
  );
}

export function RuntimeCognitionOverlay(props: RuntimeCognitionOverlayProps) {
  return (
    <Section title="Continuity cognition">
      {props.unresolvedTransitionSummary && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Unresolved transitions
          </p>
          <CountRow
            label="In window"
            value={props.unresolvedTransitionSummary.totalCount}
          />
          {props.unresolvedTransitionSummary.oldestOccurredAt && (
            <p className="text-[11px] text-slate-500">
              Oldest opened at{' '}
              <span className="font-mono text-slate-700">
                {props.unresolvedTransitionSummary.oldestOccurredAt}
              </span>
              {props.unresolvedTransitionSummary.newestOccurredAt && (
                <>
                  {' · newest '}
                  <span className="font-mono text-slate-700">
                    {props.unresolvedTransitionSummary.newestOccurredAt}
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      )}
      {props.breakpointSummary && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Continuity breakpoints
          </p>
          <CountRow label="Total" value={props.breakpointSummary.totalCount} />
          <CountRow
            label="Bracketed by organizational memory"
            value={props.breakpointSummary.bracketedCount}
          />
          <CountRow
            label="Awaiting memory reference"
            value={props.breakpointSummary.unbracketedCount}
          />
        </div>
      )}
      {props.lineageBreakSummary && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Lineage discontinuities
          </p>
          <CountRow label="Total" value={props.lineageBreakSummary.totalCount} />
          {props.lineageBreakSummary.byReason &&
            Object.entries(props.lineageBreakSummary.byReason).map(([reason, n]) => (
              <CountRow key={reason} label={reason.replace(/_/g, ' ')} value={n} />
            ))}
        </div>
      )}
      {props.memoryGapSummary && (
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">
            Organizational memory gaps
          </p>
          <CountRow label="Entries with gaps" value={props.memoryGapSummary.totalCount} />
          <CountRow label="Missing evidence" value={props.memoryGapSummary.missingEvidenceCount} />
          <CountRow
            label="Missing knowledge"
            value={props.memoryGapSummary.missingKnowledgeCount}
          />
          <CountRow label="Missing policy" value={props.memoryGapSummary.missingPolicyCount} />
        </div>
      )}
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">Succession pathway (chronological)</p>
        <RefList
          refs={props.successionPathwayRefs}
          empty="No succession steps in scope."
        />
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-slate-500">
          Procedural fragility refs (entities co-occurring across ≥ 2 substrate signals)
        </p>
        <RefList
          refs={props.proceduralFragilityRefs}
          empty="No procedural fragility refs in scope."
        />
      </div>
    </Section>
  );
}

// ── Composite footer ─────────────────────────────────────────────────────

export function RuntimeHydrationFooter(props: RuntimeHydrationFooterProps) {
  return (
    <section
      aria-label={`${props.surface} runtime hydration footer`}
      className="mx-auto mt-10 max-w-6xl border-t border-slate-200 px-4 pb-10 pt-6"
      data-testid="runtime-hydration-footer"
    >
      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Runtime hydration
        </p>
        <h2 className="mt-1 text-base font-semibold text-slate-900">
          {props.surface} · organizational substrate provenance
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
          The panels below disclose the substrate, chronology, continuity, and
          topology references that compose this surface. They are read-only,
          governance-safe, and stripped of any protected organizational
          semantics by the IGG protected-fence before being projected here.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {props.provenance && <RuntimeProvenancePanel {...props.provenance} />}
        {props.chronology && <RuntimeChronologyOverlay {...props.chronology} />}
        {props.continuity && <RuntimeContinuityOverlay {...props.continuity} />}
        {props.topology && <RuntimeTopologyOverlay {...props.topology} />}
        {props.cognition && <RuntimeCognitionOverlay {...props.cognition} />}
        <RuntimeExplainabilityOverlay {...props.explainability} />
      </div>

      {props.children && <div className="mt-4 text-xs text-slate-600">{props.children}</div>}
    </section>
  );
}
