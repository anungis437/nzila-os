import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Reports page — operational build.
 *
 * Wave 0 §3 (semantic demo isolation): the prior implementation only ever
 * rendered `Cupe4373ReportsPage` from `@/components/demo/*`. Both the
 * demo component and the runtime gate have been removed from this
 * application. Reports is not yet a real operational surface, so the
 * operational build returns 404 rather than pretending the surface
 * exists. The demo-only reports page lives in the
 * `@nzila/union-eyes-demo` artifact (`apps/union-eyes-demo/`).
 */
export default async function ReportsPage() {
  notFound();
}
