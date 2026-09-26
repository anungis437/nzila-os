/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { getWorkspaceTab } from "../workspace-config";
import { WorkspaceTabPanel } from "../workspace-tab-panel";

vi.mock("next-intl", () => ({
  useLocale: () => "fr",
}));

vi.mock("@/lib/hooks/use-workspace-telemetry", () => ({
  useWorkspaceTelemetry: () => ({ emit: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("WorkspaceTabPanel availability copy", () => {
  it("renders an unavailable tab with honest copy and no metric grid", () => {
    const tab = getWorkspaceTab("financial");
    expect(tab).toBeDefined();

    render(
      <WorkspaceTabPanel
        tab={tab!}
        availability="unavailable"
        personaMessage="This section is not available for your role."
        deepWork={tab!.deepWork.map((link) => ({
          link,
          allowed: false,
          unavailableLabel: "Indisponible",
          unavailableReason: "Hors de votre rôle.",
        }))}
      />,
    );

    expect(screen.getByTestId("workspace-panel-financial")).toHaveAttribute(
      "data-availability",
      "unavailable",
    );
    expect(screen.getByTestId("workspace-persona-state")).toHaveTextContent(
      /not available for your role/i,
    );
    expect(screen.queryByText("Awaiting dues data.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")[0]).toHaveTextContent("Indisponible");
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("aria-disabled", "true");
  });
});
