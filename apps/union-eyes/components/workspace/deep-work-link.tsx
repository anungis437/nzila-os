"use client";

/**
 * Union Eyes Workspace — Deep Work link.
 *
 * Links the workspace into an existing legacy execution surface. The workspace
 * subordinates legacy pages; it never duplicates them.
 *
 * On click it emits `deep_work.clicked` and `legacy_page.visited` telemetry with
 * a PII-free, static-route payload. See UNION_EYES_TELEMETRY_SCHEMA.md.
 */

import Link from "next/link";
import { useLocale } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { useWorkspaceTelemetry } from "@/lib/hooks/use-workspace-telemetry";
import type {
  WorkspaceDeepWorkLink,
  WorkspaceTabId,
} from "@/components/workspace/workspace-config";

export interface DeepWorkLinkProps {
  link: WorkspaceDeepWorkLink;
  tab: WorkspaceTabId;
}

export function DeepWorkLink({ link, tab }: DeepWorkLinkProps) {
  const locale = useLocale();
  const { emit } = useWorkspaceTelemetry();

  // Static route template only (strip any query string for telemetry — no ids).
  const route = link.href.split("?")[0];
  const localizedHref = `/${locale}${link.href}`;

  const handleClick = () => {
    emit("deep_work.clicked", { tab, route });
    emit("legacy_page.visited", { tab, route });
  };

  return (
    <Link
      href={localizedHref}
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      data-testid="workspace-deep-work-link"
    >
      <span>{link.label}</span>
      <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
    </Link>
  );
}
