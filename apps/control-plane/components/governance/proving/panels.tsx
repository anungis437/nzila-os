import type {
  ProvingChecklistRow,
  ProvingSnapshot,
  RefusalScenario,
  TraversalEdge,
} from "@/lib/operational-proving";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 19).replace("T", " ");
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

export function TraversalPanel({
  edges,
  coverage,
  expected,
}: {
  edges: TraversalEdge[];
  coverage: number;
  expected: number;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Environment Traversal
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Real promotions across the governed graph. {coverage}/{expected} edges
          attested.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {edges.map((e) => (
          <li
            key={`${e.from}->${e.to}`}
            className="grid grid-cols-12 gap-2 px-6 py-3"
          >
            <div className="col-span-3 font-medium text-foreground">
              {e.from} → {e.to}
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {shortId(e.attestationId)}
            </div>
            <div className="col-span-3 text-xs text-muted-foreground">
              {fmt(e.recordedAt)}
            </div>
            <div className="col-span-3 text-right text-xs text-muted-foreground">
              {e.attestationId ? "PROVEN" : "PENDING"}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function RefusalCoveragePanel({
  scenarios,
  logFound,
}: {
  scenarios: RefusalScenario[];
  logFound: boolean;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Refusal Coverage
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Refusals are governance-safe interpretive feedback. Log{" "}
          {logFound ? "present" : "missing"}.
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {scenarios.length === 0 ? (
          <li className="px-6 py-3 text-xs text-muted-foreground">
            No refusal scenarios in manifest.
          </li>
        ) : (
          scenarios.map((s) => (
            <li
              key={s.name}
              className="grid grid-cols-12 gap-2 px-6 py-3"
            >
              <div className="col-span-9 text-foreground">{s.name}</div>
              <div className="col-span-3 text-right text-xs text-muted-foreground">
                {s.actual}
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

export function RollbackProvingPanel({
  rollback,
}: {
  rollback: ProvingSnapshot["rollback"];
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Rollback Proving
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Continuity-preserving. Same authority level as a promotion.
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-6 py-4 text-sm">
        <dt className="text-muted-foreground">Tier</dt>
        <dd className="text-foreground">{rollback.tier ?? "—"}</dd>
        <dt className="text-muted-foreground">Attestation</dt>
        <dd className="text-foreground">{shortId(rollback.attestationId)}</dd>
        <dt className="text-muted-foreground">Evidence log</dt>
        <dd className="text-foreground">{rollback.log}</dd>
        <dt className="text-muted-foreground">State</dt>
        <dd className="text-foreground">
          {rollback.found ? "PROVEN" : "PENDING"}
        </dd>
      </dl>
    </section>
  );
}

export function RestorationPanel({
  restoration,
}: {
  restoration: ProvingSnapshot["restoration"];
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">Restoration</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Restoration is governed identically to a major change.
        </p>
      </header>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-6 py-4 text-sm">
        <dt className="text-muted-foreground">Tier</dt>
        <dd className="text-foreground">{restoration.tier ?? "—"}</dd>
        <dt className="text-muted-foreground">Attestation</dt>
        <dd className="text-foreground">
          {shortId(restoration.attestationId)}
        </dd>
        <dt className="text-muted-foreground">Evidence log</dt>
        <dd className="text-foreground">{restoration.log}</dd>
        <dt className="text-muted-foreground">State</dt>
        <dd className="text-foreground">
          {restoration.found ? "PROVEN" : "PENDING"}
        </dd>
      </dl>
    </section>
  );
}

export function ProvingChecklistPanel({
  rows,
  release,
  recordedAt,
}: {
  rows: ProvingChecklistRow[];
  release: string | null;
  recordedAt: string | null;
}) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold text-foreground">
          Phase C Closure
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Release under proving: {release ?? "—"} · Recorded{" "}
          {fmt(recordedAt)}
        </p>
      </header>
      <ul className="divide-y divide-border text-sm">
        {rows.map((r) => (
          <li key={r.area} className="grid grid-cols-12 gap-2 px-6 py-3">
            <div className="col-span-5 font-medium text-foreground">
              {r.area}
            </div>
            <div className="col-span-5 text-xs text-muted-foreground">
              {r.evidence}
            </div>
            <div className="col-span-2 text-right text-xs text-muted-foreground">
              {r.state}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
