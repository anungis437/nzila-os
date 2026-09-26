"use client";

/**
 * Union Eyes Workspace — Deep Work link.
 *
 * Links the workspace into an existing legacy execution surface. The workspace
 * subordinates legacy pages; it never duplicates them.
 *
 * Out-of-role, stub, and unavailable destinations stay in the keyboard order
 * and expose a text reason. They do not navigate. A blocked control may offer
 * a visible recovery link to an already-authorized surface. A remapped control
 * navigates to that surface and names it in the label.
 *
 * Allowed and recovery controls are real links, so browser Back returns to
 * the workspace. They do not replace history.
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

export interface DeepWorkRecoveryLink {
  href: string;
  label: string;
  hint: string;
}

export interface DeepWorkLinkProps {
  link: WorkspaceDeepWorkLink;
  tab: WorkspaceTabId;
  /** Locale-free path used when this control navigates. Defaults to link.href. */
  navigateHref?: string;
  /** Visible label. Remapped controls pass the real destination name. */
  displayLabel?: string;
  /** When false, the control stays focusable and does not navigate. */
  allowed?: boolean;
  unavailableLabel?: string;
  unavailableReason?: string;
  /** Visible reason when navigation goes to an authorized alternate. */
  remapReason?: string;
  /** Shown beside a blocked control. The href must already be authorized. */
  recovery?: DeepWorkRecoveryLink;
}

const controlClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function DeepWorkLink({
  link,
  tab,
  navigateHref,
  displayLabel,
  allowed = true,
  unavailableLabel = "Unavailable",
  unavailableReason = "Unavailable",
  remapReason,
  recovery,
}: DeepWorkLinkProps) {
  const locale = useLocale();
  const { emit } = useWorkspaceTelemetry();

  const label = displayLabel ?? link.label;
  const destination = navigateHref ?? link.href;
  const route = destination.split("?")[0];
  const localizedHref = `/${locale}${destination}`;
  const reasonId = `workspace-deep-work-reason-${tab}-${link.href.replace(/[^a-z0-9]+/gi, "-")}`;

  const emitVisit = (visitedRoute: string) => {
    emit("deep_work.clicked", { tab, route: visitedRoute });
    emit("legacy_page.visited", { tab, route: visitedRoute });
  };

  if (!allowed) {
    const recoveryReasonId = `${reasonId}-recovery`;
    return (
      <span className="inline-flex max-w-full flex-wrap items-center gap-2">
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
          <span>{label}</span>
          <span className="text-xs font-semibold">{unavailableLabel}</span>
          <span id={reasonId} className="sr-only">
            {unavailableReason}
          </span>
        </button>
        {recovery ? (
          <Link
            href={`/${locale}${recovery.href}`}
            onClick={() => emitVisit(recovery.href.split("?")[0])}
            aria-describedby={recoveryReasonId}
            className={`${controlClass} transition-colors hover:bg-accent hover:text-accent-foreground`}
            data-testid="workspace-deep-work-link"
            data-deep-work-state="recovery"
          >
            <span>{recovery.label}</span>
            <span id={recoveryReasonId} className="text-xs font-normal">
              {recovery.hint}
            </span>
            <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
          </Link>
        ) : null}
      </span>
    );
  }

  return (
    <Link
      href={localizedHref}
      onClick={() => emitVisit(route)}
      aria-describedby={remapReason ? reasonId : undefined}
      className={`${controlClass} transition-colors hover:bg-accent hover:text-accent-foreground`}
      data-testid="workspace-deep-work-link"
      data-deep-work-state={remapReason ? "remapped" : "available"}
    >
      <span>{label}</span>
      {remapReason ? (
        <span id={reasonId} className="text-xs font-normal">
          {remapReason}
        </span>
      ) : null}
      <ArrowUpRight size={14} className="shrink-0" aria-hidden="true" />
    </Link>
  );
}
