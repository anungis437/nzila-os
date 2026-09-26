/**
 * @vitest-environment jsdom
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { WorkspaceShell } from "../workspace-shell";

const messages: Record<string, string> = {
  title: "Espace de travail",
  intro: "Chaque section répond à une seule question opérationnelle.",
  tabsLabel: "Sections de l'espace de travail",
  unknownRoleBanner: "Ce rôle ne figure pas sur la carte.",
  "availability.available": "Dans le rôle",
  "availability.stub": "Ébauche",
  "availability.unavailable": "Indisponible",
  "tabs.overview.label": "Aperçu",
  "tabs.case-operations.label": "Opérations de dossiers",
  "tabs.members.label": "Membres",
  "tabs.governance.label": "Gouvernance",
  "tabs.continuity.label": "Continuité",
  "tabs.financial.label": "Finances",
  "tabs.documents.label": "Documents",
  stubPanel: "Cette section est visible pour l'orientation seulement.",
  unavailablePanel: "Cette section n'est pas disponible pour votre rôle.",
  "deepWork.unavailable": "Indisponible",
  "deepWork.unknownRole": "Rôle non reconnu.",
  "deepWork.stubSection": "Non disponible depuis une section ébauche.",
  "deepWork.unavailableSection": "Non disponible pour votre rôle.",
  "deepWork.outOfRole": "Hors de votre rôle.",
};

vi.mock("next-intl", () => ({
  useLocale: () => "fr",
  useTranslations: () => (key: string) => messages[key] ?? key,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/hooks/use-workspace-telemetry", () => ({
  useWorkspaceTelemetry: () => ({ emit: vi.fn() }),
}));

vi.mock("@/contexts/pilot-mode-context", () => ({
  usePilotMode: () => ({ isPilotMode: false, isLoading: false }),
}));

afterEach(() => {
  cleanup();
});

describe("WorkspaceShell locale", () => {
  it("uses catalog strings for tab names and availability, not English-only literals", () => {
    render(<WorkspaceShell role="governance" />);

    expect(screen.getByRole("heading", { name: "Espace de travail" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Aperçu/i })).toHaveTextContent("Dans le rôle");
    expect(screen.getByRole("tab", { name: /Finances/i })).toHaveTextContent("Ébauche");
    expect(screen.queryByRole("tab", { name: /^Overview/ })).not.toBeInTheDocument();
  });
});
