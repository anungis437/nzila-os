import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { CardSkeleton, TableSkeleton } from "@/components/ui/loading";
import { SummaryCard } from "@/components/ui/summary-card";
import { LiveStreamTable } from "@/components/streaming/live-stream-table";
import { MediaJobsTable } from "@/components/streaming/media-jobs-table";
import { StreamEventLog } from "@/components/streaming/stream-event-log";
import { Radio, Tv, Clapperboard, CheckCircle2, XCircle, Layers } from "lucide-react";
import {
  getStreamingSummary,
  getRecentLiveStreams,
  getRecentMediaJobs,
  getRecentStreamEvents,
} from "@/server/streaming-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Streaming — Nzila OS Control Plane",
  description: "Live streaming and media processing infrastructure dashboard.",
};

async function StreamingContent() {
  const [summary, streams, jobs, events] = await Promise.all([
    getStreamingSummary(),
    getRecentLiveStreams(),
    getRecentMediaJobs(),
    getRecentStreamEvents(),
  ]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          title="Total Streams"
          icon={<Radio className="h-5 w-5" />}
          value={summary.totalStreams}
          subtitle="all-time live streams"
        />
        <SummaryCard
          title="Active Now"
          icon={<Tv className="h-5 w-5" />}
          value={summary.activeStreams}
          subtitle="live or ready"
        />
        <SummaryCard
          title="Media Jobs"
          icon={<Clapperboard className="h-5 w-5" />}
          value={summary.totalMediaJobs}
          subtitle="total transcode jobs"
        />
        <SummaryCard
          title="Completed"
          icon={<CheckCircle2 className="h-5 w-5" />}
          value={summary.completedJobs}
          subtitle="successful jobs"
        />
        <SummaryCard
          title="Failed"
          icon={<XCircle className="h-5 w-5" />}
          value={summary.failedJobs}
          subtitle="failed jobs"
        />
        <SummaryCard
          title="Variants"
          icon={<Layers className="h-5 w-5" />}
          value={summary.totalVariants}
          subtitle="ready media variants"
        />
      </div>

      {summary.failedJobs > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            {summary.failedJobs} media job(s) have failed — review the jobs table below for error details.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-8">
        {/* Live Streams */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Live Streams</h2>
          <LiveStreamTable streams={streams} />
        </section>

        {/* Media Jobs */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Media Jobs</h2>
          <MediaJobsTable jobs={jobs} />
        </section>

        {/* Stream Event Audit Log */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4">Event Log</h2>
          <StreamEventLog events={events} />
        </section>
      </div>
    </>
  );
}

export default function StreamingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Streaming Infrastructure"
        description="Live streaming (AWS IVS) and media processing (MediaConvert) dashboard."
      />
      <Suspense
        fallback={
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
            <TableSkeleton rows={5} />
          </div>
        }
      >
        <StreamingContent />
      </Suspense>
    </div>
  );
}
