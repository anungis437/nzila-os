/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";

import { WorkspaceShell } from "../workspace-shell";

const messages: Record<string, string> = {
  title: "Workspace",
  intro: "Each section answers a single operational question.",
  tabsLabel: "Workspace sections",
  unknownRoleBanner:
    "This role is not on the workspace persona map. Every section is labeled as a stub so it is not presented as available.",
  "availability.available": "In role",
  "availability.stub": "Stub",
  "availability.unavailable": "Unavailable",
  "tabs.overview.label": "Overview",
  "tabs.case-operations.label": "Case Operations",
  "tabs.members.label": "Members",
  "tabs.governance.label": "Governance",
  "tabs.continuity.label": "Continuity",
  "tabs.financial.label": "Financial",
  "tabs.documents.label": "Documents",
  stubPanel:
    "This section is visible for orientation only. It is not an in-role operating surface, and nothing shown here is a live metric.",
  unavailablePanel: "This section is not available for your role.",
  "deepWork.unavailable": "Unavailable",
  "deepWork.unknownRole": "Role not recognized. This destination stays closed.",
  "deepWork.stubSection": "Not available from a stub section.",
  "deepWork.unavailableSection": "Not available for your role.",
  "deepWork.outOfRole": "Outside your role.",
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => messages[key] ?? key,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    className,
    ...rest
  }: {
    children: ReactNode;
    href: string;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/hooks/use-workspace-telemetry", () => ({
  useWorkspaceTelemetry: () => ({ emit: vi.fn() }),
}));

vi.mock("@/contexts/pilot-mode-context", () => ({
  usePilotMode: () => ({ isPilotMode: true, isLoading: false }),
}));

afterEach(() => {
  cleanup();
});

describe("WorkspaceShell persona labels", () => {
  it("labels steward tabs and does not treat a stub tab as live metrics", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell role="steward" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(7);
    expect(screen.getByRole("tab", { name: /Case Operations/i })).toHaveTextContent("In role");
    expect(screen.getByRole("tab", { name: /Financial/i })).toHaveTextContent("Stub");
    expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName(/Overview/i);

    await user.click(screen.getByRole("tab", { name: /Financial/i }));

    expect(screen.getByTestId("workspace-persona-state")).toHaveTextContent(
      /orientation only/i,
    );
    expect(screen.queryByText("Awaiting dues data.")).not.toBeInTheDocument();
    expect(screen.getByTestId("workspace-panel-financial")).toHaveAttribute(
      "data-availability",
      "stub",
    );

    const dues = screen.getByRole("link", { name: /Dues/i });
    expect(dues).toHaveAttribute("aria-disabled", "true");
    expect(dues).not.toHaveAttribute("href");
    expect(dues).toHaveTextContent("Unavailable");
  });

  it("fail-closes an unknown role so no tab is labeled in role", () => {
    render(<WorkspaceShell role="app_owner" />);

    expect(screen.getByTestId("workspace-unknown-role")).toHaveTextContent(/labeled as a stub/i);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab).toHaveTextContent("Stub");
      expect(tab).not.toHaveTextContent("In role");
      expect(tab).toHaveAttribute("data-availability", "stub");
    }
    expect(screen.getAllByRole("link").every((link) => link.getAttribute("aria-disabled") === "true")).toBe(
      true,
    );
  });

  it("reaches every tab trigger by keyboard and exposes selected state", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell role="executive" />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(7);
    for (const tab of tabs) {
      expect(tab.className).toContain("focus-visible:ring-2");
    }

    tabs[0].focus();
    expect(tabs[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(tabs[1]).toHaveFocus();
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");

    const deepWork = screen.getAllByTestId("workspace-deep-work-link");
    expect(deepWork.length).toBeGreaterThan(0);
    for (const control of deepWork) {
      expect(control.className).toContain("focus-visible:ring-2");
      control.focus();
      expect(control).toHaveFocus();
    }
  });

  it("keeps an in-role deep-work link active and labels an out-of-role one", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell role="steward" />);

    await user.click(screen.getByRole("tab", { name: /Case Operations/i }));

    const intake = screen.getByRole("link", { name: /Intake Queue/i });
    expect(intake).toHaveAttribute("href", "/en/dashboard/inbox?type=intake");
    expect(intake).not.toHaveAttribute("aria-disabled");
    expect(intake).toHaveAttribute("data-deep-work-state", "available");

    const casework = screen.getByRole("link", { name: /Opens the casework console/i });
    expect(casework).toHaveAttribute("href", "/en/dashboard/workbench");
    expect(casework).toHaveAttribute("data-deep-work-state", "remapped");
    expect(casework.className).toContain("min-h-11");
    expect(casework).toHaveTextContent(/cases list is outside your role/i);
    expect(casework).toHaveAccessibleDescription(/cases list is outside your role/i);

    const claims = screen.getByRole("link", { name: /^Claims/i });
    expect(claims).toHaveAttribute("aria-disabled", "true");
    expect(claims).toHaveTextContent("Unavailable");
    expect(claims).toHaveAccessibleDescription(/Outside your role/i);

    const priorities = screen.getByRole("link", { name: /^Priorities/i });
    expect(priorities).toHaveAttribute("aria-disabled", "true");
    expect(priorities).not.toHaveAttribute("href");

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.some((href) => href.includes("/dashboard/operations"))).toBe(false);
    expect(hrefs.some((href) => href.includes("/dashboard/cases"))).toBe(false);
    expect(hrefs.some((href) => href.includes("/dashboard/priorities"))).toBe(false);
    expect(hrefs.filter((href) => href.endsWith("/dashboard/workbench")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("workspace-deep-work").className).toContain("flex-wrap");
  });

  it("remaps steward continuity intelligence to institutional intelligence reports", async () => {
    const user = userEvent.setup();
    render(<WorkspaceShell role="steward" />);

    await user.click(screen.getByRole("tab", { name: /Continuity/i }));

    const reports = screen.getByRole("link", { name: /Opens institutional intelligence reports/i });
    expect(reports).toHaveAttribute("href", "/en/dashboard/intelligence");
    expect(reports).toHaveAttribute("data-deep-work-state", "remapped");
    expect(reports).toHaveTextContent(/outside your role/i);
    expect(screen.queryByRole("tab", { name: /^Intelligence$/i })).not.toBeInTheDocument();
  });
});
