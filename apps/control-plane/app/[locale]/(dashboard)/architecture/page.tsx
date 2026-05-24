import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Boxes,
  Package,
  AlertTriangle,
  CheckCircle,
  Layers,
  Server,
  FileCheck,
} from "lucide-react";
import {
  buildArchitectureSummary,
  type ArchitectureSummary,
} from "@/server/architecture-summary";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Architecture — Nzila OS Control Plane",
  description:
    "Architecture governance: package ownership, app compliance, lifecycle tiers, and dependency health.",
};

type ArchSummary = ArchitectureSummary;

function getArchitectureData(): ArchSummary | null {
  // Call the same helper the /api/control-plane/architecture endpoint uses,
  // directly in-process. No HTTP round-trip, no API-key juggling, and — most
  // importantly — no fabricated "demo" fallback when the workspace cannot be
  // located. If we cannot derive a real snapshot we render an honest empty
  // state below.
  return buildArchitectureSummary();
}

async function ArchitectureContent() {
  const data = getArchitectureData();

  if (!data) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-foreground">
              Architecture summary unavailable
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              The control plane could not locate the monorepo root from its
              current working directory. Architecture governance requires
              access to <code>packages/</code>, <code>apps/</code> and{" "}
              <code>platform/registry/</code> on disk. This dashboard refuses
              to show fabricated fallback numbers — fix the deployment so the
              source tree is mounted, then reload.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Top-level summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Registry Completeness"
          icon={<Layers className="h-5 w-5" />}
          value={`${data.overall.registryCompleteness}%`}
          subtitle={`${data.apps.total} registered apps`}
        />
        <SummaryCard
          title="Package Meta Coverage"
          icon={<Package className="h-5 w-5" />}
          value={`${data.overall.metaCoverage}%`}
          subtitle={`${data.packages.withMeta}/${data.packages.total} packages`}
        />
        <SummaryCard
          title="App Compliance"
          icon={<CheckCircle className="h-5 w-5" />}
          value={`${data.overall.appComplianceRate}%`}
          subtitle={`${data.apps.fullCompliance}/${data.apps.total} fully compliant`}
        />
        <SummaryCard
          title="Platform Services"
          icon={<Server className="h-5 w-5" />}
          value={data.platformServices.total}
          subtitle={`${Object.keys(data.platformServices.lifecycles).length} lifecycle stages`}
        />
        <SummaryCard
          title="Deprecated Packages"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={data.overall.deprecatedPackages}
          subtitle="Pending migration"
        />
        <SummaryCard
          title="Total Packages"
          icon={<Boxes className="h-5 w-5" />}
          value={data.packages.total}
          subtitle={`${Object.keys(data.packages.categories).length} categories`}
        />
        <SummaryCard
          title="Contract Tests"
          icon={<FileCheck className="h-5 w-5" />}
          value={data.contracts.testFiles}
          subtitle="Test files"
        />
      </div>

      {/* App Lifecycle Tiers */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          App Lifecycle Tiers
        </h2>
        <div className="grid gap-3 md:grid-cols-4">
          {["PRODUCTION", "PILOT", "INCUBATING", "EXPERIMENTAL"].map(
            (tier) => (
              <div
                key={tier}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {tier}
                </div>
                <div className="mt-1 text-2xl font-bold text-foreground">
                  {data.apps.tiers[tier] ?? 0}
                </div>
              </div>
            )
          )}
        </div>
        {data.apps.unregistered.length > 0 && (
          <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
            <span className="font-medium text-destructive">Unregistered:</span>{" "}
            {data.apps.unregistered.join(", ")}
          </div>
        )}
      </div>

      {/* Category breakdown */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Package Categories
        </h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Category
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                  Count
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.packages.categories)
                .sort(([, a], [, b]) => b - a)
                .map(([cat, count]) => (
                  <tr key={cat} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{cat}</td>
                    <td className="text-right px-4 py-3">{count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* App compliance table */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          App Gold Standard Compliance
        </h2>
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  App
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                  Tier
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                  Owner
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                  Checks
                </th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">
                  Level
                </th>
              </tr>
            </thead>
            <tbody>
              {data.apps.items.map((app) => (
                <tr
                  key={app.app}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-medium">{app.app}</td>
                  <td className="text-center px-4 py-3">
                    <span className="font-mono text-xs">{app.tier}</span>
                  </td>
                  <td className="text-center px-4 py-3 text-muted-foreground">
                    {app.owner}
                  </td>
                  <td className="text-center px-4 py-3">
                    {app.passed}/{app.checks}
                  </td>
                  <td className="text-center px-4 py-3">
                    <StatusBadge
                      status={
                        app.level === "FULL"
                          ? "healthy"
                          : app.level === "PARTIAL"
                          ? "warning"
                          : "critical"
                      }
                      label={app.level}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Platform services lifecycle */}
      {data.platformServices.total > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Platform Service Lifecycles
          </h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Lifecycle
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.platformServices.lifecycles)
                  .sort(([, a], [, b]) => b - a)
                  .map(([lifecycle, count]) => (
                    <tr
                      key={lifecycle}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {lifecycle}
                      </td>
                      <td className="text-right px-4 py-3">{count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

export default function ArchitecturePage() {
  return (
    <>
      <PageHeader
        title="Architecture"
        description="Architecture health: lifecycle tiers, registry completeness, package ownership, and compliance."
      />
      <Suspense
        fallback={
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        }
      >
        <ArchitectureContent />
      </Suspense>
    </>
  );
}
