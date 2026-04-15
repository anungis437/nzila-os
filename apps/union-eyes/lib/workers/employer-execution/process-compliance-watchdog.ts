import { db } from "@/db";
import { employerExecutionComplianceEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function processComplianceWatchdog(organizationId: string) {
  const openCritical = await db
    .select()
    .from(employerExecutionComplianceEvents)
    .where(
      and(
        eq(employerExecutionComplianceEvents.organizationId, organizationId),
        eq(employerExecutionComplianceEvents.status, "open"),
        eq(employerExecutionComplianceEvents.severity, "critical"),
      ),
    );

  return {
    organizationId,
    openCriticalCount: openCritical.length,
  };
}
