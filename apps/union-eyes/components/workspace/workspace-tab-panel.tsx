"use client";

/**
 * Union Eyes Workspace — universal tab panel.
 *
 * Every workspace tab renders exactly three sections (Club360 pattern):
 *   Current State    — What is true right now?
 *   Required Actions — What needs attention?
 *   Deep Work        — Where do I go to execute the detailed workflow?
 *
 * Stub and unavailable tabs reuse WorkspaceEmptyState for the persona
 * explanation. They do not render metric placeholders that could be read
 * as live figures.
 *
 * Doctrine: docs/workspace/UNION_EYES_WORKSPACE_DOCTRINE.md
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import {
  DeepWorkLink,
  type DeepWorkRecoveryLink,
} from "@/components/workspace/deep-work-link";
import type {
  WorkspaceDeepWorkLink,
  WorkspaceTabConfig,
} from "@/components/workspace/workspace-config";
import type { WorkspaceTabAvailability } from "@/components/workspace/workspace-persona-availability";

export interface WorkspaceTabDeepWorkItem {
  link: WorkspaceDeepWorkLink;
  navigateHref?: string;
  displayLabel?: string;
  allowed: boolean;
  unavailableLabel: string;
  unavailableReason: string;
  remapReason?: string;
  recovery?: DeepWorkRecoveryLink;
}

export interface WorkspaceTabPanelProps {
  tab: WorkspaceTabConfig;
  availability: WorkspaceTabAvailability;
  /** Shown for stub and unavailable tabs. Ignored when availability is available. */
  personaMessage: string;
  deepWork: WorkspaceTabDeepWorkItem[];
}

export function WorkspaceTabPanel({
  tab,
  availability,
  personaMessage,
  deepWork,
}: WorkspaceTabPanelProps) {
  const orientationOnly = availability !== "available";

  return (
    <section
      aria-label={tab.label}
      className="space-y-6"
      data-testid={`workspace-panel-${tab.id}`}
      data-availability={availability}
    >
      <p className="text-base text-muted-foreground">{tab.question}</p>

      {orientationOnly ? (
        <div role="status" data-testid="workspace-persona-state">
          <WorkspaceEmptyState message={personaMessage} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current State</CardTitle>
        </CardHeader>
        <CardContent>
          {orientationOnly ? (
            <WorkspaceEmptyState message={personaMessage} />
          ) : (
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
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Required Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <WorkspaceEmptyState
            message={orientationOnly ? personaMessage : tab.requiredActions.emptyState}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Deep Work</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" data-testid="workspace-deep-work">
            {deepWork.map((item) => (
              <DeepWorkLink
                key={item.link.href}
                link={item.link}
                tab={tab.id}
                navigateHref={item.navigateHref}
                displayLabel={item.displayLabel}
                allowed={item.allowed}
                unavailableLabel={item.unavailableLabel}
                unavailableReason={item.unavailableReason}
                remapReason={item.remapReason}
                recovery={item.recovery}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
