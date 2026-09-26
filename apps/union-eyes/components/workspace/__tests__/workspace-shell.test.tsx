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

    const cases = screen.getByRole("link", { name: /^Cases/i });
    expect(cases).toHaveAttribute("aria-disabled", "true");
    expect(cases).toHaveTextContent("Unavailable");
    expect(cases).toHaveAccessibleDescription(/Outside your role/i);
  });
});
