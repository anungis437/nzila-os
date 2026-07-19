"use client";

/**
 * Union Eyes Workspace — client telemetry emitter.
 *
 * Emits ONLY the allow-listed workspace events with a PII-free payload.
 * See docs/workspace/UNION_EYES_TELEMETRY_SCHEMA.md.
 *
 * Failures are swallowed and never block the user.
 */

import { useCallback } from "react";
import {
  WORKSPACE_ID,
  type WorkspaceClientTelemetryEvent,
  type WorkspaceTabId,
} from "@/components/workspace/workspace-config";

interface WorkspaceTelemetryInput {
  tab?: WorkspaceTabId;
  /** Static route template only (no identifiers). */
  route?: string;
}

export function useWorkspaceTelemetry() {
  const emit = useCallback(
    (event: WorkspaceClientTelemetryEvent, input: WorkspaceTelemetryInput = {}) => {
      // Build a strictly allow-listed, PII-free payload.
      const payload: Record<string, string> = {
        workspace: WORKSPACE_ID,
        timestamp: new Date().toISOString(),
      };
      if (input.tab) payload.tab = input.tab;
      if (input.route) payload.route = input.route;

      try {
        void fetch("/api/workspace/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, payload }),
          keepalive: true,
        }).catch(() => {
          // Telemetry must never block or surface errors to the user.
        });
      } catch {
        // Ignore — telemetry is best-effort only.
      }
    },
    [],
  );

  return { emit };
}
