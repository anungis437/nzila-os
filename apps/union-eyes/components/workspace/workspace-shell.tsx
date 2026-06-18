"use client";

/**
 * Union Eyes Workspace — shell.
 *
 * The single workspace entry point (Club360 pattern). Renders the seven
 * canonical tabs and emits `workspace.view` / `tab.view` telemetry.
 *
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md
 */

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceTabPanel } from "@/components/workspace/workspace-tab-panel";
import { useWorkspaceTelemetry } from "@/lib/hooks/use-workspace-telemetry";
import {
  DEFAULT_WORKSPACE_TAB,
  WORKSPACE_TABS,
  type WorkspaceTabId,
} from "@/components/workspace/workspace-config";

export function WorkspaceShell() {
  const { emit } = useWorkspaceTelemetry();
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>(DEFAULT_WORKSPACE_TAB);
  const workspaceViewedRef = useRef(false);

  // Emit workspace.view once on mount, and tab.view for the initial tab.
  useEffect(() => {
    if (workspaceViewedRef.current) return;
    workspaceViewedRef.current = true;
    emit("workspace.view");
    emit("tab.view", { tab: DEFAULT_WORKSPACE_TAB });
  }, [emit]);

  const handleTabChange = (value: string) => {
    const next = value as WorkspaceTabId;
    setActiveTab(next);
    emit("tab.view", { tab: next });
  };

  return (
    <div className="container mx-auto py-6 space-y-6" data-testid="union-eyes-workspace">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="text-sm text-muted-foreground">
          One operating surface for the union. Each tab answers a single
          operational question and links into the detailed workflow.
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex flex-wrap h-auto">
          {WORKSPACE_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {WORKSPACE_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            <WorkspaceTabPanel tab={tab} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
