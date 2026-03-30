import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { Server } from "lucide-react";
import { getEnvironmentDashboard } from "@/server/data";
import { EnvironmentCard } from "@/components/environments/environment-card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Environments — Nzila OS Control Plane",
  description: "Environment status, deployment artifacts, and feature flags.",
};

async function EnvironmentsContent() {
  const dashboard = await getEnvironmentDashboard();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {dashboard.map((env) => (
        <EnvironmentCard
          key={env.environment}
          environment={env.environment}
          config={env.config}
          latestArtifact={env.latestArtifact}
          latestSnapshot={env.latestSnapshot}
          activeFlags={env.activeFlags}
        />
      ))}
    </div>
  );
}

export default function EnvironmentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Environments"
        description="Environment configuration, deployment artifacts, and governance snapshots."
        icon={<Server className="h-6 w-6" />}
      />
      <Suspense
        fallback={
          <div className="grid gap-6 md:grid-cols-2">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        }
      >
        <EnvironmentsContent />
      </Suspense>
    </div>
  );
}
