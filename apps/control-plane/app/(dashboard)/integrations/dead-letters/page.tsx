import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton } from "@/components/ui/loading";
import { getDeadLetters } from "@/server/integration-data";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Dead Letters | Integration Fabric",
  description: "View and replay failed integration deliveries.",
};

async function DeadLettersContent() {
  const deadLetters = await getDeadLetters();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dead Letters"
        description="Failed deliveries that exhausted all retry attempts. Review and replay as needed."
      />

      {deadLetters.length === 0 ? (
        <div className="rounded-md border p-6 text-center text-muted-foreground">
          <p>No dead letters. All deliveries are being processed successfully.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">Event Type</th>
                <th className="px-4 py-2 text-left font-medium">Error</th>
                <th className="px-4 py-2 text-left font-medium">Attempts</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {deadLetters.map((dl) => (
                <tr key={dl.id} className="border-b">
                  <td className="px-4 py-2 font-mono text-xs">{dl.eventType}</td>
                  <td className="px-4 py-2 text-xs text-destructive">{dl.errorMessage.slice(0, 100)}</td>
                  <td className="px-4 py-2">{dl.totalAttempts}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${dl.replayed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {dl.replayed ? 'Replayed' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{dl.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DeadLettersPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <DeadLettersContent />
    </Suspense>
  );
}
