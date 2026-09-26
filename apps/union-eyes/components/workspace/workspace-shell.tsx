"use client";

/**
 * Union Eyes Workspace — shell.
 *
 * The single workspace entry point (Club360 pattern). Renders the seven
 * canonical tabs and emits `workspace.view` / `tab.view` telemetry.
 *
 * Each trigger carries a persona availability label (in role / stub /
 * unavailable). Unknown roles fail closed to stub. Intelligence is not a tab.
 *
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceTabPanel } from "@/components/workspace/workspace-tab-panel";
import { useWorkspaceTelemetry } from "@/lib/hooks/use-workspace-telemetry";
import { usePilotMode } from "@/contexts/pilot-mode-context";
import {
  WORKSPACE_TABS,
  type WorkspaceDeepWorkLink,
  type WorkspaceTabId,
} from "@/components/workspace/workspace-config";
import {
  getWorkspaceTabAvailability,
  initialWorkspaceTab,
  resolveWorkspaceDeepWork,
  resolveWorkspacePersonaClass,
  type WorkspaceDeepWorkGate,
  type WorkspaceTabAvailability,
} from "@/components/workspace/workspace-persona-availability";
import type { WorkspaceTabDeepWorkItem } from "@/components/workspace/workspace-tab-panel";

export interface WorkspaceShellProps {
  /**
   * Role string used only to label the workspace. Null, blank, and
   * unrecognized values render every tab as a stub.
   */
  role: string | null;
}

function translate(t: (key: string) => string, key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

function presentDeepWork(
  t: (key: string) => string,
  role: string | null,
  tabId: WorkspaceTabId,
  link: WorkspaceDeepWorkLink,
  isPilotMode: boolean,
): WorkspaceTabDeepWorkItem {
  const unavailableLabel = translate(t, "deepWork.unavailable", "Unavailable");
  const resolution = resolveWorkspaceDeepWork(role, tabId, link.href, isPilotMode);
  if (resolution.kind === "reachable") {
    return { link, allowed: true, unavailableLabel, unavailableReason: "" };
  }
  if (resolution.kind === "remapped") {
    return {
      link,
      allowed: true,
      navigateHref: resolution.href,
      displayLabel: translate(t, resolution.labelKey, resolution.labelFallback),
      remapReason: translate(t, resolution.reasonKey, resolution.reasonFallback),
      unavailableLabel,
      unavailableReason: "",
    };
  }
  const gate: WorkspaceDeepWorkGate = { allowed: false, reason: resolution.reason };
  return {
    link,
    allowed: false,
    unavailableLabel,
    unavailableReason: translate(t, deepWorkReasonKey(gate), "Unavailable"),
    recovery: resolution.recovery
      ? {
          href: resolution.recovery.href,
          label: translate(t, resolution.recovery.labelKey, resolution.recovery.labelFallback),
          hint: translate(
            t,
            "deepWork.recoveryHint",
            "Authorized surface for this deep work.",
          ),
        }
      : undefined,
  };
}

function deepWorkReasonKey(gate: WorkspaceDeepWorkGate): string {
  if (gate.allowed) return "";
  switch (gate.reason) {
    case "unknown-role":
      return "deepWork.unknownRole";
    case "stub-section":
      return "deepWork.stubSection";
    case "unavailable-section":
      return "deepWork.unavailableSection";
    case "out-of-role":
      return "deepWork.outOfRole";
  }
}

export function WorkspaceShell({ role }: WorkspaceShellProps) {
  const t = useTranslations("workspaceNav") as unknown as (key: string) => string;
  const { emit } = useWorkspaceTelemetry();
  const { isPilotMode, isLoading: pilotLoading } = usePilotMode();
  // While the pilot flag is unresolved, treat exclusions as on (fail closed).
  const pilotGate = pilotLoading ? true : isPilotMode;
  const persona = resolveWorkspacePersonaClass(role);
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(() => initialWorkspaceTab(role));
  const initialTabRef = useRef(activeTab);
  const workspaceViewedRef = useRef(false);

  useEffect(() => {
    if (workspaceViewedRef.current) return;
    workspaceViewedRef.current = true;
    emit("workspace.view");
    emit("tab.view", { tab: initialTabRef.current });
  }, [emit]);

  const handleTabChange = (value: string) => {
    const next = value as WorkspaceTabId;
    setActiveTab(next);
    emit("tab.view", { tab: next });
  };

  const availabilityLabel = (availability: WorkspaceTabAvailability) =>
    translate(t, `availability.${availability}`, availability);

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="union-eyes-workspace">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {translate(t, "title", "Workspace")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate(
            t,
            "intro",
            "One operating surface for the union. Each section answers a single operational question. Labels show whether that section is in role, a stub for orientation, or unavailable.",
          )}
        </p>
      </header>

      {persona === null ? (
        <p
          role="status"
          className="text-sm text-foreground"
          data-testid="workspace-unknown-role"
        >
          {translate(
            t,
            "unknownRoleBanner",
            "This role is not on the workspace persona map. Every section is labeled as a stub so it is not presented as available.",
          )}
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList
          aria-label={translate(t, "tabsLabel", "Workspace sections")}
          className="flex h-auto w-full flex-wrap justify-start gap-1"
        >
          {WORKSPACE_TABS.map((tab) => {
            const availability = getWorkspaceTabAvailability(role, tab.id);
            const label = translate(t, `tabs.${tab.id}.label`, tab.label);
            const stateLabel = availabilityLabel(availability);
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                data-testid={`workspace-tab-${tab.id}`}
                data-availability={availability}
                className="h-auto min-h-11 gap-2 whitespace-normal px-3 py-2 text-left data-[state=active]:font-semibold data-[state=active]:underline data-[state=active]:underline-offset-4"
              >
                <span>{label}</span>
                <Badge
                  variant="outline"
                  className="pointer-events-none border-border bg-background text-xs font-semibold text-foreground"
                >
                  {stateLabel}
                </Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {WORKSPACE_TABS.map((tab) => {
          const availability = getWorkspaceTabAvailability(role, tab.id);
          const personaMessage =
            availability === "unavailable"
              ? translate(
                  t,
                  "unavailablePanel",
                  "This section is not available for your role.",
                )
              : translate(
                  t,
                  "stubPanel",
                  "This section is visible for orientation only. It is not an in-role operating surface, and nothing shown here is a live metric.",
                );
          return (
            <TabsContent key={tab.id} value={tab.id} className="mt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <WorkspaceTabPanel
                tab={tab}
                availability={availability}
                personaMessage={personaMessage}
                deepWork={tab.deepWork.map((link) =>
                  presentDeepWork(t, role, tab.id, link, pilotGate),
                )}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
