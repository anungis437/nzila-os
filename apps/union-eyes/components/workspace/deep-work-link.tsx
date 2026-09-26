"use client";

/**
 * Union Eyes Workspace — Deep Work link.
 *
 * Links the workspace into an existing legacy execution surface. The workspace
 * subordinates legacy pages; it never duplicates them.
 *
 * Out-of-role, stub, and unavailable destinations stay in the keyboard order
 * and expose a text reason. They do not navigate.
 *
 * On an allowed click it emits `deep_work.clicked` and `legacy_page.visited`
 * telemetry with a PII-free, static-route payload.
 * See UNION_EYES_TELEMETRY_SCHEMA.md.
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
  /** When false, the control stays focusable and does not navigate. */
  allowed?: boolean;
  unavailableLabel?: string;
  unavailableReason?: string;
}

const controlClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function DeepWorkLink({
  link,
  tab,
  allowed = true,
  unavailableLabel = "Unavailable",
  unavailableReason = "Unavailable",
}: DeepWorkLinkProps) {
  const locale = useLocale();
  const { emit } = useWorkspaceTelemetry();

  const route = link.href.split("?")[0];
  const localizedHref = `/${locale}${link.href}`;
  const reasonId = `workspace-deep-work-reason-${tab}-${link.href.replace(/[^a-z0-9]+/gi, "-")}`;

  if (!allowed) {
    return (
      <button
        type="button"
        role="link"
        aria-disabled="true"
        aria-describedby={reasonId}
        onClick={(event) => event.preventDefault()}
        className={`${controlClass} cursor-not-allowed border-dashed text-left`}
        data-testid="workspace-deep-work-link"
        data-deep-work-state="unavailable"
      >
        <span>{link.label}</span>
        <span className="text-xs font-semibold">{unavailableLabel}</span>
        <span id={reasonId} className="sr-only">
          {unavailableReason}
        </span>
      </button>
    );
  }

  const handleClick = () => {
    emit("deep_work.clicked", { tab, route });
    emit("legacy_page.visited", { tab, route });
  };

  return (
    <Link
      href={localizedHref}
      onClick={handleClick}
      className={`${controlClass} transition-colors hover:bg-accent hover:text-accent-foreground`}
      data-testid="workspace-deep-work-link"
      data-deep-work-state="available"
    >
      <span>{link.label}</span>
      <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
    </Link>
  );
}
