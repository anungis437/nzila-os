import {
  postureLabel,
  type AuditRow,
  type CadenceRow,
  type LifecycleRow,
  type OpenWorkflow,
  type RehearsalRow,
  type ReviewQueueRow,
} from "@/lib/field-operations";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 19).replace("T", " ");
}

function postureClass(p: string): string {
  switch (p) {
    case "STABILIZING":
    case "OPEN":
    case "DUE":
      return "text-amber-700";
    case "WAITING":
    case "REVIEWING":
    case "INTERPRETIVE":
      return "text-gray-700 italic";
    case "NOT_PROVISIONED":
      return "text-gray-500";
    case "REFUSED":
      return "text-red-700";
    default:
      return "text-gray-900";
  }
}

export function CadencePanel({ rows }: { rows: CadenceRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Operator Cadence
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Per operator type. Cadence is interpretive, not scored.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.operator} className="grid grid-cols-12 gap-2 px-6 py-3">
            <div className="col-span-4">
              <p className="font-medium text-foreground">{r.operator}</p>
              <p className="text-xs text-muted-foreground">{r.surface}</p>
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {r.cadence}
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {fmt(r.lastActivity)}
            </div>
            <div
              className={`col-span-2 text-right text-xs ${postureClass(
                r.posture,
              )}`}
            >
              {postureLabel(r.posture)}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewQueuePanel({ rows }: { rows: ReviewQueueRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Governance Review Queue
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Interpretive. A quiet week is a healthy week.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.category} className="grid grid-cols-12 gap-2 px-6 py-3">
            <div className="col-span-5">
              <p className="font-medium text-foreground">{r.category}</p>
              <p className="text-xs text-muted-foreground">{r.authority}</p>
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              {r.cadence}
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {fmt(r.lastClosedAt)}
            </div>
            <div
              className={`col-span-2 text-right text-xs ${postureClass(
                r.posture,
              )}`}
            >
              {r.posture}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AuditPanel({ rows }: { rows: AuditRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Operational Legitimacy Audit
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Governance-readable. No scores.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.category} className="px-6 py-3">
            <div className="flex items-baseline justify-between">
              <p className="font-medium text-foreground">{r.category}</p>
              <span
                className={`text-xs uppercase tracking-wide ${postureClass(
                  r.posture,
                )}`}
              >
                {r.posture}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {r.interpretation}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LifecyclePanel({ rows }: { rows: LifecycleRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Environment Lifecycle
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Per-tier lifecycle posture derived from registry + ledger.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.tier} className="grid grid-cols-12 gap-2 px-6 py-3">
            <div className="col-span-2 font-mono text-xs text-foreground">
              {r.tier}
            </div>
            <div
              className={`col-span-2 text-xs uppercase tracking-wide ${
                r.state === "stabilizing"
                  ? "text-amber-700"
                  : r.state === "provisioned"
                    ? "text-gray-500"
                    : "text-gray-900"
              }`}
            >
              {r.state}
            </div>
            <div className="col-span-8 text-xs text-muted-foreground">
              {r.detail}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function WorkflowPanel({ rows }: { rows: OpenWorkflow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Open Workflows
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Governance-guided. Not process-heavy.
        </p>
      </header>
      {rows.length === 0 ? (
        <p className="px-6 py-4 text-sm text-muted-foreground">
          No open workflows. The ecosystem is calm.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {rows.map((r) => (
            <li key={r.workflow} className="px-6 py-3">
              <p className="font-medium text-foreground">{r.workflow}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Trigger: {r.trigger}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Authority: {r.authority}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RehearsalPanel({ rows }: { rows: RehearsalRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Operational Rehearsals
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Recorded on a separate ledger. Interpretive scorecards only.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.rehearsal} className="grid grid-cols-12 gap-2 px-6 py-3">
            <div className="col-span-3 font-medium text-foreground">
              {r.rehearsal}
            </div>
            <div className="col-span-2 text-xs text-muted-foreground">
              {r.cadence}
            </div>
            <div className="col-span-4 text-xs text-muted-foreground">
              {fmt(r.lastAt)}
            </div>
            <div className="col-span-3 text-right text-xs text-muted-foreground">
              {r.reviewer ?? "—"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StabilizationGuidancePanel({
  windows,
}: {
  windows: { tier: string; minutesRemaining: number }[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Stabilization Guidance
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Defer non-continuity-safe activity while windows are open.
        </p>
      </header>
      {windows.length === 0 ? (
        <p className="px-6 py-4 text-sm text-muted-foreground">
          No open continuity windows. Default posture: observed.
        </p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {windows.map((w) => (
            <li key={w.tier} className="grid grid-cols-12 gap-2 px-6 py-3">
              <div className="col-span-3 font-mono text-xs text-foreground">
                {w.tier}
              </div>
              <div className="col-span-3 text-xs text-amber-700">
                Stabilizing
              </div>
              <div className="col-span-6 text-right text-xs text-muted-foreground">
                {w.minutesRemaining}m remaining
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
