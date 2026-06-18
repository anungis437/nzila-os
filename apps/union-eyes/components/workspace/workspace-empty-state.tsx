"use client";

/**
 * Union Eyes Workspace — honest empty state.
 *
 * Renders a calm, honest "awaiting data" message. The workspace NEVER fabricates
 * metrics; where no canonical data source is cleanly available we say so.
 *
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md (Data rule)
 */

import { cn } from "@/lib/utils";

export interface WorkspaceEmptyStateProps {
  message: string;
  className?: string;
}

export function WorkspaceEmptyState({ message, className }: WorkspaceEmptyStateProps) {
  return (
    <p
      className={cn("text-sm text-muted-foreground italic", className)}
      data-testid="workspace-empty-state"
    >
      {message}
    </p>
  );
}
