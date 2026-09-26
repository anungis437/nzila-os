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

  it("names a remapped destination and keeps a blocked control with a visible recovery", () => {
    const tab = getWorkspaceTab("case-operations");
    expect(tab).toBeDefined();

    render(
      <WorkspaceTabPanel
        tab={tab!}
        availability="available"
        personaMessage=""
        deepWork={[
          {
            link: { label: "Cases", href: "/dashboard/cases" },
            navigateHref: "/dashboard/workbench",
            displayLabel: "Casework console",
            allowed: true,
            unavailableLabel: "Unavailable",
            unavailableReason: "",
            remapReason: "Opens the casework console. The cases list is outside your role.",
          },
          {
            link: { label: "Claims", href: "/dashboard/claims" },
            allowed: false,
            unavailableLabel: "Unavailable",
            unavailableReason: "Outside your role.",
            recovery: {
              href: "/dashboard/workbench",
              label: "Casework console",
              hint: "Authorized surface for this deep work.",
            },
          },
        ]}
      />,
    );

    const remapped = screen.getByRole("link", { name: /Opens the casework console/i });
    expect(remapped).toHaveAttribute("href", "/fr/dashboard/workbench");
    expect(remapped).toHaveAttribute("data-deep-work-state", "remapped");
    expect(remapped.className).toContain("min-h-11");
    expect(remapped).toHaveAccessibleDescription(/cases list is outside your role/i);
    expect(remapped).toHaveTextContent("Casework console");

    const claims = screen.getByRole("link", { name: /^Claims/i });
    expect(claims).toHaveAttribute("aria-disabled", "true");
    expect(claims).toHaveAttribute("aria-describedby");
    expect(claims).toHaveAccessibleDescription(/Outside your role/i);

    const recovery = screen.getByRole("link", { name: /Authorized surface for this deep work/i });
    expect(recovery).toHaveAttribute("href", "/fr/dashboard/workbench");
    expect(recovery).toHaveAttribute("data-deep-work-state", "recovery");
    expect(recovery.className).toContain("min-h-11");
    expect(recovery).toHaveTextContent("Casework console");
  });
});
