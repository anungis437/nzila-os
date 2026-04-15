import { db } from "@/db";
import { employerExecutionReplays } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function processReplayRun(replayId: string, organizationId: string) {
  const [replay] = await db
    .select()
    .from(employerExecutionReplays)
    .where(and(eq(employerExecutionReplays.organizationId, organizationId), eq(employerExecutionReplays.id, replayId)))
    .limit(1);

  return {
    replayId,
    changed: Boolean((replay?.diffJson as { changed?: boolean } | null)?.changed),
  };
}
