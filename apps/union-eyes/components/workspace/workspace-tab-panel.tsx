"use client";

/**
 * Union Eyes Workspace — universal tab panel.
 *
 * Every workspace tab renders exactly three sections (Club360 pattern):
 *   Current State    — What is true right now?
 *   Required Actions — What needs attention?
 *   Deep Work        — Where do I go to execute the detailed workflow?
 *
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { DeepWorkLink } from "@/components/workspace/deep-work-link";
import type { WorkspaceTabConfig } from "@/components/workspace/workspace-config";

export interface WorkspaceTabPanelProps {
  tab: WorkspaceTabConfig;
}

export function WorkspaceTabPanel({ tab }: WorkspaceTabPanelProps) {
  return (
    <section
      aria-label={tab.label}
      className="space-y-6"
      data-testid={`workspace-panel-${tab.id}`}
    >
      <p className="text-base text-muted-foreground">{tab.question}</p>

      {/* Current State */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current State</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tab.currentState.map((signal) => (
              <div key={signal.label} className="space-y-1">
                <dt className="text-sm font-medium text-foreground">{signal.label}</dt>
                <dd>
                  <WorkspaceEmptyState message={signal.emptyState} />
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Required Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Required Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceEmptyState message={tab.requiredActions.emptyState} />
        </CardContent>
      </Card>

      {/* Deep Work */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deep Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" data-testid="workspace-deep-work">
            {tab.deepWork.map((link) => (
              <DeepWorkLink key={link.href} link={link} tab={tab.id} />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
